import fs from "node:fs";
import path from "node:path";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { prisma } from "../../prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { requirePermission } from "../../middleware/auth";
import { UploadValidationError, validateAndStore } from "../../lib/uploadSecurity";
import { AgentLlmError, agentAvailable, agentSupportsVision, transcribeAudio } from "./llm";
import { getConversation, listVisible, runTurn } from "./agent";
import { investDocsDir } from "./paths";
import { open, seal, sealBuffer } from "./secure";
import { listKnowledge, readIndexFile, readProjectFile, syncKnowledge } from "./knowledge";

/** Mounted under the invest admin router (admin + "invest" permission already required). */
export const investAgentRouter = Router();
// Separate grant on top of "invest": full admins have it; others only when given "investAi".
investAgentRouter.use(requirePermission("investAi"));

function who(req: Request) {
  const s = req.session!;
  return { userId: s.userId, actor: { id: s.userId, email: s.email } };
}

function fail(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string };
  const status = err instanceof AgentLlmError ? err.status : e?.status ?? 500;
  if (status >= 500 && !(err instanceof AgentLlmError)) console.error("[invest-agent]", err);
  res.status(status).json({ error: status >= 500 && !(err instanceof AgentLlmError) ? "Server error" : e.message });
}

function h(fn: (req: Request, res: Response) => Promise<unknown>) {
  return asyncHandler(async (req, res) => {
    try {
      const out = await fn(req, res);
      if (!res.headersSent) res.json(out ?? { ok: true });
    } catch (err) {
      fail(res, err);
    }
  });
}

const turnLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  keyGenerator: (req) => `agent:${req.session?.userId ?? "anon"}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "رسائل كثيرة خلال دقيقة، انتظر قليلاً" },
});

investAgentRouter.get(
  "/status",
  h(async () => ({ enabled: await agentAvailable(), vision: await agentSupportsVision() }))
);

investAgentRouter.get(
  "/conversations",
  h(async (req) => {
    const rows = await prisma.invAgentConversation.findMany({
      where: { userId: who(req).userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    return rows.map((c) => ({ id: c.id, title: open(c.title) || "محادثة", projectId: c.projectId, updatedAt: c.updatedAt.toISOString() }));
  })
);

investAgentRouter.post(
  "/conversations",
  h(async (req) => {
    const projectId = typeof req.body?.projectId === "string" && req.body.projectId ? String(req.body.projectId) : null;
    if (projectId && !(await prisma.invProject.findUnique({ where: { id: projectId }, select: { id: true } }))) {
      throw Object.assign(new Error("المشروع غير موجود"), { status: 404 });
    }
    const c = await prisma.invAgentConversation.create({ data: { userId: who(req).userId, projectId } });
    return { id: c.id, title: c.title, projectId: c.projectId, updatedAt: c.updatedAt.toISOString() };
  })
);

investAgentRouter.get(
  "/conversations/:id",
  h(async (req) => {
    const c = await getConversation(who(req).userId, req.params.id);
    return { conversation: { id: c.id, title: open(c.title), projectId: c.projectId }, messages: await listVisible(c.id) };
  })
);

investAgentRouter.delete(
  "/conversations/:id",
  h(async (req) => {
    const c = await getConversation(who(req).userId, req.params.id);
    await prisma.invAgentConversation.delete({ where: { id: c.id } });
    return { ok: true };
  })
);

investAgentRouter.post(
  "/conversations/:id/messages",
  turnLimiter,
  h(async (req) => {
    const { userId, actor } = who(req);
    const ids = Array.isArray(req.body?.attachmentIds) ? (req.body.attachmentIds as unknown[]).map(String).slice(0, 6) : [];
    return runTurn({ userId, actor, conversationId: req.params.id, text: String(req.body?.text ?? ""), attachmentIds: ids });
  })
);

// ── Files (bills, receipts, contracts) ───────────────────────
const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype) || file.mimetype === "application/pdf";
    if (ok) cb(null, true);
    else cb(new Error("صورة أو PDF فقط"));
  },
});

function single(mw: ReturnType<typeof multer>, field: string) {
  return (req: Request, res: Response, next: (e?: unknown) => void) =>
    mw.single(field)(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "تعذّر رفع الملف" });
        return;
      }
      next();
    });
}

investAgentRouter.post(
  "/attachments",
  single(fileUpload, "file"),
  h(async (req) => {
    if (!req.file) throw Object.assign(new Error("لم يتم اختيار ملف"), { status: 400 });
    const kind = req.file.mimetype === "application/pdf" ? "document" : "image";
    let stored: { filename: string; mime: string };
    try {
      stored = await validateAndStore(req.file.buffer, kind, investDocsDir());
    } catch (err) {
      if (err instanceof UploadValidationError) throw Object.assign(new Error("الملف غير صالح — صورة أو PDF فقط"), { status: 400 });
      throw err;
    }
    const original = path.basename(req.file.originalname || "file").slice(0, 120);
    // Keep only the main file, encrypted at rest; drop the other plaintext image sizes.
    const plainPath = path.join(investDocsDir(), stored.filename);
    const encPath = `${plainPath}.enc`;
    await fs.promises.writeFile(encPath, sealBuffer(await fs.promises.readFile(plainPath)), { mode: 0o600 });
    const base = stored.filename.replace(/-(lg)\.webp$/, "");
    for (const f of [stored.filename, `${base}-sm.webp`, `${base}-md.webp`, `${base}-preview.webp`]) {
      await fs.promises.rm(path.join(investDocsDir(), f), { force: true });
    }
    const doc = await prisma.invDocument.create({
      data: {
        name: original,
        storageKey: encPath,
        mimeType: stored.mime,
        sizeBytes: req.file.size,
        uploadedBy: who(req).userId,
        kind: "other",
      },
    });
    return { documentId: doc.id, name: doc.name, mime: stored.mime };
  })
);

// ── Voice ────────────────────────────────────────────────────
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^(audio|video)\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|m4a|x-m4a|aac)/.test(file.mimetype)) cb(null, true);
    else cb(new Error("صيغة الصوت غير مدعومة"));
  },
});

const sttLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  keyGenerator: (req) => `agent-stt:${req.session?.userId ?? "anon"}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تسجيلات كثيرة خلال دقيقة" },
});

