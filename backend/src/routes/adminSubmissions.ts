import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAdmin, requirePermission } from "../middleware/auth";
import { nextListingNo } from "../lib/listingNo";
import { nextOwnerAccessCode } from "../lib/ownerAccess";
import { notifyListingOwner, smsPublished } from "../lib/listingNotify";
import { audit } from "../lib/audit";
import { asyncHandler } from "../lib/asyncHandler";
import { INDUSTRY_TYPES, type IndustryTypeKey } from "../lib/industryTypes";
import { toWesternDigits, westernDigitsString } from "../lib/arabicDigits";
import { assertValidMultiParcel, canonicalParcelList } from "../lib/multiParcel";

export const adminSubmissionsRouter = Router();
adminSubmissionsRouter.use(requireAdmin);
adminSubmissionsRouter.use(requirePermission("submissions"));

const listSchema = z.object({
  status: z.string().optional(),
  q: z.string().optional(),
});

adminSubmissionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listSchema.parse(req.query);
    const submissions = await prisma.submission.findMany({
      where: {
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.q
          ? {
              OR: [
                { applicant: { contains: query.q, mode: "insensitive" } },
                { village: { contains: query.q, mode: "insensitive" } },
                { parcel: { contains: query.q, mode: "insensitive" } },
                { basin: { contains: query.q, mode: "insensitive" } },
                { office: { contains: query.q, mode: "insensitive" } },
                { serialNo: { contains: query.q, mode: "insensitive" } },
                { trackingCode: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { submittedAt: "desc" },
    });
    res.json(submissions);
  })
);

const updateSchema = z.object({
  status: z.enum(["pending", "duplicate_review", "needs_info", "approved", "rejected"]).optional(),
  reviewer: z.string().optional(),
  reviewNote: z.string().optional(),
});

adminSubmissionsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const submission = await prisma.submission.update({
      where: { id: req.params.id },
      data: { ...input, reviewedAt: new Date() },
    });
    await audit({
      actorEmail: req.session!.email,
      action: "submission.update",
      targetType: "submission",
      targetId: submission.id,
      metadata: {
        ...input,
        applicant: submission.applicant,
        village: submission.village,
        parcel: submission.parcel,
      },
      ip: req.ip,
    });
    res.json(submission);
  })
);

const industryLabelToKey: Record<string, IndustryTypeKey> = Object.fromEntries(
  INDUSTRY_TYPES.map((key) => [key, key])
) as Record<string, IndustryTypeKey>;
const PRICE_PER_SQM_RE = /^\d+(\.\d+)?$/;

const approveSchema = z.object({
  publish: z.boolean().default(true),
  includeParcel: z.boolean().default(false),
  includePrice: z.boolean().default(true),
  includeDocument: z.boolean().default(false),
  includeVideo: z.boolean().default(true),
  /** When false, public offer hides DLS mid-range estimate (rate × area). */
  showEstimatedValue: z.boolean().default(true),
  imageUrls: z.array(z.string()).default([]),
  /** Optional overrides applied before the listing is created. */
  edits: z
    .object({
      title: z.string().min(1).max(120).optional(),
      price: westernDigitsString(z.string().max(80).optional()),
      description: z.string().min(1).max(1800).optional(),
      phone: westernDigitsString(z.string().max(40).optional()),
      village: z.string().max(120).optional(),
      basin: z.string().max(120).optional(),
      neighborhood: z.string().max(120).optional(),
      parcel: westernDigitsString(z.string().max(40).optional()),
    })
    .optional(),
});

