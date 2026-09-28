import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../prisma";
import { requireAdmin } from "../middleware/auth";
import { audit } from "../lib/audit";
import { asyncHandler } from "../lib/asyncHandler";
import { deleteUploadedFiles } from "../lib/uploadSecurity";

export const adminMediaRouter = Router();
adminMediaRouter.use(requireAdmin);

const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

async function usedUrls(): Promise<Set<string>> {
  const [media, submissions, standby, listings] = await Promise.all([
    prisma.media.findMany({ select: { url: true } }),
    prisma.submission.findMany({ select: { images: true, video: true, document: true } }),
    prisma.standbyImage.findMany({ select: { url: true } }),
    prisma.listing.findMany({ select: { mainImage: true } }),
  ]);
  const set = new Set<string>();
  media.forEach((m) => set.add(m.url));
  standby.forEach((s) => set.add(s.url));
  listings.forEach((l) => {
    if (l.mainImage) set.add(l.mainImage);
  });
  submissions.forEach((s) => {
    s.images.forEach((u) => set.add(u));
    if (s.video) set.add(s.video);
    if (s.document) set.add(s.document);
  });
  return set;
}

adminMediaRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [files, used] = await Promise.all([fs.readdir(UPLOAD_DIR).catch(() => [] as string[]), usedUrls()]);
    const items = await Promise.all(
      files
        // The -sm/-md tiers are derived srcset variants of a -lg upload, not
        // independent files — list only the -lg (or a pre-migration bare filename).
        .filter((f) => f !== ".gitkeep" && !/-(sm|md)\.webp$/.test(f))
        .map(async (filename) => {
          const stat = await fs.stat(path.join(UPLOAD_DIR, filename)).catch(() => null);
          const url = `/uploads/${filename}`;
          return {
            filename,
            url,
            size: stat?.size ?? 0,
            modifiedAt: stat?.mtime ?? null,
            used: used.has(url),
          };
        })
    );
    items.sort((a, b) => (b.modifiedAt?.getTime() ?? 0) - (a.modifiedAt?.getTime() ?? 0));
    res.json(items);
  })
);

adminMediaRouter.delete(
  "/:filename",
  asyncHandler(async (req, res) => {
    const filename = req.params.filename;
    if (filename.includes("/") || filename.includes("..")) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }
    const used = await usedUrls();
    if (used.has(`/uploads/${filename}`)) {
      res.status(409).json({ error: "File is still referenced by a listing or submission" });
      return;
    }
    await deleteUploadedFiles([`/uploads/${filename}`], UPLOAD_DIR);
    await audit({ actorEmail: req.session!.email, action: "media.delete", targetType: "file", targetId: filename, ip: req.ip });
    res.status(204).end();
  })
);
