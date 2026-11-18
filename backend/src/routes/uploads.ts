import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import { requireAdmin, requirePermission } from "../middleware/auth";
import {
  validateAndStore,
  LIMITS,
  UploadValidationError,
  isDeclaredVideo,
  transcodeToPlayableMp4,
  type UploadKind,
} from "../lib/uploadSecurity";
import { asyncHandler } from "../lib/asyncHandler";

declare global {
  namespace Express {
    interface Request {
      unrestrictedVideo?: boolean;
    }
  }
}

export const uploadsRouter = Router();
uploadsRouter.use(requireAdmin);
uploadsRouter.use(requirePermission("listings", "submissions", "media"));

const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

const DECLARED_MIME: Record<string, UploadKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "application/pdf": "document",
};

function kindForUpload(file: Express.Multer.File): UploadKind | null {
  const declared = DECLARED_MIME[file.mimetype];
  if (declared) return declared;
  if (isDeclaredVideo(file.mimetype, file.originalname)) return "video";
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(...Object.values(LIMITS)) },
  fileFilter: (_req, file, cb) => {
    if (!kindForUpload(file)) {
      console.warn("[upload] rejected mime", { mime: file.mimetype, name: file.originalname });
      cb(new Error(`Unsupported file type: ${file.mimetype || file.originalname}`));
      return;
    }
    cb(null, true);
  },
});

/** Full admin listing videos: no size or type gate. Stored on disk, then converted to MP4. */
const unrestrictedVideoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 16);
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
});

function isFullAdmin(req: Request) {
  const perms = req.session?.permissions;
  return !perms || perms.length === 0 || perms.includes("*");
}

function chooseUploader(req: Request, res: Response, next: NextFunction) {
  const asVideo = req.query.as === "video";
  const handler = asVideo && isFullAdmin(req) ? unrestrictedVideoUpload : upload;
  handler.single("file")(req, res, (err) => {
    if (err) {
      next(err);
      return;
    }
    if (asVideo && isFullAdmin(req)) req.unrestrictedVideo = true;
    next();
  });
}

const CHUNK_ROOT = path.join(os.tmpdir(), "alshantaf-video-chunks");
void fsp.mkdir(CHUNK_ROOT, { recursive: true });
const chunkUpload = multer({
  dest: CHUNK_ROOT,
  limits: { fileSize: 12 * 1024 * 1024 },
});

type VideoJob = { status: "processing" | "done" | "error"; url?: string; error?: string };
const videoJobs = new Map<string, VideoJob>();

