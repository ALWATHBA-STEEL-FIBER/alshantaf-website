import { Router } from "express";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAdmin } from "../middleware/auth";
import { serializeListing } from "../lib/serialize";
import { nextListingNo } from "../lib/listingNo";
import { nextOwnerAccessCode } from "../lib/ownerAccess";
import { notifyListingOwner, smsPublished, smsStatusChange } from "../lib/listingNotify";
import { deleteUploadedFiles } from "../lib/uploadSecurity";
import { audit } from "../lib/audit";
import { industryTypeEnum } from "../lib/industryTypes";
import { asyncHandler } from "../lib/asyncHandler";
import { locationFieldsSchema, legacyCoordinates } from "../lib/location";
import { toWesternDigits, westernDigitsString } from "../lib/arabicDigits";

export const adminListingsRouter = Router();
adminListingsRouter.use(requireAdmin);

const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

const mediaItemSchema = z.object({
  url: z.string().min(1),
  kind: z.enum(["image", "video", "document"]),
  position: z.number().int().default(0),
});

const listingBaseSchema = z.object({
  title: z.string().min(1).max(120),
  area: westernDigitsString(z.string().min(1)),
  propertyType: z.string().optional(),
  industryType: z.enum(industryTypeEnum),
  dealType: z.enum(["sale", "rent", "sale_or_rent", "partnership"]).default("sale"),
  size: westernDigitsString(z.string().optional()),
  price: westernDigitsString(z.string().optional()),
  governorate: z.string().optional(),
  directorate: z.string().optional(),
  village: z.string().optional(),
  basin: z.string().optional(),
  neighborhood: z.string().optional(),
  parcel: westernDigitsString(z.string().optional()),
  locationUrl: westernDigitsString(z.string().optional()),
  administrativeValue: z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return value;
    if (typeof value === "string") return toWesternDigits(value);
    return value;
  }, z.number().finite().optional().nullable()),
  administrativeValueSource: z.string().optional().nullable(),
  administrativeValueAt: z.coerce.date().optional().nullable(),
  phone: westernDigitsString(z.string().optional()),
  status: z.enum(["available", "reserved", "sold", "rented", "canceled"]).default("available"),
  publishStatus: z.enum(["published", "draft", "archived"]).default("published"),
  featured: z.boolean().default(false),
  presenterRole: z.enum(["owner", "presenter", "broker", "company", "other"]).optional().nullable(),
  presenterName: z.string().optional(),
  showPresenter: z.boolean().default(false),
  description: z.string().min(1).max(1800),
  internalNotes: z.string().optional(),
  media: z.array(mediaItemSchema).default([]),
  smsOptIn: z.boolean().optional(),
});
const listingInputSchema = listingBaseSchema.and(locationFieldsSchema);
const listingUpdateSchema = listingBaseSchema.partial().and(z.object({
  latitude: z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return value;
    if (typeof value === "string") return toWesternDigits(value);
    return value;
  }, z.coerce.number().finite().min(-90).max(90).optional()),
  longitude: z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return value;
    if (typeof value === "string") return toWesternDigits(value);
    return value;
  }, z.coerce.number().finite().min(-180).max(180).optional()),
  address: z.string().trim().max(300).optional(),
}));

const listSchema = z.object({
  area: z.string().optional(),
  publishStatus: z.string().optional(),
  status: z.string().optional(),
  industryType: z.string().optional(),
  q: z.string().optional(),
});

adminListingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listSchema.parse(req.query);
    const listings = await prisma.listing.findMany({
      where: {
        ...(query.area ? { area: query.area } : {}),
        ...(query.publishStatus ? { publishStatus: query.publishStatus as never } : {}),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.industryType ? { industryType: query.industryType as never } : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: "insensitive" } },
                { listingNo: { contains: query.q, mode: "insensitive" } },
                { area: { contains: query.q, mode: "insensitive" } },
                { governorate: { contains: query.q, mode: "insensitive" } },
                { directorate: { contains: query.q, mode: "insensitive" } },
                { village: { contains: query.q, mode: "insensitive" } },
                { basin: { contains: query.q, mode: "insensitive" } },
                { parcel: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { media: true },
      orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    });
    res.json(listings.map(serializeListing));
  })
);

function firstImage(media: { url: string; kind: string; position: number }[]) {
  return media
    .filter((m) => m.kind === "image")
    .sort((a, b) => a.position - b.position)[0]?.url;
}

adminListingsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = listingInputSchema.parse(req.body);
    const listingNo = await nextListingNo(prisma, input.area);
    const ownerAccessCode = await nextOwnerAccessCode(prisma);
    const { media, ...rest } = input;
    const listing = await prisma.listing.create({
      data: {
        ...rest,
        locationUrl: legacyCoordinates(input.latitude, input.longitude) ?? input.locationUrl,
        listingNo,
        ownerAccessCode,
        mainImage: firstImage(media) ?? null,
        media: { create: media },
      },
      include: { media: true },
    });
    if (listing.publishStatus === "published" && listing.ownerAccessCode) {
      await notifyListingOwner(
        listing.phone,
        listing.smsOptIn,
        smsPublished({ listingNo: listing.listingNo, ownerAccessCode: listing.ownerAccessCode })
      );
    }
    await audit({
      actorEmail: req.session!.email,
      action: "listing.create",
      targetType: "listing",
      targetId: listing.id,
      metadata: { listingNo: listing.listingNo, title: listing.title },
      ip: req.ip,
    });
    res.status(201).json(serializeListing(listing));
  })
);

adminListingsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = listingUpdateSchema.parse(req.body);
    const existing = await prisma.listing.findUnique({ where: { id: req.params.id }, include: { media: true } });
    if (!existing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    const { media, ...rest } = input;
    const ownerAccessCode = existing.ownerAccessCode ?? (await nextOwnerAccessCode(prisma));
    const nextStatus = input.status ?? existing.status;
    const listing = await prisma.listing.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ownerAccessCode,
        ...(input.latitude !== undefined && input.longitude !== undefined ? { locationUrl: legacyCoordinates(input.latitude, input.longitude) } : {}),
        ...((nextStatus === "sold" || nextStatus === "canceled") && existing.publishStatus === "published"
          ? { publishStatus: "archived" }
          : {}),
        ...(media
          ? {
              media: { deleteMany: {}, create: media },
              mainImage: firstImage(media) ?? null,
            }
          : {}),
      },
      include: { media: true },
    });

    if (media) {
      const newUrls = new Set(media.map((m) => m.url));
      const removed = existing.media.map((m) => m.url).filter((url) => !newUrls.has(url));
      await deleteUploadedFiles(removed, UPLOAD_DIR);
    }

    if (
      input.status &&
      (input.status === "sold" || input.status === "canceled") &&
      existing.status !== input.status &&
      listing.ownerAccessCode
    ) {
      await notifyListingOwner(
        listing.phone,
        listing.smsOptIn,
        smsStatusChange({
          listingNo: listing.listingNo,
          status: input.status,
          ownerAccessCode: listing.ownerAccessCode,
        })
      );
    }

    await audit({
      actorEmail: req.session!.email,
      action: "listing.update",
      targetType: "listing",
      targetId: listing.id,
      ip: req.ip,
    });
    res.json(serializeListing(listing));
  })
);

adminListingsRouter.patch(
  "/:id/publish",
  asyncHandler(async (req, res) => {
    const { publishStatus } = z
      .object({ publishStatus: z.enum(["published", "draft", "archived"]) })
      .parse(req.body);
    const existing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    const ownerAccessCode = existing.ownerAccessCode ?? (await nextOwnerAccessCode(prisma));
    const listing = await prisma.listing.update({
      where: { id: req.params.id },
      data: { publishStatus, ownerAccessCode },
      include: { media: true },
    });
    if (publishStatus === "published" && existing.publishStatus !== "published" && listing.ownerAccessCode) {
      await notifyListingOwner(
        listing.phone,
        listing.smsOptIn,
        smsPublished({ listingNo: listing.listingNo, ownerAccessCode: listing.ownerAccessCode })
      );
    }
    await audit({
      actorEmail: req.session!.email,
      action: `listing.${publishStatus === "published" ? "publish" : "unpublish"}`,
      targetType: "listing",
      targetId: listing.id,
      metadata: { publishStatus },
      ip: req.ip,
    });
    res.json(serializeListing(listing));
  })
);

adminListingsRouter.patch(
  "/:id/feature",
  asyncHandler(async (req, res) => {
    const { featured } = z.object({ featured: z.boolean() }).parse(req.body);
    const listing = await prisma.listing.update({
      where: { id: req.params.id },
      data: { featured },
      include: { media: true },
    });
    await audit({
      actorEmail: req.session!.email,
      action: featured ? "listing.feature" : "listing.unfeature",
      targetType: "listing",
      targetId: listing.id,
      ip: req.ip,
    });
    res.json(serializeListing(listing));
  })
);

adminListingsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.listing.findUnique({ where: { id: req.params.id }, include: { media: true } });
    if (!existing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    await prisma.listing.delete({ where: { id: req.params.id } });
    await deleteUploadedFiles(existing.media.map((m) => m.url), UPLOAD_DIR);
    await audit({
      actorEmail: req.session!.email,
      action: "listing.delete",
      targetType: "listing",
      targetId: existing.id,
      metadata: { listingNo: existing.listingNo, title: existing.title },
      ip: req.ip,
    });
    res.status(204).end();
  })
);
