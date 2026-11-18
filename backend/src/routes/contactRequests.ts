import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { nextContactRequestSerial } from "../lib/submissionCode";
import { westernDigitsString } from "../lib/arabicDigits";
import { audit } from "../lib/audit";
import { requireBotGuard } from "../middleware/botGuard";

export const contactRequestsRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many contact requests from this address. Please try again later." },
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: westernDigitsString(z.string().trim().min(6).max(40)),
  requestType: z.string().trim().min(1).max(80),
  industryType: z.string().trim().max(120).optional().or(z.literal("")),
  activityType: z.string().trim().max(120).optional().or(z.literal("")),
  details: z.string().trim().min(1).max(4000),
});

contactRequestsRouter.post(
  "/",
  limiter,
  requireBotGuard("contact"),
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const serialNo = await nextContactRequestSerial(prisma);
    const row = await prisma.contactRequest.create({
      data: {
        serialNo,
        name: input.name,
        phone: input.phone,
        requestType: input.requestType,
        industryType: input.industryType || null,
        activityType: input.activityType || null,
        details: input.details,
      },
    });

    await audit({
      actorEmail: input.phone,
      action: "contact.create",
      targetType: "contact_request",
      targetId: row.id,
      metadata: { serialNo: row.serialNo, requestType: row.requestType },
      ip: req.ip,
    });

    res.status(201).json({ id: row.id, serialNo: row.serialNo, createdAt: row.createdAt });
  })
);
