import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { requireAdmin } from "../middleware/auth";
import { validateAndStore, LIMITS, UploadValidationError, type UploadKind } from "../lib/uploadSecurity";
import { asyncHandler } from "../lib/asyncHandler";

export const uploadsRouter = Router();
uploadsRouter.use(requireAdmin);

const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

const DECLARED_MIME: Record<string, UploadKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "application/pdf": "document",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(...Object.values(LIMITS)) },
  fileFilter: (_req, file, cb) => {
    if (!DECLARED_MIME[file.mimetype]) {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

uploadsRouter.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }
    const kind = DECLARED_MIME[req.file.mimetype];
    try {
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
