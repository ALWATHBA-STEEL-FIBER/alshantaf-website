import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAdmin, requirePermission } from "../middleware/auth";
import { audit } from "../lib/audit";
import { asyncHandler } from "../lib/asyncHandler";

export const adminStandbyRouter = Router();
adminStandbyRouter.use(requireAdmin);
adminStandbyRouter.use(requirePermission("media"));

adminStandbyRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await prisma.standbyImage.findMany({ orderBy: { createdAt: "desc" } });
    res.json(items);
  })
);

const createSchema = z.object({
  url: z.string().min(1).refine((u) => u.startsWith("/uploads/"), { message: "Standby images must be uploaded files" }),
  title: z.string().trim().max(120).optional().nullable(),
});

adminStandbyRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const existing = await prisma.standbyImage.findUnique({ where: { url: input.url } });
    if (existing) {
      res.json(existing);
      return;
    }
    const item = await prisma.standbyImage.create({
      data: { url: input.url, title: input.title || null },
    });
    await audit({
      actorEmail: req.session!.email,
      action: "standby.create",
      targetType: "standby",
      targetId: item.id,
      metadata: { url: item.url, title: item.title },
      ip: req.ip,
    });
    res.status(201).json(item);
  })
);

adminStandbyRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = await prisma.standbyImage.findUnique({ where: { id: req.params.id } });
    if (!item) {
      res.status(404).json({ error: "Standby image not found" });
      return;
    }
    await prisma.standbyImage.delete({ where: { id: item.id } });
    await audit({
      actorEmail: req.session!.email,
      action: "standby.delete",
      targetType: "standby",
      targetId: item.id,
      metadata: { url: item.url },
      ip: req.ip,
    });
    res.status(204).end();
  })
);
