import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { getLandMarketSnapshot } from "../lib/landMarket/service";

export const marketIntelligenceRouter = Router();

async function safeSnapshot() {
  try {
    return await getLandMarketSnapshot();
  } catch (err) {
    console.error("[land-market] snapshot failed:", err);
    const now = new Date().toISOString();
    return {
      kind: "land_parcels" as const,
      updatedAt: now,
      generatedAt: now,
      national: null,
      ase: null,
      dlsRates: { kpis: [], byArea: [] },
      platform: {
        offerCount: 0,
        updatedAt: now,
        kpis: [],
        charts: { byArea: [], byStatus: [], byDeal: [], listingsByMonth: [] },
      },
      sources: [],
      offerCount: 0,
      kpis: [],
      charts: {
        byArea: [],
        byStatus: [],
        byDeal: [],
        byIndustry: [],
        priceByArea: [],
        listingsByMonth: [],
        latestByType: [],
        landsTrend: [],
        industrialTrend: [],
        generalTrend: [],
        residentialTrend: [],
        landsResidentialTrend: [],
        landsCommercialTrend: [],
        commercialTrend: [],
        nonResidentialTrend: [],
        landsYearly: [],
        industrialYearly: [],
        generalYearly: [],
        byGovernorate: [],
        govQoqChange: [],
        qoqByType: [],
        landsBreakdown: [],
      },
    };
  }
}

marketIntelligenceRouter.get(
  "/snapshot",
  asyncHandler(async (_req, res) => {
    res.json(await safeSnapshot());
  })
);

/** Alias kept for older clients. */
marketIntelligenceRouter.get(
  "/land",
  asyncHandler(async (_req, res) => {
    res.json(await safeSnapshot());
  })
);

export const adminMarketIntelligenceRouter = Router();
