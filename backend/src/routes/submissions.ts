import { Router } from "express";
import multer from "multer";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma";
import { listingKey } from "../lib/listingNo";
import { validateAndStore, UploadValidationError } from "../lib/uploadSecurity";
import { getSettings } from "../lib/settings";
import { asyncHandler } from "../lib/asyncHandler";
import { nextSubmissionSerial, nextTrackingCode } from "../lib/submissionCode";
import { sendMail } from "../lib/mailer";
import { audit } from "../lib/audit";
import { industryTypeEnum } from "../lib/industryTypes";
import { trackingEmail } from "../lib/emailTemplates";
import { locationFieldsSchema, legacyCoordinates } from "../lib/location";
import { lookupDlsAdministrativeValue, DlsLookupError } from "../lib/dlsAdministrativeValue";
import {
  lookupDlsParcelByPoint,
  lookupDlsParcelContextByPoint,
  lookupDlsParcelLocation,
  DlsParcelLocationError,
} from "../lib/dlsParcelLocation";
import { lookupAmmanZoning, AmmanZoningLookupError } from "../lib/ammanZoning";
import { normalizeDecimalInput, toWesternDigits, westernDigitsString } from "../lib/arabicDigits";
import { assertValidMultiParcel, canonicalParcelList } from "../lib/multiParcel";
import { syncIndustryTypeCatalogOnce } from "../lib/industryTypeCatalog";

export const submissionsRouter = Router();
const PRICE_PER_SQM_RE = /^\d+(\.\d+)?$/;

const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions from this address. Please try again later." },
});

const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many tracking lookups from this address. Please try again later." },
});

// Each hit drives a real headless-browser session against the DLS site — kept
// modest even for anonymous callers so this public form is never mistaken for
// abusive traffic against a government service.
const dlsValueLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many lookups — please wait a few minutes and try again." },
});

// Lightweight ArcGIS HTTP queries — still capped so a public form can't be
// used to hammer the government map service.
const dlsLocationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many map lookups — please wait a few minutes and try again." },
});

const dlsValueSchema = z.object({
  governorate: z.string().min(1),
  directorate: z.string().min(1),
  village: z.string().min(1),
  basin: z.string().min(1),
  neighborhood: z.string().min(1),
  parcelNumber: westernDigitsString(z.string().min(1)),
});

const dlsLocationSchema = z.object({
  villageCode: westernDigitsString(z.string().min(1)),
  basinCode: westernDigitsString(z.string().min(1)),
  sectorCode: westernDigitsString(z.string().min(1)),
  parcelNumber: westernDigitsString(z.string().min(1)),
});

const dlsPointSchema = z.object({
  latitude: z.coerce.number().finite().gte(-90).lte(90),
  longitude: z.coerce.number().finite().gte(-180).lte(180),
});

const ammanZoningSchema = z
  .object({
    latitude: z.coerce.number().finite().gte(-90).lte(90).optional(),
    longitude: z.coerce.number().finite().gte(-180).lte(180).optional(),
    villageCode: westernDigitsString(z.string().min(1)).optional(),
    basinCode: westernDigitsString(z.string().min(1)).optional(),
    sectorCode: westernDigitsString(z.string().min(1)).optional(),
    parcelNumber: westernDigitsString(z.string().min(1)).optional(),
  })
  .superRefine((value, ctx) => {
    const hasPoint = value.latitude != null && value.longitude != null;
    const hasParcelIdentity =
      Boolean(value.villageCode?.trim()) &&
      Boolean(value.basinCode?.trim()) &&
      Boolean(value.sectorCode?.trim()) &&
      Boolean(value.parcelNumber?.trim());
    if (!hasPoint && !hasParcelIdentity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either latitude/longitude or full parcel identity values",
      });
    }
  });

