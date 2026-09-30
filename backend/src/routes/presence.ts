import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { getOrSetVisitorId } from "../lib/visitor";
import { recordHeartbeat, getActiveVisitors } from "../lib/presence";
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

presenceRouter.post(
  "/heartbeat",
  heartbeatLimiter,
  asyncHandler(async (req, res) => {
    const { path } = heartbeatSchema.parse(req.body ?? {});
    const visitorId = getOrSetVisitorId(req, res);
    recordHeartbeat(visitorId, path);
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
