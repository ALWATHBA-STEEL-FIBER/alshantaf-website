import { Router } from "express";
import { prisma } from "../prisma";
import { asyncHandler } from "../lib/asyncHandler";

export const teamRouter = Router();

teamRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const admins = await prisma.user.findMany({
      where: { phone: { not: null } },
      select: { name: true, phone: true, whatsapp: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(admins);
  })
);
