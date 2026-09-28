import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";

export const adminAuditRouter = Router();
adminAuditRouter.use(requireAdmin);

const querySchema = z.object({
  action: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

adminAuditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = querySchema.parse(req.query);
    const logs = await prisma.auditLog.findMany({
      where: query.action ? { action: { startsWith: query.action } } : undefined,
      orderBy: { createdAt: "desc" },
      take: query.limit,
    });
    res.json(logs);
  })
);