investAgentRouter.post(
  "/transcribe",
  sttLimiter,
  single(audioUpload, "audio"),
  h(async (req) => {
    if (!req.file) throw Object.assign(new Error("لا يوجد تسجيل"), { status: 400 });
    const mime = req.file.mimetype.split(";")[0]!;
    const ext = (mime.split("/")[1] || "webm").replace("x-", "").replace("mpeg", "mp3");
    return { text: await transcribeAudio(req.file.buffer, mime, `voice.${ext}`) };
  })
);

// ── Memory (per admin, only this assistant) ─────────────────
investAgentRouter.get(
  "/memory",
  h(async (req) => {
    const rows = await prisma.invAgentMemory.findMany({ where: { userId: who(req).userId }, orderBy: { createdAt: "asc" } });
    return rows.map((m) => ({ id: m.id, content: open(m.content), createdAt: m.createdAt.toISOString() }));
  })
);

investAgentRouter.post(
  "/memory",
  h(async (req) => {
    const content = String(req.body?.content ?? "").trim().slice(0, 500);
    if (!content) throw Object.assign(new Error("اكتب الملاحظة"), { status: 400 });
    const m = await prisma.invAgentMemory.create({ data: { userId: who(req).userId, content: seal(content) } });
    return { id: m.id, content, createdAt: m.createdAt.toISOString() };
  })
);

investAgentRouter.delete(
  "/memory/:id",
  h(async (req) => {
    await prisma.invAgentMemory.deleteMany({ where: { id: req.params.id, userId: who(req).userId } });
    return { ok: true };
  })
);

// ── Encrypted project memory files (JSON + TXT) ─────────────
investAgentRouter.get(
  "/knowledge",
  h(async () => {
    await syncKnowledge();
    return listKnowledge();
  })
);

investAgentRouter.post(
  "/knowledge/sync",
  h(async () => syncKnowledge())
);

/** Decrypted download for the admin; never cached. `id` = project id or "index". */
investAgentRouter.get(
  "/knowledge/:id/:format",
  asyncHandler(async (req, res) => {
    const format = req.params.format === "json" ? "json" : req.params.format === "txt" ? "txt" : null;
    if (!format) {
      res.status(400).json({ error: "json أو txt" });
      return;
    }
    let content: string | null;
    try {
      content = req.params.id === "index" ? readIndexFile(format) : readProjectFile(req.params.id, format);
    } catch (err) {
      fail(res, err);
      return;
    }
    if (!content) {
      res.status(404).json({ error: "الملف غير موجود" });
      return;
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", format === "json" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.id === "index" ? "projects-index" : req.params.id}.${format}"`);
    res.send(content);
  })
);
