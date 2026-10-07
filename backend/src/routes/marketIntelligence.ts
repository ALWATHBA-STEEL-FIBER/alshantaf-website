import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import {
  getMarketCatalog,
  getMarketSeries,
  getMarketSnapshot,
  getMetricDto,
} from "../lib/marketIntelligence/service";
import { checkMarketSources, syncMarketIntelligenceSeed } from "../lib/marketIntelligence/sync";
import { requireAdmin, requirePermission } from "../middleware/auth";

export const marketIntelligenceRouter = Router();

marketIntelligenceRouter.get(
  "/snapshot",
  asyncHandler(async (_req, res) => {
    // Ensure seed exists on first hit (idempotent).
    const count = await import("../prisma").then((m) => m.prisma.marketMetric.count());
    if (count === 0) await syncMarketIntelligenceSeed();
    res.json(await getMarketSnapshot());
  })
);

marketIntelligenceRouter.get(
  "/catalog",
  asyncHandler(async (_req, res) => {
    res.json(await getMarketCatalog());
  })
);

marketIntelligenceRouter.get(
  "/series/:metricKey",
  asyncHandler(async (req, res) => {
    const metricKey = z.string().min(1).max(80).parse(req.params.metricKey);
    const range = z
      .enum(["1m", "3m", "6m", "1y", "3y", "5y", "max"])
      .catch("3y")
      .parse(req.query.range);
    res.json(await getMarketSeries(metricKey, range));
  })
);

marketIntelligenceRouter.get(
  "/metrics/:metricKey",
  asyncHandler(async (req, res) => {
    const metricKey = z.string().min(1).max(80).parse(req.params.metricKey);
    res.json(await getMetricDto(metricKey));
  })
);

export const adminMarketIntelligenceRouter = Router();
adminMarketIntelligenceRouter.use(requireAdmin);
adminMarketIntelligenceRouter.use(requirePermission("settings"));

adminMarketIntelligenceRouter.post(
  "/sync",
  asyncHandler(async (_req, res) => {
    const seeded = await syncMarketIntelligenceSeed();
    const health = await checkMarketSources();
    res.json({ ok: true, seeded, health });
  })
);
