import type { PrismaClient } from "@prisma/client";
import type { IndustryTypeKey } from "./industryTypes";

type RulePayload = {
  setbacks: {
    frontal: string;
    side: string;
    rear: string;
    buildPercentage: string;
    floors: string;
    height: string;
  };
};

type CatalogEntry = {
  industryType: IndustryTypeKey;
  category: "industrial" | "residential" | "commercial-amman" | "commercial-outside-amman";
  ammanAutoEligible: boolean;
  rules: RulePayload;
};

// Canonical catalog for every IndustryType. Rules from نظام الأبنية والتنظيم في مدينة عمان رقم (28) لسنة 2018.
export const INDUSTRY_TYPE_CATALOG: CatalogEntry[] = [
  { industryType: "lightSpecial", category: "industrial", ammanAutoEligible: true, rules: { setbacks: { frontal: "6", side: "4", rear: "4", buildPercentage: "50%", floors: "—", height: "24" } } },
  { industryType: "light", category: "industrial", ammanAutoEligible: true, rules: { setbacks: { frontal: "6", side: "4", rear: "4", buildPercentage: "50%", floors: "—", height: "24" } } },
  { industryType: "mediumSpecial", category: "industrial", ammanAutoEligible: true, rules: { setbacks: { frontal: "8", side: "6", rear: "6", buildPercentage: "50%", floors: "—", height: "24" } } },
  { industryType: "medium", category: "industrial", ammanAutoEligible: true, rules: { setbacks: { frontal: "8", side: "6", rear: "6", buildPercentage: "50%", floors: "—", height: "24" } } },
  { industryType: "industrialCraft", category: "industrial", ammanAutoEligible: true, rules: { setbacks: { frontal: "5", side: "3", rear: "3", buildPercentage: "50%", floors: "—", height: "17" } } },
  { industryType: "industrialHeavy", category: "industrial", ammanAutoEligible: true, rules: { setbacks: { frontal: "15", side: "10", rear: "10", buildPercentage: "50%", floors: "—", height: "24" } } },
  { industryType: "industrialTransformative", category: "industrial", ammanAutoEligible: true, rules: { setbacks: { frontal: "5", side: "3", rear: "3", buildPercentage: "50%", floors: "—", height: "17" } } },
  { industryType: "industrialGeneral", category: "industrial", ammanAutoEligible: true, rules: { setbacks: { frontal: "10", side: "5", rear: "5", buildPercentage: "50%", floors: "—", height: "24" } } },
  { industryType: "agriToIndustrial", category: "industrial", ammanAutoEligible: true, rules: { setbacks: { frontal: "on-request", side: "on-request", rear: "on-request", buildPercentage: "on-request", floors: "on-request", height: "24" } } },
  { industryType: "technical", category: "industrial", ammanAutoEligible: true, rules: { setbacks: { frontal: "6", side: "5", rear: "5", buildPercentage: "50%", floors: "—", height: "24" } } },
  { industryType: "residentialA", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "5", side: "5", rear: "7", buildPercentage: "39%", floors: "4", height: "16" } } },
  { industryType: "residentialB", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "4", side: "4", rear: "6", buildPercentage: "45%", floors: "4", height: "16" } } },
  { industryType: "residentialC", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "4", side: "3", rear: "4", buildPercentage: "51%", floors: "4", height: "16" } } },
  { industryType: "residentialD", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "3", side: "2.5", rear: "2.5", buildPercentage: "55%", floors: "4", height: "16" } } },
  { industryType: "residentialPopular", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "2", side: "0", rear: "2", buildPercentage: "—", floors: "4", height: "16" } } },
  { industryType: "residentialHighDensity", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "5", side: "5", rear: "5", buildPercentage: "—", floors: "—", height: "28" } } },
  { industryType: "residentialGreen", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "2", height: "9" } } },
  { industryType: "greenWithinA", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "5", side: "5", rear: "7", buildPercentage: "39%", floors: "2", height: "9" } } },
  { industryType: "greenWithinB", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "4", side: "4", rear: "6", buildPercentage: "45%", floors: "2", height: "9" } } },
  { industryType: "greenWithinC", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "4", side: "3", rear: "4", buildPercentage: "51%", floors: "2", height: "9" } } },
  { industryType: "greenWithinD", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "3", side: "2.5", rear: "2.5", buildPercentage: "55%", floors: "2", height: "9" } } },
  { industryType: "residentialPrivateA", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "5", side: "5", rear: "7", buildPercentage: "39%", floors: "2+roof", height: "9" } } },
  { industryType: "residentialPrivateB", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "4", side: "4", rear: "6", buildPercentage: "45%", floors: "2+roof", height: "9" } } },
  { industryType: "residentialPrivateC", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "4", side: "3", rear: "4", buildPercentage: "51%", floors: "2+roof", height: "9" } } },
  { industryType: "residentialRural", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "12", side: "10", rear: "10", buildPercentage: "10%", floors: "2", height: "8" } } },
  { industryType: "residentialAgri", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "15", side: "15", rear: "15", buildPercentage: "4%", floors: "2", height: "8" } } },
  { industryType: "agriFacilities", category: "residential", ammanAutoEligible: true, rules: { setbacks: { frontal: "on-request", side: "on-request", rear: "on-request", buildPercentage: "on-request", floors: "on-request", height: "on-request" } } },
  { industryType: "commercialCentral", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "—", side: "2.5", rear: "2.5", buildPercentage: "85%", floors: "—", height: "72" } } },
  { industryType: "commercialShowrooms", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "—", side: "4", rear: "4", buildPercentage: "70%", floors: "—", height: "72" } } },
  { industryType: "commercialLinear", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "—", side: "4", rear: "4", buildPercentage: "70%", floors: "—", height: "72" } } },
  { industryType: "commercialOffice", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "as-residential", height: "as-residential" } } },
  { industryType: "commercialIndustrial", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "on-request", side: "on-request", rear: "on-request", buildPercentage: "on-request", floors: "on-request", height: "on-request" } } },
  { industryType: "commercialNeighborhoodService", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "on-request", side: "on-request", rear: "on-request", buildPercentage: "on-request", floors: "on-request", height: "on-request" } } },
  { industryType: "commercialCenter", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "on-request", side: "on-request", rear: "on-request", buildPercentage: "on-request", floors: "on-request", height: "on-request" } } },
  { industryType: "commercialOrdinaryA", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "as-residential", height: "18" } } },
  { industryType: "commercialOrdinaryB", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "as-residential", height: "18" } } },
  { industryType: "commercialOrdinaryC", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "as-residential", height: "18" } } },
  { industryType: "commercialWithinD", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "as-residential", height: "18" } } },
  { industryType: "commercialLocal", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "as-residential", height: "18" } } },
  { industryType: "commercialComplex", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "15", side: "10", rear: "10", buildPercentage: "50%", floors: "—", height: "20" } } },
  { industryType: "mixedUse", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "12", side: "5", rear: "6", buildPercentage: "50%", floors: "6", height: "25" } } },
  { industryType: "mixedUseUrban", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "5", side: "5", rear: "6", buildPercentage: "45%", floors: "6", height: "25" } } },
  { industryType: "mixedUseEntertainment", category: "commercial-amman", ammanAutoEligible: true, rules: { setbacks: { frontal: "on-request", side: "on-request", rear: "on-request", buildPercentage: "on-request", floors: "on-request", height: "on-request" } } },
  { industryType: "commercialOutsideCentral", category: "commercial-outside-amman", ammanAutoEligible: false, rules: { setbacks: { frontal: "—", side: "2.5", rear: "2.5", buildPercentage: "85%", floors: "—", height: "72" } } },
  { industryType: "commercialOutsideShowrooms", category: "commercial-outside-amman", ammanAutoEligible: false, rules: { setbacks: { frontal: "—", side: "4", rear: "4", buildPercentage: "70%", floors: "—", height: "72" } } },
  { industryType: "commercialOutsideLinear", category: "commercial-outside-amman", ammanAutoEligible: false, rules: { setbacks: { frontal: "—", side: "4", rear: "4", buildPercentage: "70%", floors: "—", height: "72" } } },
  { industryType: "commercialOutsideLocal", category: "commercial-outside-amman", ammanAutoEligible: false, rules: { setbacks: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "as-residential", height: "18" } } },
];

let syncPromise: Promise<void> | null = null;

export function syncIndustryTypeCatalogOnce(prisma: PrismaClient) {
  if (!syncPromise) {
    syncPromise = (async () => {
      await Promise.all(
        INDUSTRY_TYPE_CATALOG.map((entry) =>
          prisma.industryTypeCatalog.upsert({
            where: { industryType: entry.industryType as never },
            create: {
              industryType: entry.industryType as never,
              category: entry.category,
              ammanAutoEligible: entry.ammanAutoEligible,
              rules: entry.rules as never,
            },
            update: {
              category: entry.category,
              ammanAutoEligible: entry.ammanAutoEligible,
              rules: entry.rules as never,
            },
          })
        )
      );
    })().catch((err) => {
      syncPromise = null;
      throw err;
    });
  }
  return syncPromise;
}
