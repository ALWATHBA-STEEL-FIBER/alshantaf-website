import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { getOrSetVisitorId } from "../lib/visitor";
import { recordHeartbeat, getActiveVisitors } from "../lib/presence";
import { recordPageView } from "../lib/siteAnalytics";
import { trackDeviceHeartbeat } from "../lib/siteMonitor";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";

export const presenceRouter = Router();

const heartbeatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const heartbeatSchema = z.object({
  path: z.string().max(300).default("/"),
  platform: z.string().max(120).optional().nullable(),
  screen: z.string().max(40).optional().nullable(),
  timezone: z.string().max(80).optional().nullable(),
  language: z.string().max(40).optional().nullable(),
  name: z.string().max(80).optional().nullable(),
});

/** Throttle DB page-view writes per visitor+path (ms). */
const lastViewWrite = new Map<string, number>();
const VIEW_WRITE_GAP_MS = 60_000;

presenceRouter.post(
  "/heartbeat",
  heartbeatLimiter,
  asyncHandler(async (req, res) => {
    const body = heartbeatSchema.parse(req.body ?? {});
    const visitorId = getOrSetVisitorId(req, res);
    recordHeartbeat(visitorId, body.path);

    const device = await trackDeviceHeartbeat(req, visitorId, body).catch(() => null);

    const key = `${visitorId}|${body.path}`;
    const now = Date.now();
    const prev = lastViewWrite.get(key) ?? 0;
    if (now - prev >= VIEW_WRITE_GAP_MS) {
      lastViewWrite.set(key, now);
      void recordPageView(visitorId, body.path).catch(() => undefined);
    }

    res.json({
      ok: true,
      named: Boolean(device?.displayName),
      displayName: device?.displayName ?? null,
      nameLocked: Boolean(device?.nameLocked),
    });
  })
);

presenceRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const visitorId = getOrSetVisitorId(req, res);
    const { prisma } = await import("../prisma");
    const device = await prisma.siteDevice.findUnique({
      where: { visitorId },
      select: { displayName: true, nameLocked: true },
    });
    res.json({
      ok: true,
      named: Boolean(device?.displayName),
      displayName: device?.displayName ?? null,
      nameLocked: Boolean(device?.nameLocked),
    });
  })
);

export const adminPresenceRouter = Router();
adminPresenceRouter.use(requireAdmin);
// Live visitors widget — any signed-in admin may see it.

adminPresenceRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(getActiveVisitors());
  })
);
