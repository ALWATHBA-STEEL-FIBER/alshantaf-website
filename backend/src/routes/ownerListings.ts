import { Router } from "express";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { serializeListing } from "../lib/serialize";
import { deleteUploadedFiles } from "../lib/uploadSecurity";
import { toWesternDigits } from "../lib/arabicDigits";
import { notifyListingOwner, smsStatusChange } from "../lib/listingNotify";

export const ownerListingsRouter = Router();

const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please try again later." },
});

ownerListingsRouter.use(limiter);

function serializeOwnerListing(listing: Parameters<typeof serializeListing>[0] & {
  ownerAccessCode: string | null;
  smsOptIn: boolean;
}) {
  const base = serializeListing(listing);
  return {
    ...base,
    ownerAccessCode: listing.ownerAccessCode,
    smsOptIn: listing.smsOptIn,
  };
}

ownerListingsRouter.get(
  "/:code",
  asyncHandler(async (req, res) => {
    const code = toWesternDigits(req.params.code.trim()).toUpperCase();
    const listing = await prisma.listing.findFirst({
      where: { ownerAccessCode: code },
      include: { media: true },
    });
    if (!listing) {
      res.status(404).json({ error: "Offer not found — check your access code" });
      return;
    }
    res.json(serializeOwnerListing(listing));
  })
);

const patchSchema = z.object({
  status: z.enum(["available", "reserved", "sold", "rented", "canceled"]).optional(),
  smsOptIn: z.boolean().optional(),
});

ownerListingsRouter.patch(
  "/:code",
  asyncHandler(async (req, res) => {
    const code = toWesternDigits(req.params.code.trim()).toUpperCase();
    const input = patchSchema.parse(req.body);
    const existing = await prisma.listing.findFirst({ where: { ownerAccessCode: code } });
    if (!existing) {
      res.status(404).json({ error: "Offer not found — check your access code" });
      return;
    }

    const nextStatus = input.status ?? existing.status;
    const archive = nextStatus === "canceled" || nextStatus === "sold";
    const listing = await prisma.listing.update({
      where: { id: existing.id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.smsOptIn !== undefined ? { smsOptIn: input.smsOptIn } : {}),
        ...(archive && existing.publishStatus === "published" ? { publishStatus: "archived" } : {}),
      },
      include: { media: true },
    });

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

    res.json(serializeOwnerListing(listing));
  })
);

ownerListingsRouter.delete(
  "/:code",
  asyncHandler(async (req, res) => {
    const code = toWesternDigits(req.params.code.trim()).toUpperCase();
    const confirm = typeof req.query.confirm === "string" ? req.query.confirm.trim() : "";
    const existing = await prisma.listing.findFirst({
      where: { ownerAccessCode: code },
      include: { media: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Offer not found — check your access code" });
      return;
    }
    if (confirm !== existing.listingNo) {
      res.status(400).json({ error: "Confirm deletion by passing ?confirm=LISTING_NO" });
      return;
    }

    const urls = existing.media.map((m) => m.url);
    if (existing.mainImage) urls.push(existing.mainImage);
    await prisma.listing.delete({ where: { id: existing.id } });
    await deleteUploadedFiles([...new Set(urls)], UPLOAD_DIR);
    res.status(204).end();
  })
);
