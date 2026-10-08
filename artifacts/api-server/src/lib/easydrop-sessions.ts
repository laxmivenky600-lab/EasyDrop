import { randomBytes } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import type { TransferFileMetadata, TransferSession } from "@workspace/api-zod";
import { WebSocket, WebSocketServer } from "ws";

const SESSION_TTL_MS = 292_000;
const SIGNALING_PATH = "/api/ws/easydrop";

type ParticipantRole = "sender" | "receiver";
type Session = TransferSession & {
  sender?: WebSocket;
  receiver?: WebSocket;
  expiryTimer: NodeJS.Timeout;
};

const sessions = new Map<string, Session>();
const webSocketServer = new WebSocketServer({
  noServer: true,
  maxPayload: 64 * 1024,
  handleProtocols(protocols) {
    return protocols.has("easydrop.v1") ? "easydrop.v1" : false;
  },
});

function send(socket: WebSocket | undefined, message: Record<string, unknown>) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function disposeSession(session: Session, reason: "cancel" | "complete" | "expired") {
  if (!sessions.has(session.sessionId)) return;
  sessions.delete(session.sessionId);
  clearTimeout(session.expiryTimer);
  for (const socket of [session.sender, session.receiver]) {
    send(socket, { type: reason });
    if (socket?.readyState === WebSocket.OPEN) socket.close(1000, reason);
  }
}

export function createTransferSession(files: TransferFileMetadata[]): TransferSession {
  const sessionId = `ED-${randomBytes(8).toString("hex").toUpperCase()}`;
  const session: Session = {
    sessionId,
    senderToken: randomBytes(32).toString("hex"),
    receiverToken: randomBytes(32).toString("hex"),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    files: files.map((file) => ({ ...file })),
    expiryTimer: setTimeout(() => disposeSession(session, "expired"), SESSION_TTL_MS),
  };
  sessions.set(sessionId, session);
  return {
    sessionId: session.sessionId,
    senderToken: session.senderToken,
    receiverToken: session.receiverToken,
    expiresAt: session.expiresAt,
    files: session.files,
  };
}

type Signal =
  | { type: "accept" | "decline" | "cancel" | "complete" }
  | { type: "offer" | "answer"; sdp: { type: string; sdp: string } }
  | { type: "ice-candidate"; candidate: Record<string, unknown> | null };

function parseSignal(raw: Buffer, role: ParticipantRole): Signal | null {
  let message: unknown;
  try {
    message = JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  const value = message as Record<string, unknown>;
  if (typeof value.type !== "string") return null;

  if ((value.type === "accept" || value.type === "decline") && role === "receiver") {
    return { type: value.type };
  }
  if (value.type === "cancel" && role === "sender") return { type: "cancel" };
  if (value.type === "complete" && role === "receiver") return { type: "complete" };
  if (
    (value.type === "offer" && role === "sender") ||
    (value.type === "answer" && role === "receiver")
  ) {
    const sdp = value.sdp;
    if (
      !sdp ||
      typeof sdp !== "object" ||
      typeof (sdp as Record<string, unknown>).sdp !== "string" ||
      (sdp as Record<string, string>).sdp.length > 48_000 ||
      (sdp as Record<string, unknown>).type !== value.type
    ) {
      return null;
    }
    return { type: value.type, sdp: sdp as { type: string; sdp: string } };
  }
  if (value.type === "ice-candidate") {
    const candidate = value.candidate;
    if (candidate === null) return { type: "ice-candidate", candidate: null };
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate) ||
      typeof (candidate as Record<string, unknown>).candidate !== "string" ||
      (candidate as Record<string, string>).candidate.length > 4_096
    ) {
      return null;
    }
    return { type: "ice-candidate", candidate: candidate as Record<string, unknown> };
  }
  return null;
}

function rejectUpgrade(socket: import("node:stream").Duplex, status: number, message: string) {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function onUpgrade(request: IncomingMessage, socket: import("node:stream").Duplex, head: Buffer) {
  let url: URL;
  try {
    url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  } catch {
    rejectUpgrade(socket, 400, "Bad Request");
    return;
  }
  if (url.pathname !== SIGNALING_PATH) {
    socket.destroy();
    return;
  }

  const sessionId = url.searchParams.get("sessionId");
  const offeredProtocols = (request.headers["sec-websocket-protocol"] ?? "")
    .split(",")
    .map((protocol) => protocol.trim());
  const credential = offeredProtocols.find((protocol) => protocol.startsWith("ed.sender.") || protocol.startsWith("ed.receiver."));
  if (!sessionId || !credential || !offeredProtocols.includes("easydrop.v1")) {
    rejectUpgrade(socket, 401, "Unauthorized");
    return;
  }

  const session = sessions.get(sessionId);
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) disposeSession(session, "expired");
    rejectUpgrade(socket, 410, "Gone");
    return;
  }

  const role: ParticipantRole = credential.startsWith("ed.sender.") ? "sender" : "receiver";
  const token = credential.slice(`ed.${role}.`.length);
  const expectedToken = role === "sender" ? session.senderToken : session.receiverToken;
  if (token !== expectedToken) {
    rejectUpgrade(socket, 401, "Unauthorized");
    return;
  }

  webSocketServer.handleUpgrade(request, socket, head, (client) => {
    webSocketServer.emit("connection", client, request, session, role);
  });
}

webSocketServer.on(
  "connection",
  (client: WebSocket, _request: IncomingMessage, session: Session, role: ParticipantRole) => {
    const peerRole: ParticipantRole = role === "sender" ? "receiver" : "sender";
    const peer = session[peerRole];
    const previous = session[role];
    if (previous && previous !== client && previous.readyState === WebSocket.OPEN) {
      previous.close(4001, "Reconnected");
    }
    session[role] = client;

    send(client, {
      type: "ready",
      role,
      files: session.files,
      expiresAt: session.expiresAt.toISOString(),
      peerPresent: peer?.readyState === WebSocket.OPEN,
    });
    if (peer?.readyState === WebSocket.OPEN) send(peer, { type: "peer-joined", role });

    client.on("message", (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        client.close(1003, "Signaling must be JSON");
        return;
      }
      const signal = parseSignal(data, role);
      if (!signal) {
        send(client, { type: "signaling-error", message: "Invalid signaling message." });
        return;
      }

      if (signal.type === "cancel" || signal.type === "complete") {
        disposeSession(session, signal.type);
        return;
      }
      send(session[peerRole], signal as unknown as Record<string, unknown>);
    });

    client.on("close", () => {
      if (session[role] === client) {
        session[role] = undefined;
        send(session[peerRole], { type: "peer-left" });
      }
    });
  },
);

export function attachEasyDropWebSocket(server: Server) {
  server.on("upgrade", onUpgrade);
}
