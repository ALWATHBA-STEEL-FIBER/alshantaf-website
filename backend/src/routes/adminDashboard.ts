import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../prisma";
import { requireAdmin, requirePermission } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";

export const adminDashboardRouter = Router();
adminDashboardRouter.use(requireAdmin);
adminDashboardRouter.use(requirePermission("dashboard"));

const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

adminDashboardRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [
      listingsByPublish,
      listingsByStatus,
      submissionsByStatus,
      landChecksByStatus,
      contactByStatus,
      recentAudit,
      uploadFiles,
    ] = await Promise.all([
      prisma.listing.groupBy({ by: ["publishStatus"], _count: true }),
      prisma.listing.groupBy({ by: ["status"], _count: true }),
      prisma.submission.groupBy({ by: ["status"], _count: true }),
      prisma.landCheck.groupBy({ by: ["status"], _count: true }),
      prisma.contactRequest.groupBy({ by: ["status"], _count: true }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
      fs.readdir(UPLOAD_DIR).catch(() => [] as string[]),
    ]);

    const files = uploadFiles.filter((f) => f !== ".gitkeep");
    let totalBytes = 0;
    for (const f of files) {
      totalBytes += await fs.stat(path.join(UPLOAD_DIR, f)).then((s) => s.size).catch(() => 0);
    }

    const toCountMap = (rows: { _count: number }[], keyField: string) =>
      Object.fromEntries(rows.map((r) => [(r as never)[keyField], r._count]));

    res.json({
      listings: {
        total: listingsByPublish.reduce((n, r) => n + r._count, 0),
        byPublishStatus: toCountMap(listingsByPublish, "publishStatus"),
        byStatus: toCountMap(listingsByStatus, "status"),
      },
      submissions: {
        total: submissionsByStatus.reduce((n, r) => n + r._count, 0),
        byStatus: toCountMap(submissionsByStatus, "status"),
      },
      landChecks: {
        total: landChecksByStatus.reduce((n, r) => n + r._count, 0),
        byStatus: toCountMap(landChecksByStatus, "status"),
      },
      contactRequests: {
        total: contactByStatus.reduce((n, r) => n + r._count, 0),
        byStatus: toCountMap(contactByStatus, "status"),
      },
      storage: { fileCount: files.length, totalBytes },
      recentAudit,
    });
  })
);
