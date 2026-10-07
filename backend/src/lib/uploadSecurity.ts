import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

export type UploadKind = "image" | "video" | "document";

export const LIMITS = {
  image: 8 * 1024 * 1024,
  video: 60 * 1024 * 1024,
  document: 15 * 1024 * 1024,
};

const ALLOWED_EXT: Record<UploadKind, Set<string>> = {
  image: new Set(["jpg", "png", "webp", "gif"]),
  video: new Set(["mp4", "webm", "mov", "3gp"]),
  document: new Set(["pdf"]),
};

export class UploadValidationError extends Error {}

/** Responsive width tiers every uploaded image is re-encoded into. The "lg"
 * filename is what callers store/reference everywhere (Media.url, Submission.images);
 * "sm"/"md" siblings share its filename stem, so the frontend can derive a srcset
 * purely from string replacement — no schema change needed to carry variants around. */
const IMAGE_TIERS = [
  { suffix: "sm", box: 480, quality: 78 },
  { suffix: "md", box: 960, quality: 80 },
  { suffix: "lg", box: 1920, quality: 82 },
] as const;

// file-type is ESM-only. tsc rewrites a plain `import()` into `require()` under
// CommonJS output, which throws ERR_REQUIRE_ESM for an ESM-only package — so this
// forces a real, untransformed dynamic import via the Function constructor.
const importFileType = new Function("return import('file-type')") as () => Promise<any>;

async function detect(buffer: Buffer): Promise<{ ext: string; mime: string } | undefined> {
  const fileType = await importFileType();
  return fileType.fileTypeFromBuffer(buffer);
}

/**
 * Verifies file contents by magic bytes (never trusts the client-declared
 * mimetype/extension), then for images re-encodes through sharp to strip
 * any embedded payloads/metadata and normalize the format before writing
 * to disk. Returns the final filename on the uploads volume.
 */
export async function validateAndStore(
  buffer: Buffer,
  kind: UploadKind,
  uploadDir: string
): Promise<{ filename: string; mime: string }> {
  if (buffer.length > LIMITS[kind]) {
    throw new UploadValidationError(`File exceeds the maximum size for a ${kind}`);
  }

  const detected = await detect(buffer);
  if (!detected || !ALLOWED_EXT[kind].has(detected.ext)) {
    throw new UploadValidationError(`File content does not match an allowed ${kind} type`);
  }

  const id = crypto.randomUUID();

  if (kind === "image") {
    let largeFilename = "";
    for (const tier of IMAGE_TIERS) {
      const filename = `${id}-${tier.suffix}.webp`;
      await sharp(buffer, { limitInputPixels: 50_000_000 })
        .rotate()
        .resize({ width: tier.box, height: tier.box, fit: "inside", withoutEnlargement: true })
        .webp({ quality: tier.quality })
        .toFile(path.join(uploadDir, filename));
      if (tier.suffix === "lg") largeFilename = filename;
    }
    return { filename: largeFilename, mime: "image/webp" };
  }

  if (kind === "video") {
    const compressed = await compressVideo(buffer, id, uploadDir);
    if (compressed) return compressed;
    // ffmpeg unavailable/failed/timed out — store the original untouched rather than losing the upload.
    const filename = `${id}.${detected.ext}`;
    await fs.writeFile(path.join(uploadDir, filename), buffer);
    return { filename, mime: detected.mime };
  }

  const filename = `${id}.${detected.ext}`;
  await fs.writeFile(path.join(uploadDir, filename), buffer);
  if (kind === "document" && detected.ext === "pdf") {
    // Best-effort preview generation: store a long stitched image alongside the PDF.
    await buildPdfPreviewImage(path.join(uploadDir, filename), `${id}-preview.webp`, uploadDir).catch(() => undefined);
  }
  return { filename, mime: detected.mime };
}

/** Re-encodes a video to a size-capped, quality-preserving H.264/AAC mp4 via ffmpeg.
 * Returns null (never throws) on any failure so the caller can fall back to the
 * original file — a slow or missing ffmpeg must never block a submission. */