submissionsRouter.post(
  "/dls-value",
  dlsValueLimiter,
  asyncHandler(async (req, res) => {
    const input = dlsValueSchema.parse(req.body);
    try {
      const result = await lookupDlsAdministrativeValue(input);
      if (!result) {
        res.status(404).json({
          error: "No data found for this parcel — please check the parcel or neighborhood number and change it",
        });
        return;
      }
      res.json(result);
    } catch (err) {
      if (err instanceof DlsLookupError) {
        res.status(502).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

submissionsRouter.post(
  "/dls-location",
  dlsLocationLimiter,
  asyncHandler(async (req, res) => {
    const input = dlsLocationSchema.parse(req.body);
    try {
      const result = await lookupDlsParcelLocation(input);
      if (!result) {
        res.status(404).json({
          error: "No map geometry found for this parcel — please check the land identity values",
        });
        return;
      }
      res.json(result);
    } catch (err) {
      if (err instanceof DlsParcelLocationError) {
        res.status(502).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

submissionsRouter.post(
  "/dls-location-by-point",
  dlsLocationLimiter,
  asyncHandler(async (req, res) => {
    const input = dlsPointSchema.parse(req.body);
    try {
      const result = await lookupDlsParcelByPoint(input);
      if (!result) {
        res.status(404).json({
          error: "No parcel found at this map point — move the pin inside a parcel boundary",
        });
        return;
      }
      res.json(result);
    } catch (err) {
      if (err instanceof DlsParcelLocationError) {
        res.status(502).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

submissionsRouter.post(
  "/dls-context-by-point",
  dlsLocationLimiter,
  asyncHandler(async (req, res) => {
    const input = dlsPointSchema.parse(req.body);
    try {
      const result = await lookupDlsParcelContextByPoint(input);
      res.json({ parcels: result });
    } catch (err) {
      if (err instanceof DlsParcelLocationError) {
        res.status(502).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

submissionsRouter.post(
  "/amman-zoning",
  dlsLocationLimiter,
  asyncHandler(async (req, res) => {
    ammanZoningSchema.parse(req.body);
    try {
      await lookupAmmanZoning({});
      res.status(410).json({ error: "Live Amman City GIS lookup is disabled" });
    } catch (err) {
      if (err instanceof AmmanZoningLookupError) {
        res.status(410).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

submissionsRouter.get(
  "/industry-types-catalog",
  asyncHandler(async (_req, res) => {
    await syncIndustryTypeCatalogOnce(prisma);
    const rows = await prisma.industryTypeCatalog.findMany({
      orderBy: { industryType: "asc" },
    });
    res.json(rows);
  })
);

submissionsRouter.get(
  "/track/:code",
  trackLimiter,
  asyncHandler(async (req, res) => {
    const code = toWesternDigits(req.params.code.trim()).toUpperCase();
    const submission = await prisma.submission.findUnique({ where: { trackingCode: code } });
    if (!submission) {
      res.status(404).json({ error: "No request found for this tracking code" });
      return;
    }
    res.json({
      serialNo: submission.serialNo,
      status: submission.status,
      submittedAt: submission.submittedAt,
      reviewedAt: submission.reviewedAt,
      reviewNote: submission.status === "needs_info" ? submission.reviewNote : null,
      village: submission.village,
      convertedListingId: submission.convertedListingId,
    });
  })
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "application/pdf",
    ];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

const submissionInputSchema = z.object({
  source: z.enum(["owner", "broker"]),
  applicant: z.string().min(1),
  phone: westernDigitsString(z.string().min(1)),
  office: z.string().optional(),
  whatsapp: westernDigitsString(z.string().optional()),
  email: z.string().optional(),
  authExpiry: z.string().optional(),
  governorate: z.string().optional(),
  directorate: z.string().optional(),
  village: z.string().optional(),
  basin: z.string().optional(),
  parcel: westernDigitsString(z.string().optional()),
  neighborhood: z.string().optional(),
  coordinates: westernDigitsString(z.string().optional()),
  area: westernDigitsString(z.string().optional()),
  price: z.preprocess(
    (value) => (typeof value === "string" ? normalizeDecimalInput(value) : value),
    z.string().optional()
  ).refine(
    (value) => value === undefined || value.trim() === "" || PRICE_PER_SQM_RE.test(value.trim()),
    "Price must be a number per square meter (m²)."
  ),
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
  dlsKey: westernDigitsString(z.string().optional()),
  industryType: z.enum(industryTypeEnum).optional(),
  activity: z.string().optional(),
  details: z.string().min(1),
}).and(locationFieldsSchema);

submissionsRouter.post(
  "/",
  submissionLimiter,
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "video", maxCount: 1 },
    { name: "document", maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    if (settings.submissionsEnabled !== "true") {
      res.status(403).json({ error: "Submissions are temporarily closed" });
      return;
    }

    const input = submissionInputSchema.parse(req.body);
    const parcelValidation = assertValidMultiParcel(input.parcel);
    if (!parcelValidation.ok) {
      res.status(400).json({ error: parcelValidation.error });
      return;
    }
    const normalizedParcel = canonicalParcelList(input.parcel) ?? input.parcel;
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;

    let images: string[] = [];
    let video: string | undefined;
    let document: string | undefined;

    try {
      if (files?.images?.length) {
        images = await Promise.all(
          files.images.map(async (file) => {
            const { filename } = await validateAndStore(file.buffer, "image", UPLOAD_DIR);
            return `/uploads/${filename}`;
          })
        );
      }
      if (files?.video?.[0]) {
        const { filename } = await validateAndStore(files.video[0].buffer, "video", UPLOAD_DIR);
        video = `/uploads/${filename}`;
      }
      if (files?.document?.[0]) {
        const { filename } = await validateAndStore(files.document[0].buffer, "document", UPLOAD_DIR);
        document = `/uploads/${filename}`;
      }
    } catch (err) {
      if (err instanceof UploadValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    const key = listingKey(input.village, input.basin, normalizedParcel);
    let duplicate = false;
    if (input.village && input.basin && normalizedParcel) {
      const existing = await prisma.submission.findMany({
        where: { status: { not: "rejected" } },
        select: { village: true, basin: true, parcel: true },
      });
      duplicate = existing.some((row) => listingKey(row.village, row.basin, row.parcel) === key);
    }

    const [serialNo, trackingCode] = await Promise.all([nextSubmissionSerial(prisma), nextTrackingCode(prisma)]);

    const submission = await prisma.submission.create({
      data: {
        ...input,
        parcel: normalizedParcel,
        coordinates: legacyCoordinates(input.latitude, input.longitude) ?? input.coordinates,
        serialNo,
        trackingCode,
        images,
        video,
        document,
        duplicate,
        status: duplicate ? "duplicate_review" : "pending",
      },
    });

    if (input.email) {
      const lang = req.cookies?.lang === "en" ? "en" : "ar";
      const { subject, text, html } = trackingEmail({ lang, applicant: input.applicant, serialNo, trackingCode });
      const sent = await sendMail({ to: input.email, subject, text, html });
      await audit({
        actorEmail: "system",
        action: sent ? "submission.tracking_email_sent" : "submission.tracking_email_failed",
        targetType: "submission",
        targetId: submission.id,
        metadata: { email: input.email, serialNo },
        ip: req.ip,
      });
    }

    res.status(201).json(submission);
  })
);
