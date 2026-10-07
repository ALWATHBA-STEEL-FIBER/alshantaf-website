import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { getOrSetVisitorId } from "../lib/visitor";
import { recordHeartbeat, getActiveVisitors } from "../lib/presence";
import { recordPageView } from "../lib/siteAnalytics";
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
});

/** Throttle DB page-view writes per visitor+path (ms). */
const lastViewWrite = new Map<string, number>();
const VIEW_WRITE_GAP_MS = 60_000;

presenceRouter.post(
  "/heartbeat",
  heartbeatLimiter,
  asyncHandler(async (req, res) => {
    const { path } = heartbeatSchema.parse(req.body ?? {});
    const visitorId = getOrSetVisitorId(req, res);
    recordHeartbeat(visitorId, path);
    const key = `${visitorId}|${path}`;
    const now = Date.now();
    const prev = lastViewWrite.get(key) ?? 0;
    if (now - prev >= VIEW_WRITE_GAP_MS) {
      lastViewWrite.set(key, now);
      void recordPageView(visitorId, path).catch(() => undefined);
    }
    res.status(204).end();
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