adminSubmissionsRouter.post(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const input = approveSchema.parse(req.body);
    const submission = await prisma.submission.findUnique({ where: { id: req.params.id } });
    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }
    if (submission.convertedListingId) {
      res.status(409).json({ error: "Submission already converted" });
      return;
    }

    // Accept submission images and curated standby library URLs only —
    // never trust the client to smuggle in arbitrary media references.
    const standby = await prisma.standbyImage.findMany({ select: { url: true } });
    const allowed = new Set<string>([...submission.images, ...standby.map((s) => s.url)]);
    const images = input.imageUrls.filter((url) => allowed.has(url));

    const edits = input.edits ?? {};
    const parcelCandidate = edits.parcel?.trim() || submission.parcel;
    const parcelValidation = assertValidMultiParcel(parcelCandidate);
    if (!parcelValidation.ok) {
      res.status(400).json({ error: parcelValidation.error });
      return;
    }
    const normalizedParcel = canonicalParcelList(parcelCandidate) ?? parcelCandidate;
    if (input.includePrice && edits.price && !PRICE_PER_SQM_RE.test(toWesternDigits(edits.price.trim()))) {
      res.status(400).json({ error: "Price must be a number per square meter (m²)." });
      return;
    }
    const village = edits.village?.trim() || submission.village;
    const area = village || "منطقة أخرى";
    const listingNo = await nextListingNo(prisma, area);
    const ownerAccessCode = await nextOwnerAccessCode(prisma);
    const industryType = submission.industryType
      ? industryLabelToKey[submission.industryType] ?? "light"
      : "light";

    // The structured fields are generated into Prisma's client when migrations
    // are deployed; keep this explicit bridge for the repository's checked-in
    // client, which may predate the migration during a local type-only build.
    const structuredSubmission = submission as typeof submission & {
      latitude: number | null;
      longitude: number | null;
      address: string | null;
      administrativeValue: number | null;
      administrativeValueSource: string | null;
      administrativeValueAt: Date | null;
    };
    const listing = await prisma.listing.create({
      data: {
        listingNo,
        title:
          edits.title?.trim() ||
          (village ? `أرض صناعية في ${village}` : "عرض عقاري جديد"),
        area,
        propertyType: "أرض صناعية",
        industryType,
        dealType: "sale",
        size: submission.area,
        price: input.includePrice ? edits.price?.trim() || submission.price : null,
        governorate: submission.governorate,
        directorate: submission.directorate,
        village,
        neighborhood: input.includeParcel
          ? edits.neighborhood?.trim() || submission.neighborhood
          : null,
        basin: input.includeParcel ? edits.basin?.trim() || submission.basin : null,
        parcel: input.includeParcel ? normalizedParcel : null,
        locationUrl: input.includeParcel ? submission.coordinates : null,
        latitude: input.includeParcel ? structuredSubmission.latitude : null,
        longitude: input.includeParcel ? structuredSubmission.longitude : null,
        address: input.includeParcel ? structuredSubmission.address : null,
        administrativeValue: structuredSubmission.administrativeValue,
        administrativeValueSource: structuredSubmission.administrativeValueSource,
        administrativeValueAt: structuredSubmission.administrativeValueAt,
        showEstimatedValue: input.showEstimatedValue,
        phone: edits.phone?.trim() || submission.phone,
        status: "available",
        publishStatus: input.publish ? "published" : "draft",
        featured: false,
        importance: "none",
        ownerAccessCode,
        smsOptIn: true,
        presenterRole: submission.source === "broker" ? "broker" : "owner",
        presenterName: submission.applicant,
        showPresenter: false,
        description: edits.description?.trim() || submission.details,
        internalNotes: `تم إنشاء العرض من طلب المراجعة ${submission.id}`,
        source: "review",
        mainImage: images[0] ?? null,
        media: {
          create: [
            ...images.map((url, position) => ({ url, kind: "image" as const, position })),
            ...(input.includeVideo && submission.video ? [{ url: submission.video, kind: "video" as const, position: 0 }] : []),
            ...(input.includeDocument && submission.document ? [{ url: submission.document, kind: "document" as const, position: 0 }] : []),
          ],
        },
      } as never,
    });

    if (input.publish) {
      await notifyListingOwner(
        listing.phone,
        true,
        smsPublished({ listingNo: listing.listingNo, ownerAccessCode })
      );
    }

    await prisma.submission.update({
      where: { id: submission.id },
      data: { convertedListingId: listing.id, status: "approved", reviewedAt: new Date(), reviewer: "Alshantaf Admin" },
    });

    await audit({
      actorEmail: req.session!.email,
      action: "submission.approve",
      targetType: "submission",
      targetId: submission.id,
      metadata: {
        listingId: listing.id,
        listingNo: listing.listingNo,
        published: input.publish,
        includeParcel: input.includeParcel,
        includePrice: input.includePrice,
        includeDocument: input.includeDocument,
        includeVideo: input.includeVideo,
        imageCount: images.length,
        applicant: submission.applicant,
        village: submission.village,
        parcel: submission.parcel,
      },
      ip: req.ip,
    });
    res.status(201).json(listing);
  })
);
