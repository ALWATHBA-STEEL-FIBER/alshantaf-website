import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { audit } from "../lib/audit";

export const adminLandChecksRouter = Router();
adminLandChecksRouter.use(requireAdmin);

const listSchema = z.object({
  status: z.enum(["new", "contacted", "closed"]).optional(),
  q: z.string().optional(),
});

adminLandChecksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listSchema.parse(req.query);
    const checks = await prisma.landCheck.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.q
          ? {
              OR: [
                { serialNo: { contains: query.q, mode: "insensitive" } },
                { name: { contains: query.q, mode: "insensitive" } },
                { phone: { contains: query.q, mode: "insensitive" } },
                { village: { contains: query.q, mode: "insensitive" } },
                { parcel: { contains: query.q, mode: "insensitive" } },
                { basin: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(checks);
  })
);

const patchSchema = z.object({
  status: z.enum(["new", "contacted", "closed"]).optional(),
  adminNotes: z.string().max(4000).optional().nullable(),
});

adminLandChecksRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = patchSchema.parse(req.body);
    const existing = await prisma.landCheck.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Land check not found" });
      return;
    }

    const updated = await prisma.landCheck.update({
      where: { id: req.params.id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes } : {}),
        ...(input.status && input.status !== existing.status
          ? { reviewer: req.session!.email, reviewedAt: new Date() }
          : {}),
      },
    });

    await audit({
      actorEmail: req.session!.email,
      action: "landcheck.update",
      targetType: "landcheck",
      targetId: updated.id,
      metadata: { serialNo: updated.serialNo, status: updated.status },
      ip: req.ip,
    });

    res.json(updated);
  })
);

adminLandChecksRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.landCheck.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Land check not found" });
      return;
    }
    await prisma.landCheck.delete({ where: { id: req.params.id } });
    await audit({
      actorEmail: req.session!.email,
      action: "landcheck.delete",
      targetType: "landcheck",
      targetId: existing.id,
      metadata: { serialNo: existing.serialNo },
      ip: req.ip,
    });
    res.json({ ok: true });
  })
);