function safeUploadId(value: unknown): string | null {
  const id = String(value || "");
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

uploadsRouter.post(
  "/video-chunk",
  chunkUpload.single("chunk"),
  asyncHandler(async (req, res) => {
    if (!isFullAdmin(req)) {
      if (req.file?.path) await fsp.unlink(req.file.path).catch(() => undefined);
      res.status(403).json({ error: "Full admin privilege is required" });
      return;
    }
    const uploadId = safeUploadId(req.body?.uploadId);
    const index = Number(req.body?.index);
    const total = Number(req.body?.total);
    if (!uploadId || !req.file || !Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 0 || index >= total) {
      if (req.file?.path) await fsp.unlink(req.file.path).catch(() => undefined);
      res.status(400).json({ error: "Invalid video chunk" });
      return;
    }
    const dir = path.join(CHUNK_ROOT, uploadId);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.rename(req.file.path, path.join(dir, String(index).padStart(6, "0")));
    await fsp.writeFile(
      path.join(dir, "meta.json"),
      JSON.stringify({ filename: String(req.body?.filename || "video.bin"), total })
    );
    const parts = (await fsp.readdir(dir)).filter((name) => /^\d{6}$/.test(name));
    console.log("[upload] video chunk", { uploadId, index, total, stored: parts.length });
    res.json({ received: parts.length, total, done: false });
  })
);

uploadsRouter.post(
  "/video-finish",
  asyncHandler(async (req, res) => {
    if (!isFullAdmin(req)) {
      res.status(403).json({ error: "Full admin privilege is required" });
      return;
    }
    const uploadId = safeUploadId(req.body?.uploadId);
    if (!uploadId) {
      res.status(400).json({ error: "Invalid upload" });
      return;
    }
    const existing = videoJobs.get(uploadId);
    if (existing?.status === "done") {
      res.json({ status: "done", url: existing.url, kind: "video" });
      return;
    }
    if (existing?.status === "error") {
      res.status(400).json({ error: existing.error || "Video conversion failed" });
      return;
    }
    if (!existing) {
      const dir = path.join(CHUNK_ROOT, uploadId);
      const metaRaw = await fsp.readFile(path.join(dir, "meta.json"), "utf8").catch(() => "");
      if (!metaRaw) {
        res.status(400).json({ error: "Upload not found" });
        return;
      }
      const meta = JSON.parse(metaRaw) as { filename?: string; total?: number };
      const total = Number(meta.total);
      const parts = (await fsp.readdir(dir)).filter((name) => /^\d{6}$/.test(name));
      if (!Number.isInteger(total) || parts.length < total) {
        res.status(400).json({ error: "Upload is incomplete" });
        return;
      }
      videoJobs.set(uploadId, { status: "processing" });
      void assembleAdminVideo(uploadId, dir, total, String(meta.filename || "video.bin"));
    }
    res.json({ status: "processing" });
  })
);

uploadsRouter.get(
  "/video-status",
  asyncHandler(async (req, res) => {
    if (!isFullAdmin(req)) {
      res.status(403).json({ error: "Full admin privilege is required" });
      return;
    }
    const uploadId = safeUploadId(req.query.uploadId);
    const job = uploadId ? videoJobs.get(uploadId) : undefined;
    if (!job) {
      res.status(404).json({ error: "Upload not found" });
      return;
    }
    if (job.status === "error") {
      res.status(400).json({ error: job.error || "Video conversion failed" });
      return;
    }
    // Same JSON while converting would otherwise 304, and the phone drops the poll.
    res.set("Cache-Control", "private, no-store, max-age=0");
    res.set("ETag", `"${Date.now()}-${Math.random().toString(16).slice(2)}"`);
    res.json(job.status === "done" ? { status: "done", url: job.url, kind: "video" } : { status: "processing" });
  })
);

async function assembleAdminVideo(uploadId: string, dir: string, total: number, filename: string) {
  const ext = path.extname(filename).slice(0, 16);
  const assembled = path.join(dir, `assembled${ext || ".bin"}`);
  try {
    const handle = await fsp.open(assembled, "w");
    try {
      for (let i = 0; i < total; i++) {
        const part = await fsp.readFile(path.join(dir, String(i).padStart(6, "0")));
        await handle.write(part);
      }
    } finally {
      await handle.close();
    }
    const { filename: stored } = await transcodeToPlayableMp4(assembled, UPLOAD_DIR);
    videoJobs.set(uploadId, { status: "done", url: `/uploads/${stored}` });
    console.log("[upload] video ready", { uploadId, url: `/uploads/${stored}` });
  } catch (err) {
    const message = err instanceof UploadValidationError ? err.message : "Video conversion failed";
    videoJobs.set(uploadId, { status: "error", error: message });
    console.warn("[upload] video assemble failed", uploadId, err instanceof Error ? err.message : err);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

uploadsRouter.post(
  "/",
  chooseUploader,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }
    try {
      if (req.unrestrictedVideo && req.file.path) {
        const { filename } = await transcodeToPlayableMp4(req.file.path, UPLOAD_DIR);
        res.status(201).json({ url: `/uploads/${filename}`, kind: "video" as const });
        return;
      }
      const kind = kindForUpload(req.file);
      if (!kind || !req.file.buffer) {
        res.status(400).json({ error: "Unsupported file type" });
        return;
      }
      const { filename } = await validateAndStore(req.file.buffer, kind, UPLOAD_DIR);
      res.status(201).json({ url: `/uploads/${filename}`, kind });
    } catch (err) {
      if (err instanceof UploadValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);
