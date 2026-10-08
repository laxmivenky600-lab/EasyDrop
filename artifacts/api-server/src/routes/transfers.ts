import { Router, type IRouter } from "express";
import {
  CreateTransferSessionBody,
  CreateTransferSessionResponse,
} from "@workspace/api-zod";
import { createTransferSession } from "../lib/easydrop-sessions";

const router: IRouter = Router();
const MAX_TRANSFER_BYTES = 250 * 1024 * 1024;

router.post("/easydrop/sessions", (req, res): void => {
  const parsed = CreateTransferSessionBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.issues }, "Invalid EasyDrop session request");
    res.status(400).json({ error: "Choose at least one valid file." });
    return;
  }

  const totalBytes = parsed.data.files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > MAX_TRANSFER_BYTES) {
    res.status(400).json({ error: "Files must total 250 MiB or less." });
    return;
  }

  const session = createTransferSession(parsed.data.files);
  res.status(201).json(CreateTransferSessionResponse.parse(session));
});

export default router;
