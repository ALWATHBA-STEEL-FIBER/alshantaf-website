import type { IndustryType } from "./types";

export interface SetbackInfo {
  frontal: string;
  side: string;
  rear: string;
  buildPercentage: string;
  /** Floors label token: number, "2+roof", "—", "as-residential", or "on-request". */
  floors: string;
  /** Height token: meters number, "9-ex-roof", "—", or "on-request". */
  height: string;
}

/**
 * Zoning setbacks & build rules.
 * Source of truth for Amman classes: نظام الأبنية والتنظيم في مدينة عمان رقم (28) لسنة 2018
 * (and later amendments). Values marked on-request stay plan-specific.
 * Outside-Amman commercial mirrors Amman tables as reference only — confirm locally.
 */
export const SETBACKS: Record<IndustryType, SetbackInfo> = {
  // Industrial — المادة 18 جدول الارتدادات
  lightSpecial: { frontal: "6", side: "4", rear: "4", buildPercentage: "50%", floors: "—", height: "24" },
  light: { frontal: "6", side: "4", rear: "4", buildPercentage: "50%", floors: "—", height: "24" },
  mediumSpecial: { frontal: "8", side: "6", rear: "6", buildPercentage: "50%", floors: "—", height: "24" },
  medium: { frontal: "8", side: "6", rear: "6", buildPercentage: "50%", floors: "—", height: "24" },
  industrialCraft: { frontal: "5", side: "3", rear: "3", buildPercentage: "50%", floors: "—", height: "17" },
  industrialHeavy: { frontal: "15", side: "10", rear: "10", buildPercentage: "50%", floors: "—", height: "24" },
  industrialTransformative: { frontal: "5", side: "3", rear: "3", buildPercentage: "50%", floors: "—", height: "17" },
  industrialGeneral: { frontal: "10", side: "5", rear: "5", buildPercentage: "50%", floors: "—", height: "24" },
  agriToIndustrial: { frontal: "on-request", side: "on-request", rear: "on-request", buildPercentage: "on-request", floors: "on-request", height: "24" },
  technical: { frontal: "6", side: "5", rear: "5", buildPercentage: "50%", floors: "—", height: "24" },

  // Residential ordinary — المادة 4/5
  residentialA: { frontal: "5", side: "5", rear: "7", buildPercentage: "39%", floors: "4", height: "16" },
  residentialB: { frontal: "4", side: "4", rear: "6", buildPercentage: "45%", floors: "4", height: "16" },
  residentialC: { frontal: "4", side: "3", rear: "4", buildPercentage: "51%", floors: "4", height: "16" },
  residentialD: { frontal: "3", side: "2.5", rear: "2.5", buildPercentage: "55%", floors: "4", height: "16" },
  residentialPopular: { frontal: "2", side: "0", rear: "2", buildPercentage: "—", floors: "4", height: "16" },
  residentialHighDensity: { frontal: "5", side: "5", rear: "5", buildPercentage: "—", floors: "—", height: "28" },

  // Green — المادة 8: طابقان وارتفاع 9م؛ الارتدادات والنسبة تتبع فئة السكن الذي يقع فيه
  residentialGreen: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "2", height: "9" },
  greenWithinA: { frontal: "5", side: "5", rear: "7", buildPercentage: "39%", floors: "2", height: "9" },
  greenWithinB: { frontal: "4", side: "4", rear: "6", buildPercentage: "45%", floors: "2", height: "9" },
  greenWithinC: { frontal: "4", side: "3", rear: "4", buildPercentage: "51%", floors: "2", height: "9" },
  greenWithinD: { frontal: "3", side: "2.5", rear: "2.5", buildPercentage: "55%", floors: "2", height: "9" },

  // Private — المادة 9: ضمن أ/ب فقط؛ طابقان + روف وارتفاع 9م؛ الارتدادات/% تتبع المضيف
  residentialPrivateA: { frontal: "5", side: "5", rear: "7", buildPercentage: "39%", floors: "2+roof", height: "9" },
  residentialPrivateB: { frontal: "4", side: "4", rear: "6", buildPercentage: "45%", floors: "2+roof", height: "9" },
  residentialPrivateC: { frontal: "4", side: "3", rear: "4", buildPercentage: "51%", floors: "2+roof", height: "9" },

  // Rural / agri — المواد 10–11
  residentialRural: { frontal: "12", side: "10", rear: "10", buildPercentage: "10%", floors: "2", height: "8" },
  residentialAgri: { frontal: "15", side: "15", rear: "15", buildPercentage: "4%", floors: "2", height: "8" },
  agriFacilities: { frontal: "on-request", side: "on-request", rear: "on-request", buildPercentage: "on-request", floors: "on-request", height: "on-request" },

  // Commercial Amman
  commercialCentral: { frontal: "—", side: "2.5", rear: "2.5", buildPercentage: "85%", floors: "—", height: "72" },
  commercialShowrooms: { frontal: "—", side: "4", rear: "4", buildPercentage: "70%", floors: "—", height: "72" },
  commercialLinear: { frontal: "—", side: "4", rear: "4", buildPercentage: "70%", floors: "—", height: "72" },
  commercialOffice: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "as-residential", height: "as-residential" },
  commercialIndustrial: { frontal: "on-request", side: "on-request", rear: "on-request", buildPercentage: "on-request", floors: "on-request", height: "on-request" },
  commercialNeighborhoodService: { frontal: "on-request", side: "on-request", rear: "on-request", buildPercentage: "on-request", floors: "on-request", height: "on-request" },
  commercialCenter: { frontal: "on-request", side: "on-request", rear: "on-request", buildPercentage: "on-request", floors: "on-request", height: "on-request" },
  commercialOrdinaryA: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "as-residential", height: "18" },
  commercialOrdinaryB: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "as-residential", height: "18" },
  commercialOrdinaryC: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "as-residential", height: "18" },
  commercialWithinD: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "as-residential", height: "18" },
  commercialLocal: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "as-residential", height: "18" },
  commercialComplex: { frontal: "15", side: "10", rear: "10", buildPercentage: "50%", floors: "—", height: "20" },
  mixedUse: { frontal: "12", side: "5", rear: "6", buildPercentage: "50%", floors: "6", height: "25" },
  mixedUseUrban: { frontal: "5", side: "5", rear: "6", buildPercentage: "45%", floors: "6", height: "25" },
  mixedUseEntertainment: { frontal: "on-request", side: "on-request", rear: "on-request", buildPercentage: "on-request", floors: "on-request", height: "on-request" },

  // Outside Amman — reference only
  commercialOutsideCentral: { frontal: "—", side: "2.5", rear: "2.5", buildPercentage: "85%", floors: "—", height: "72" },
  commercialOutsideShowrooms: { frontal: "—", side: "4", rear: "4", buildPercentage: "70%", floors: "—", height: "72" },
  commercialOutsideLinear: { frontal: "—", side: "4", rear: "4", buildPercentage: "70%", floors: "—", height: "72" },
  commercialOutsideLocal: { frontal: "as-residential", side: "as-residential", rear: "as-residential", buildPercentage: "as-residential", floors: "as-residential", height: "18" },
};
