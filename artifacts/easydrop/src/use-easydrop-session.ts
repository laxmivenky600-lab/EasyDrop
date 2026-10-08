import { useCallback, useEffect, useRef, useState } from 'react';

export type FileMeta = { name: string; mimeType: string; size: number };
export type ReceivedFile = FileMeta & { url: string; blob: Blob };
type Role = 'sender' | 'receiver';
type Status = 'idle' | 'connecting' | 'waiting' | 'accepted' | 'connecting-peer' | 'ready' | 'transferring' | 'complete' | 'declined' | 'expired' | 'cancelled' | 'disconnected' | 'error';
type Signal = Record<string, unknown> & { type?: string };

const CHUNK_SIZE = 16 * 1024;
const BUFFER_LIMIT = 1024 * 1024;

export function useEasyDropSession() {
  const [status, setStatus] = useState<Status>('idle');
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [peerPresent, setPeerPresent] = useState(false);
  const [bytesTransferred, setBytesTransferred] = useState(0);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [fileProgress, setFileProgress] = useState<Record<number, number>>({});
  const [error, setError] = useState('');
  const statusRef = useRef<Status>('idle');
  const terminalRef = useRef(false);
  const transferStopRef = useRef(false);
  const lastConnection = useRef<{ role: Role; sessionId: string; token: string; files: File[] } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const localFilesRef = useRef<File[]>([]);
  const roleRef = useRef<Role>('sender');
  const remoteDescriptionSet = useRef(false);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const incomingParts = useRef<Uint8Array[]>([]);
  const currentIncoming = useRef<{ index: number; metadata: FileMeta; size: number } | null>(null);
  const receivedRef = useRef<ReceivedFile[]>([]);
  const expectedFilesRef = useRef<FileMeta[]>([]);
  const alive = useRef(true);

  const sendSignal = useCallback((message: Signal) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }, []);
  statusRef.current = status;

  const closePeer = useCallback(() => {
    channelRef.current?.close();
    channelRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    remoteDescriptionSet.current = false;
    pendingCandidates.current = [];
  }, []);

  const disconnect = useCallback(() => {
    closePeer();
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [closePeer]);

  const connect = useCallback((role: Role, sessionId: string, token: string, localFiles: File[] = []) => {
    disconnect();
    roleRef.current = role;
    localFilesRef.current = localFiles;
    lastConnection.current = { role, sessionId, token, files: localFiles };
    setStatus('connecting');
    terminalRef.current = false;
    setError('');
    setBytesTransferred(0);
    setReceivedFiles([]);
    receivedRef.current = [];
    setFileProgress({});
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const credential = role === 'sender' ? `ed.sender.${token}` : `ed.receiver.${token}`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(`${scheme}//${window.location.host}/api/ws/easydrop?sessionId=${encodeURIComponent(sessionId)}`, ['easydrop.v1', credential]);
    } catch {
      setStatus('error');
      setError('Could not open the temporary connection. Check your network and retry.');
      return;
    }
    wsRef.current = socket;
    socket.onopen = () => {
      if (alive.current) setStatus('waiting');
    };
    socket.onmessage = async (event) => {
      let message: Signal;
      try {
        message = JSON.parse(String(event.data)) as Signal;
      } catch {
        setStatus('error');
        setError('The session sent an unreadable signal. Start a fresh session to continue.');
        return;
      }
      if (!message.type || typeof message.type !== 'string') {
        setStatus('error');
        setError('The session sent an incomplete signal. Start a fresh session to continue.');
        return;
      }
      if (message.type === 'signaling-error') {
        terminalRef.current = true;
        setStatus('error');
        setError(typeof message.message === 'string' ? message.message : typeof message.error === 'string' ? message.error : 'The temporary session rejected a signal. Create a new QR and try again.');
        closePeer();
        return;
      }
      if (message.type === 'ready') {
        if (message.role && message.role !== role) {
          setStatus('error');
          setError('This session credential is for a different role. Reopen the QR on the receiving device.');
          return;
        }
        if (Array.isArray(message.files)) {
          setFiles(message.files as FileMeta[]);
          expectedFilesRef.current = message.files as FileMeta[];
        }
        if (typeof message.expiresAt === 'string') setExpiresAt(message.expiresAt);
        if (typeof message.peerPresent === 'boolean') setPeerPresent(message.peerPresent);
        if (role === 'receiver') setStatus('waiting');
      } else if (message.type === 'peer-joined') {
        setPeerPresent(true);
      } else if (message.type === 'complete') {
        terminalRef.current = true;
        statusRef.current = 'complete';
        setStatus('complete');
        setError('');
        closePeer();
      } else if (message.type === 'peer-left') {
        setPeerPresent(false);
        if (!['complete', 'cancelled', 'declined', 'expired'].includes(status)) {
          setStatus('disconnected');
          setError('The other device disconnected. Retry the connection or end this session.');
        }
        closePeer();
      } else if (message.type === 'accept') {
        if (role !== 'sender') return;
        setStatus('accepted');
        setPeerPresent(true);
        try {
          const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
          pcRef.current = pc;
          pc.onicecandidate = (e) => sendSignal({ type: 'ice-candidate', candidate: e.candidate?.toJSON() ?? null });
          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
              setStatus('disconnected');
              setError('The peer connection was interrupted. Retry to establish a new connection.');
            }
          };
          const channel = pc.createDataChannel('files', { ordered: true });
          channel.bufferedAmountLowThreshold = BUFFER_LIMIT / 2;
          channelRef.current = channel;
          channel.onopen = () => setStatus('ready');
          channel.onerror = () => {
            setStatus('error');
            setError('The file channel failed. Retry the connection before sending.');
          };
          setStatus('connecting-peer');
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal({ type: 'offer', sdp: pc.localDescription });
        } catch {
          setStatus('error');
          setError('Could not establish a peer connection. Retry this session.');
        }
      } else if (message.type === 'decline') {
        terminalRef.current = true;
        setStatus('declined');
        setError('The receiver declined this transfer. Your files were not sent.');
        closePeer();
      } else if (message.type === 'cancel') {
        terminalRef.current = true;
        setStatus('cancelled');
        setError('The sender ended this temporary session. No files were transferred.');
        closePeer();
      } else if (message.type === 'expired') {
        terminalRef.current = true;
        setStatus('expired');
        setError('This temporary QR session has expired. Create a new one to continue.');
        closePeer();
      } else if (message.type === 'offer' || message.type === 'answer') {
        const description = message.sdp as RTCSessionDescriptionInit | undefined;
        if (!description || typeof description.type !== 'string') {
          setStatus('error');
          setError('The peer sent an invalid connection offer. Retry with a new session.');
          return;
        }
        try {
          let pc = pcRef.current;
          if (role === 'receiver' && message.type === 'offer') {
            closePeer();
            pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            pcRef.current = pc;
            pc.onicecandidate = (e) => sendSignal({ type: 'ice-candidate', candidate: e.candidate?.toJSON() ?? null });
            pc.ondatachannel = (e) => {
              const channel = e.channel;
              channelRef.current = channel;
              channel.binaryType = 'arraybuffer';
              channel.onopen = () => setStatus('ready');
              channel.onmessage = (packet) => {
                if (typeof packet.data === 'string') {
                  let envelope: Signal;
                  try { envelope = JSON.parse(packet.data) as Signal; } catch { setStatus('error'); setError('Received malformed file data. Ask the sender to retry.'); return; }
                  if (envelope.type === 'file-start' && Number.isInteger(envelope.index) && envelope.metadata && typeof envelope.metadata === 'object') {
                    const index = Number(envelope.index);
                    const meta = envelope.metadata as FileMeta;
                    const expected = expectedFilesRef.current[index];
                    if (!expected || expected.name !== meta.name || expected.mimeType !== meta.mimeType || expected.size !== meta.size) {
                      setStatus('error');
                      setError('The sender’s file details did not match the accepted request. No file was made available.');
                      return;
                    }
                    currentIncoming.current = { index, metadata: meta, size: 0 };
                    incomingParts.current = [];
                    setFileProgress((current) => ({ ...current, [Number(envelope.index)]: 0 }));
                  } else if (envelope.type === 'file-end') {
                    const current = currentIncoming.current;
                    if (!current || current.index !== Number(envelope.index) || current.size !== Number(envelope.size)) {
                      setStatus('error');
                      setError('A file arrived incomplete. The transfer cannot be marked complete.');
                      return;
                    }
                    const blobParts: BlobPart[] = incomingParts.current.map((part) => {
                      const copy = new Uint8Array(part.byteLength);
                      copy.set(part);
                      return copy.buffer;
                    });
                    const blob = new Blob(blobParts, { type: current.metadata.mimeType || 'application/octet-stream' });
                    const received: ReceivedFile = { ...current.metadata, blob, url: URL.createObjectURL(blob) };
                    receivedRef.current = [...receivedRef.current, received];
                    setReceivedFiles(receivedRef.current);
                    currentIncoming.current = null;
                    incomingParts.current = [];
                  } else if (envelope.type === 'transfer-complete') {
                    if (receivedRef.current.length !== expectedFilesRef.current.length || currentIncoming.current) {
                      setStatus('error');
                      setError('The sender ended before every file arrived. Do not use incomplete downloads; ask them to retry.');
                    } else if (!sendSignal({ type: 'complete' })) {
                      setStatus('error');
                      setError('All bytes arrived, but the temporary session could not confirm completion. Retry the connection before considering the transfer complete.');
                    }
                  } else if (envelope.type === 'cancel') {
                    setStatus('cancelled');
                    setError('The sender stopped the transfer. Incomplete files are unavailable.');
                  }
                } else {
                  const current = currentIncoming.current;
                  if (!current) {
                    setStatus('error');
                    setError('Unexpected file bytes arrived. The transfer was stopped.');
                    return;
                  }
                  const bytes = packet.data instanceof ArrayBuffer ? new Uint8Array(packet.data) : new Uint8Array(packet.data as Blob as unknown as ArrayBuffer);
                  incomingParts.current.push(bytes);
                  current.size += bytes.byteLength;
                  setBytesTransferred((value) => value + bytes.byteLength);
                  setFileProgress((value) => ({ ...value, [current.index]: current.size }));
                }
              };
            };
          }
          if (!pc) throw new Error('Peer connection missing');
          await pc.setRemoteDescription(description);
          remoteDescriptionSet.current = true;
          for (const candidate of pendingCandidates.current) await pc.addIceCandidate(candidate);
          pendingCandidates.current = [];
          if (role === 'receiver' && message.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            setStatus('connecting-peer');
            sendSignal({ type: 'answer', sdp: pc.localDescription });
          } else if (message.type === 'answer') {
            setStatus('connecting-peer');
          }
        } catch {
          setStatus('error');
          setError('Could not negotiate the peer connection. Start a fresh session and retry.');
        }
      } else if (message.type === 'ice-candidate') {
        try {
          const candidate = message.candidate as RTCIceCandidateInit | null;
          const pc = pcRef.current;
          if (candidate && pc && remoteDescriptionSet.current) await pc.addIceCandidate(candidate);
          else if (candidate) pendingCandidates.current.push(candidate);
        } catch {
          setStatus('error');
          setError('A connection candidate was invalid. Retry the peer connection.');
        }
      }
    };
    socket.onerror = () => {
      if (alive.current) {
        setStatus('error');
        setError('The temporary signalling connection could not be reached. Check your connection and retry.');
      }
    };
    socket.onclose = () => {
      if (alive.current && !terminalRef.current && !['complete', 'cancelled', 'declined', 'expired', 'error'].includes(statusRef.current)) {
        setStatus('disconnected');
        setError('The temporary connection closed. Retry or create a new session.');
      }
    };
  }, [closePeer, disconnect, sendSignal]);

  const accept = useCallback(() => {
    if (sendSignal({ type: 'accept' })) setStatus('accepted');
  }, [sendSignal]);
  const decline = useCallback(() => {
    sendSignal({ type: 'decline' });
    setStatus('declined');
    setError('You declined this transfer. No files were downloaded.');
    disconnect();
  }, [disconnect, sendSignal]);
  const cancel = useCallback(() => {
    transferStopRef.current = true;
    sendSignal({ type: 'cancel' });
    setStatus('cancelled');
    setError('This temporary session has ended.');
    disconnect();
  }, [disconnect, sendSignal]);
  const retryPeer = useCallback(() => {
    const socket = wsRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      closePeer();
      setError('');
      setStatus('waiting');
      if (roleRef.current === 'sender') sendSignal({ type: 'cancel' });
    } else {
      setError('The signalling connection is unavailable. Create a new QR session.');
    }
  }, [closePeer, sendSignal]);
  const retryConnection = useCallback(() => {
    const previous = lastConnection.current;
    if (previous) connect(previous.role, previous.sessionId, previous.token, previous.files);
    else {
      setStatus('error');
      setError('The temporary session credentials are no longer available. Ask the sender for a new QR.');
    }
  }, [connect]);

  const startTransfer = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== 'open') {
      setStatus('disconnected');
      setError('The peer-to-peer channel is not open. Retry before sending.');
      return;
    }
    setStatus('transferring');
    transferStopRef.current = false;
    setBytesTransferred(0);
    try {
      const waitForRoom = async () => {
        while (channel.bufferedAmount > BUFFER_LIMIT) {
          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => reject(new Error('File channel stalled')), 20000);
            channel.onbufferedamountlow = () => { window.clearTimeout(timeout); resolve(); };
          });
        }
      };
      for (let index = 0; index < localFilesRef.current.length; index += 1) {
        const file = localFilesRef.current[index];
        if (transferStopRef.current) return;
        channel.send(JSON.stringify({ type: 'file-start', index, metadata: { name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size } }));
        let offset = 0;
        while (offset < file.size) {
          if (transferStopRef.current) return;
          await waitForRoom();
          if (transferStopRef.current) return;
          const chunk = await file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size)).arrayBuffer();
          channel.send(chunk);
          offset += chunk.byteLength;
          setBytesTransferred((value) => value + chunk.byteLength);
          setFileProgress((value) => ({ ...value, [index]: offset }));
        }
        channel.send(JSON.stringify({ type: 'file-end', index, size: offset }));
      }
      channel.send(JSON.stringify({ type: 'transfer-complete' }));
    } catch {
      if (!transferStopRef.current) {
        setStatus('error');
        setError('The peer-to-peer transfer stopped before all bytes were sent. Retry the connection and send again.');
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      disconnect();
      receivedRef.current.forEach((file) => URL.revokeObjectURL(file.url));
    };
  }, [disconnect]);

  return { status, files, expiresAt, peerPresent, bytesTransferred, receivedFiles, fileProgress, error, connect, accept, decline, cancel, startTransfer, retryPeer, retryConnection, disconnect, setStatus };
}
