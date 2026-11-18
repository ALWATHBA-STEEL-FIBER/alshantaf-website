import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { nextLandCheckSerial } from "../lib/submissionCode";
import { locationFieldsSchema, legacyCoordinates } from "../lib/location";
import { toWesternDigits, westernDigitsString } from "../lib/arabicDigits";
import { audit } from "../lib/audit";
import { industryTypeEnum } from "../lib/industryTypes";
import { requireBotGuard } from "../middleware/botGuard";

export const landChecksRouter = Router();

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many land checks from this address. Please try again later." },
});

const draftLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many draft saves. Please wait a moment." },
});

const industryEnum = z.enum(industryTypeEnum);

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

const landPayloadSchema = z
  .object({
    clientKey: z.string().trim().min(8).max(80).optional(),
    name: optionalText(120),
    phone: westernDigitsString(z.string().trim().max(40).optional()),
    email: z.string().trim().email().optional().or(z.literal("")),
    governorate: optionalText(120),
    directorate: optionalText(120),
    village: optionalText(120),
    basin: optionalText(120),
    neighborhood: optionalText(120),
    parcel: westernDigitsString(z.string().trim().max(40).optional()),
    coordinates: westernDigitsString(z.string().optional()),
    address: optionalText(300),
    dlsKey: westernDigitsString(z.string().optional()),
    areaSqm: z.preprocess((value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      if (typeof value === "string") return toWesternDigits(value);
      return value;
    }, z.coerce.number().finite().positive().optional()),
    areaLabel: westernDigitsString(z.string().optional()),
    perimeterM: z.preprocess((value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      if (typeof value === "string") return toWesternDigits(value);
      return value;
    }, z.coerce.number().finite().positive().optional()),
    administrativeValue: z.preprocess((value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      if (typeof value === "string") return toWesternDigits(value);
      return value;
    }, z.coerce.number().finite().optional()),
    administrativeValueSource: z.string().optional(),
    administrativeValueAt: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : value),
      z.coerce.date().optional()
    ),
    estimatedMedian: z.preprocess((value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      if (typeof value === "string") return toWesternDigits(value);
      return value;
    }, z.coerce.number().finite().optional()),
    industryType: industryEnum.optional(),
    notes: optionalText(2000),
  })
  .and(locationFieldsSchema);

function emptyToNull(value?: string | null) {
  const v = value?.trim();
  return v ? v : null;
}

function toLandCheckData(input: z.infer<typeof landPayloadSchema>, opts: { isDraft: boolean; clientKey?: string | null }) {
  return {
    isDraft: opts.isDraft,
    ...(opts.clientKey !== undefined ? { clientKey: opts.clientKey } : {}),
    name: emptyToNull(input.name),
    phone: emptyToNull(input.phone),
    email: emptyToNull(input.email),
    governorate: emptyToNull(input.governorate),
    directorate: emptyToNull(input.directorate),
    village: emptyToNull(input.village),
    basin: emptyToNull(input.basin),
    neighborhood: emptyToNull(input.neighborhood),
    parcel: emptyToNull(input.parcel),
    coordinates: legacyCoordinates(input.latitude, input.longitude) ?? emptyToNull(input.coordinates),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    address: emptyToNull(input.address),
    dlsKey: emptyToNull(input.dlsKey),
    areaSqm: input.areaSqm ?? null,
    areaLabel: emptyToNull(input.areaLabel),
    perimeterM: input.perimeterM ?? null,
    administrativeValue: input.administrativeValue ?? null,
    administrativeValueSource: emptyToNull(input.administrativeValueSource),
    administrativeValueAt: input.administrativeValueAt ?? null,
    estimatedMedian: input.estimatedMedian ?? null,
    industryType: input.industryType ?? null,
    notes: emptyToNull(input.notes),
  };
}

function hasAnyContent(input: z.infer<typeof landPayloadSchema>) {
  return Boolean(
    emptyToNull(input.name) ||
      emptyToNull(input.phone) ||
      emptyToNull(input.email) ||
      emptyToNull(input.governorate) ||
      emptyToNull(input.directorate) ||
      emptyToNull(input.village) ||
      emptyToNull(input.basin) ||
      emptyToNull(input.neighborhood) ||
      emptyToNull(input.parcel) ||
      emptyToNull(input.coordinates) ||
      emptyToNull(input.address) ||
      emptyToNull(input.notes) ||
      input.industryType ||
      input.areaSqm != null ||
      input.administrativeValue != null ||
      input.latitude != null
  );
}

/** Auto-save / upsert draft — records fields even before the user clicks Save. */
landChecksRouter.post(
  "/draft",
  draftLimiter,
  asyncHandler(async (req, res) => {
    const input = landPayloadSchema.parse(req.body);
    if (!input.clientKey) {
      res.status(400).json({ error: "clientKey is required for drafts" });
      return;
    }
    if (!hasAnyContent(input)) {
      res.json({ ok: true, skipped: true });
      return;
    }

    const existing = await prisma.landCheck.findUnique({ where: { clientKey: input.clientKey } });
    // Don't overwrite a finalized check from the same browser key.
    if (existing && !existing.isDraft) {
      res.json({ id: existing.id, serialNo: existing.serialNo, isDraft: false });
      return;
    }

    const data = toLandCheckData(input, { isDraft: true, clientKey: input.clientKey });
    const check = existing
      ? await prisma.landCheck.update({ where: { id: existing.id }, data })
      : await prisma.landCheck.create({
          data: { ...data, serialNo: await nextLandCheckSerial(prisma) },
        });

    res.json({ id: check.id, serialNo: check.serialNo, isDraft: check.isDraft });
  })
);

landChecksRouter.post(
  "/",
  createLimiter,
  requireBotGuard("land_check"),
  asyncHandler(async (req, res) => {
    const input = landPayloadSchema.parse(req.body);
    if (!input.governorate || !input.directorate || !input.village || !input.basin || !input.neighborhood || !input.parcel) {
      res.status(400).json({ error: "Complete parcel identity before saving" });
      return;
    }

    const data = toLandCheckData(input, {
      isDraft: false,
      clientKey: input.clientKey || null,
    });

    let check;
    if (input.clientKey) {
      const existing = await prisma.landCheck.findUnique({ where: { clientKey: input.clientKey } });
      if (existing) {
        check = await prisma.landCheck.update({
          where: { id: existing.id },
          data: { ...data, isDraft: false },
        });
      }
    }

    if (!check) {
      check = await prisma.landCheck.create({
        data: { ...data, serialNo: await nextLandCheckSerial(prisma) },
      });
    }

    await audit({
      actorEmail: input.email || input.phone || "public",
      action: "landcheck.create",
      targetType: "landcheck",
      targetId: check.id,
      metadata: {
        serialNo: check.serialNo,
        village: check.village,
        basin: check.basin,
        parcel: check.parcel,
        industryType: check.industryType,
        wasDraft: Boolean(input.clientKey),
      },
      ip: req.ip,
    });

    res.status(201).json({
      id: check.id,
      serialNo: check.serialNo,
      createdAt: check.createdAt,
    });
  })
);