async function compressVideo(
  buffer: Buffer,
  id: string,
  uploadDir: string
): Promise<{ filename: string; mime: string } | null> {
  const tmpIn = path.join(os.tmpdir(), `${id}-in`);
  const filename = `${id}.mp4`;
  const tmpOut = path.join(uploadDir, filename);
  try {
    await fs.writeFile(tmpIn, buffer);
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i", tmpIn,
        "-vf", "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "26",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        tmpOut,
      ],
      { timeout: 120_000 }
    );
    return { filename, mime: "video/mp4" };
  } catch {
    await fs.unlink(tmpOut).catch(() => undefined);
    return null;
  } finally {
    await fs.unlink(tmpIn).catch(() => undefined);
  }
}

async function buildPdfPreviewImage(pdfPath: string, previewFilename: string, uploadDir: string) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-preview-"));
  try {
    const prefix = path.join(tmpDir, "page");
    await execFileAsync(
      "pdftoppm",
      [
        "-png",
        "-f",
        "1",
        "-l",
        "20", // protect memory/runtime for unusually large PDFs
        pdfPath,
        prefix,
      ],
      { timeout: 120_000 }
    );

    const files = (await fs.readdir(tmpDir))
      .filter((name) => /^page-\d+\.png$/i.test(name))
      .sort((a, b) => Number(a.match(/\d+/)?.[0] ?? "0") - Number(b.match(/\d+/)?.[0] ?? "0"));
    if (!files.length) return;

    const rendered: Array<{ data: Buffer; width: number; height: number }> = [];
    for (const file of files) {
      const source = path.join(tmpDir, file);
      const buffer = await sharp(source)
        .rotate()
        .flatten({ background: "#ffffff" })
        // Remove oversized white margins that some DLS PDFs contain, otherwise
        // the preview looks like a blank page with a thin strip on one side.
        .trim({ threshold: 12 })
        .resize({ width: 1400, withoutEnlargement: true })
        .png()
        .toBuffer();
      const meta = await sharp(buffer).metadata();
      if (!meta.width || !meta.height) continue;
      rendered.push({ data: buffer, width: meta.width, height: meta.height });
    }
    if (!rendered.length) return;

    const width = Math.max(...rendered.map((item) => item.width));
    const height = rendered.reduce((sum, item) => sum + item.height, 0);
    let offsetY = 0;
    const composite = rendered.map((item) => {
      const top = offsetY;
      offsetY += item.height;
      return { input: item.data, left: 0, top };
    });

    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: "#ffffff",
      },
    })
      .composite(composite)
      .webp({ quality: 84 })
      .toFile(path.join(uploadDir, previewFilename));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Best-effort delete of uploaded files by their public /uploads/<file> URL. Never throws. */
export async function deleteUploadedFiles(urls: (string | null | undefined)[], uploadDir: string) {
  await Promise.all(
    urls.filter((u): u is string => Boolean(u?.startsWith("/uploads/"))).map(async (url) => {
      const filename = url.replace("/uploads/", "");
      if (filename.includes("/") || filename.includes("..")) return;
      await fs.unlink(path.join(uploadDir, filename)).catch(() => undefined);
      // Documents may have a generated stitched preview sibling.
      const pdfMatch = filename.match(/^(.+)\.pdf$/i);
      if (pdfMatch) {
        const [, stem] = pdfMatch;
        await fs.unlink(path.join(uploadDir, `${stem}-preview.webp`)).catch(() => undefined);
      }
      // Images are stored as <id>-lg/-md/-sm.webp siblings — delete the other two tiers too.
      const sizeMatch = filename.match(/^(.+)-(sm|md|lg)\.webp$/);
      if (sizeMatch) {
        const [, stem] = sizeMatch;
        for (const tier of ["sm", "md", "lg"]) {
          await fs.unlink(path.join(uploadDir, `${stem}-${tier}.webp`)).catch(() => undefined);
        }
      }
    })
  );
}
