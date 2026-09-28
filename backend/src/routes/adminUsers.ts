import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAdmin } from "../middleware/auth";
import { audit } from "../lib/audit";
import { asyncHandler } from "../lib/asyncHandler";
import { westernDigitsString } from "../lib/arabicDigits";

export const adminUsersRouter = Router();
adminUsersRouter.use(requireAdmin);

const userSelect = { id: true, email: true, name: true, phone: true, whatsapp: true, createdAt: true } as const;

adminUsersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: "asc" },
    });
    res.json(users);
  })
);

const phoneField = westernDigitsString(
  z
    .string()
    .trim()
    .regex(/^[0-9+\s()-]+$/, "Digits only")
    .optional()
    .or(z.literal(""))
);

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  phone: phoneField,
  whatsapp: phoneField,
});

adminUsersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      res.status(409).json({ error: "An admin with this email already exists" });
      return;
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        phone: input.phone || null,
        whatsapp: input.whatsapp || input.phone || null,
      },
      select: userSelect,
    });
    await audit({
      actorEmail: req.session!.email,
      action: "admin_user.create",
      targetType: "user",
      targetId: user.id,
      metadata: { email: user.email },
      ip: req.ip,
    });
    res.status(201).json(user);
  })
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: phoneField,
  whatsapp: phoneField,
});

adminUsersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Admin not found" });
      return;
    }
    const nextPhone = input.phone !== undefined ? input.phone || null : target.phone;
    const nextWhatsapp = input.whatsapp !== undefined ? input.whatsapp || nextPhone : target.whatsapp;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: nextPhone } : {}),
        whatsapp: nextWhatsapp,
      },
      select: userSelect,
    });
    await audit({
      actorEmail: req.session!.email,
      action: "admin_user.update",
      targetType: "user",
      targetId: user.id,
      metadata: { email: user.email },
      ip: req.ip,
    });
    res.json(user);
  })
);

adminUsersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.params.id === req.session!.userId) {
      res.status(400).json({ error: "You cannot remove your own admin account" });
      return;
    }
    const total = await prisma.user.count();
    if (total <= 1) {
      res.status(400).json({ error: "At least one admin account must remain" });
      return;
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Admin not found" });
      return;
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    await audit({
      actorEmail: req.session!.email,
      action: "admin_user.delete",
      targetType: "user",
      targetId: target.id,
      metadata: { email: target.email },
      ip: req.ip,
    });
    res.status(204).end();
  })
);
