import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma";
import { serializeListing } from "../lib/serialize";
import { asyncHandler } from "../lib/asyncHandler";
import { getOrSetVisitorId } from "../lib/visitor";
import { notifyListingOwner, smsViewMilestone, VIEW_MILESTONES } from "../lib/listingNotify";

export const listingsRouter = Router();

const viewLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const querySchema = z.object({
  area: z.string().optional(),
  status: z.string().optional(),
  industryType: z.string().optional(),
  q: z.string().optional(),
});

listingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = querySchema.parse(req.query);
    const listings = await prisma.listing.findMany({
      where: {
        publishStatus: "published",
        status: { notIn: ["canceled"] },
        ...(query.area ? { area: query.area } : {}),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.industryType ? { industryType: query.industryType as never } : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: "insensitive" } },
                { listingNo: { contains: query.q, mode: "insensitive" } },
                { area: { contains: query.q, mode: "insensitive" } },
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

listingsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findFirst({
      where: { id: req.params.id, publishStatus: "published" },
      include: { media: true },
    });
    if (!listing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    res.json(serializeListing(listing));
  })
);

listingsRouter.post(
  "/:id/view",
  viewLimiter,
  asyncHandler(async (req, res) => {
    const visitorId = getOrSetVisitorId(req, res);
    const listing = await prisma.listing.findFirst({
      where: { id: req.params.id, publishStatus: "published" },
      select: {
        id: true,
        listingNo: true,
        phone: true,
        smsOptIn: true,
        ownerAccessCode: true,
        notifiedMilestones: true,
        viewCount: true,
      },
    });
    if (!listing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    try {
      await prisma.listingView.create({ data: { listingId: listing.id, visitorId } });
      const updated = await prisma.listing.update({
        where: { id: listing.id },
        data: { viewCount: { increment: 1 } },
        select: {
          viewCount: true,
          notifiedMilestones: true,
          phone: true,
          smsOptIn: true,
          ownerAccessCode: true,
          listingNo: true,
        },
      });

      const hit = VIEW_MILESTONES.find(
        (m) => updated.viewCount >= m && !updated.notifiedMilestones.includes(m)
      );
      if (hit && updated.ownerAccessCode) {
        const sent = await notifyListingOwner(
          updated.phone,
          updated.smsOptIn,
          smsViewMilestone({
            listingNo: updated.listingNo,
            views: hit,
            ownerAccessCode: updated.ownerAccessCode,
          })
        );
        if (sent) {
          await prisma.listing.update({
            where: { id: listing.id },
            data: { notifiedMilestones: { push: hit } },
          });
        }
      }
    } catch (err) {
      const isDuplicate = typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
      if (!isDuplicate) throw err;
    }
    res.status(204).end();
  })
);
