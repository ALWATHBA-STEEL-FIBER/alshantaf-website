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

/** Best-effort delete of uploaded files by their public /uploads/<file> URL. Never throws. */
export async function deleteUploadedFiles(urls: (string | null | undefined)[], uploadDir: string) {
  await Promise.all(
    urls.filter((u): u is string => Boolean(u?.startsWith("/uploads/"))).map(async (url) => {
      const filename = url.replace("/uploads/", "");
      if (filename.includes("/") || filename.includes("..")) return;
      await fs.unlink(path.join(uploadDir, filename)).catch(() => undefined);
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
