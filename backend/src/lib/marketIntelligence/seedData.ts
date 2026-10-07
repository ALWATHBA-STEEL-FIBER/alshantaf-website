/**
 * Verified Jordan lending-market observations.
 * Every row must map to an official / cited publication — never invent values.
 */

export type SeedSource = {
  key: string;
  name: string;
  tier: number;
  url: string;
  sourceType: string;
  updateFrequency: string;
  reliability: string;
  notes?: string;
};

export type SeedMetric = {
  metricKey: string;
  metricName: string;
  category: string;
  value: number;
  unit: string;
  currency?: string | null;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  frequency: "monthly" | "quarterly" | "annual" | "semi_annual";
  sourceKey: string;
  sourceUrl: string;
  sourcePublishedAt?: string;
  status: "latest_available" | "monthly" | "quarterly" | "annual" | "estimated" | "revised";
  isEstimate?: boolean;
  isCalculated?: boolean;
  confidence?: string;
  notes?: string;
};

export const MARKET_SOURCES: SeedSource[] = [
  {
    key: "cbj",
    name: "Central Bank of Jordan",
    tier: 1,
    url: "https://www.cbj.gov.jo",
    sourceType: "central_bank",
    updateFrequency: "monthly",
    reliability: "official",
    notes: "Monthly Statistical Bulletin and statistical tables.",
  },
  {
    key: "cbj_msb_2025_07",
    name: "CBJ Monthly Statistical Bulletin — July 2025",
    tier: 1,
    url: "https://www.cbj.gov.jo/ebv4.0/root_storage/en/eb_list_page/july_2025-0.pdf",
    sourceType: "official_bulletin",
    updateFrequency: "monthly",
    reliability: "official",
  },
  {
    key: "cbj_msb_2026_01",
    name: "CBJ Monthly Statistical Bulletin — January 2026",
    tier: 1,
    url: "https://www.cbj.gov.jo/ebv4.0/root_storage/en/eb_list_page/january_2026-0.pdf",
    sourceType: "official_bulletin",
    updateFrequency: "monthly",
    reliability: "official",
  },
  {
    key: "cbj_sme_table",
    name: "CBJ — Total Credit Facilities to SMEs",
    tier: 1,
    url: "https://www.cbj.gov.jo/En/List/Total_Credit_Facilities_granted_by_Banks_to_Small_and_MediumSized_Enterprises_SMEs",
    sourceType: "official_dataset",
    updateFrequency: "monthly",
    reliability: "official",
    notes: "Official SME credit facilities download page (file through 03/2026 listed).",
  },
  {
    key: "cbj_via_almamlaka_h1_2026",
    name: "CBJ data reported via Al Mamlaka / Jordan Vista (H1 2026)",
    tier: 4,
    url: "http://vista.sahafi.jo/art.php?id=a1bc3ee54d2c7852d9874db0d34a4997364105e7",
    sourceType: "news_citing_official",
    updateFrequency: "event",
    reliability: "secondary",
    notes: "News report citing CBJ H1 2026 credit balances. Prefer replacing with the primary CBJ bulletin when published.",
  },
];

/** Values stored as JOD millions unless unit says otherwise. */
export const MARKET_METRICS: SeedMetric[] = [
  // —— Total credit facilities (other depository corporations) ——
  {
    metricKey: "total_credit_facilities",
    metricName: "Total credit facilities",
    category: "banking_credit",
    value: 34777.6,
    unit: "JOD_million",
    currency: "JOD",
    periodStart: "2024-12-01",
    periodEnd: "2024-12-31",
    frequency: "monthly",
    sourceKey: "cbj_msb_2025_07",
    sourceUrl: "https://www.cbj.gov.jo/ebv4.0/root_storage/en/eb_list_page/july_2025-0.pdf",
    sourcePublishedAt: "2025-07-01",
    status: "monthly",
    notes: "End-2024 stock from CBJ July 2025 MSB comparative table.",
  },
  {
    metricKey: "total_credit_facilities",
    metricName: "Total credit facilities",
    category: "banking_credit",
    value: 35494.2,
    unit: "JOD_million",
    currency: "JOD",
    periodStart: "2025-06-01",
    periodEnd: "2025-06-30",
    frequency: "monthly",
    sourceKey: "cbj_msb_2025_07",
    sourceUrl: "https://www.cbj.gov.jo/ebv4.0/root_storage/en/eb_list_page/july_2025-0.pdf",
    sourcePublishedAt: "2025-07-01",
    status: "monthly",
  },
  {
    metricKey: "total_credit_facilities",
    metricName: "Total credit facilities",
    category: "banking_credit",
    value: 36059.7,
    unit: "JOD_million",
    currency: "JOD",
    periodStart: "2025-12-01",
    periodEnd: "2025-12-31",
    frequency: "monthly",
    sourceKey: "cbj_msb_2026_01",
    sourceUrl: "https://www.cbj.gov.jo/ebv4.0/root_storage/en/eb_list_page/january_2026-0.pdf",
    sourcePublishedAt: "2026-01-01",
    status: "monthly",
  },
  {
    metricKey: "total_credit_facilities",
    metricName: "Total credit facilities",
    category: "banking_credit",
    value: 37147,
    unit: "JOD_million",
    currency: "JOD",
    periodStart: "2026-01-01",
    periodEnd: "2026-06-30",
    frequency: "semi_annual",
    sourceKey: "cbj_via_almamlaka_h1_2026",
    sourceUrl: "http://vista.sahafi.jo/art.php?id=a1bc3ee54d2c7852d9874db0d34a4997364105e7",
    sourcePublishedAt: "2026-07-01",
    status: "latest_available",
    confidence: "medium",
    notes: "H1 2026 outstanding balance as reported from CBJ by Al Mamlaka / Jordan Vista. Awaiting primary CBJ PDF cross-check.",
  },

  // —— Private sector (resident) ——
  {
    metricKey: "private_sector_credit_resident",
    metricName: "Private-sector credit (resident)",
    category: "banking_credit",
    value: 29988.4,
    unit: "JOD_million",
    currency: "JOD",
    periodStart: "2024-12-01",
    periodEnd: "2024-12-31",
    frequency: "monthly",
    sourceKey: "cbj_msb_2025_07",
    sourceUrl: "https://www.cbj.gov.jo/ebv4.0/root_storage/en/eb_list_page/july_2025-0.pdf",
    sourcePublishedAt: "2025-07-01",
    status: "monthly",
  },
  {
    metricKey: "private_sector_credit_resident",
    metricName: "Private-sector credit (resident)",
    category: "banking_credit",
    value: 30326.9,
    unit: "JOD_million",
    currency: "JOD",
    periodStart: "2025-06-01",
    periodEnd: "2025-06-30",
    frequency: "monthly",
    sourceKey: "cbj_msb_2025_07",
    sourceUrl: "https://www.cbj.gov.jo/ebv4.0/root_storage/en/eb_list_page/july_2025-0.pdf",
    sourcePublishedAt: "2025-07-01",
    status: "monthly",
  },
  {
    metricKey: "private_sector_credit_resident",
    metricName: "Private-sector credit (resident)",
    category: "banking_credit",
    value: 30482.0,
    unit: "JOD_million",
    currency: "JOD",
    periodStart: "2025-12-01",
    periodEnd: "2025-12-31",
    frequency: "monthly",
    sourceKey: "cbj_msb_2026_01",
    sourceUrl: "https://www.cbj.gov.jo/ebv4.0/root_storage/en/eb_list_page/january_2026-0.pdf",
    sourcePublishedAt: "2026-01-01",
    status: "monthly",
    notes: "End-Dec 2025 private sector (resident) from CBJ Jan 2026 MSB table.",
  },

  // —— H1 2026 private / public split (news citing CBJ) ——
  {
    metricKey: "private_sector_credit_total",
    metricName: "Private-sector credit (resident + non-resident)",
    category: "banking_credit",
    value: 32737,
    unit: "JOD_million",
    currency: "JOD",
    periodStart: "2026-01-01",
    periodEnd: "2026-06-30",
    frequency: "semi_annual",
    sourceKey: "cbj_via_almamlaka_h1_2026",
    sourceUrl: "http://vista.sahafi.jo/art.php?id=a1bc3ee54d2c7852d9874db0d34a4997364105e7",
    sourcePublishedAt: "2026-07-01",
    status: "latest_available",
    confidence: "medium",
  },
  {
    metricKey: "public_sector_credit",
    metricName: "Public-sector credit",
    category: "banking_credit",
    value: 4388,
    unit: "JOD_million",
    currency: "JOD",
    periodStart: "2026-01-01",
    periodEnd: "2026-06-30",
    frequency: "semi_annual",
    sourceKey: "cbj_via_almamlaka_h1_2026",
    sourceUrl: "http://vista.sahafi.jo/art.php?id=a1bc3ee54d2c7852d9874db0d34a4997364105e7",
    sourcePublishedAt: "2026-07-01",
    status: "latest_available",
    confidence: "medium",
  },

  // —— Policy / lending rates (Dec 2025) ——
  {
    metricKey: "cbj_main_rate",
    metricName: "CBJ main policy rate",
    category: "lending_conditions",
    value: 5.75,
    unit: "percent",
    periodStart: "2025-12-01",
    periodEnd: "2025-12-31",
    frequency: "monthly",
    sourceKey: "cbj_msb_2026_01",
    sourceUrl: "https://www.cbj.gov.jo/ebv4.0/root_storage/en/eb_list_page/january_2026-0.pdf",
    sourcePublishedAt: "2026-01-01",
    status: "monthly",
    notes: "After 25bp cut on 14/12/2025 (third cut in 2025).",
  },
  {
    metricKey: "rediscount_rate",
    metricName: "Re-discount rate",
    category: "lending_conditions",
    value: 6.75,
    unit: "percent",
    periodStart: "2025-12-01",
    periodEnd: "2025-12-31",
    frequency: "monthly",
    sourceKey: "cbj_msb_2026_01",
    sourceUrl: "https://www.cbj.gov.jo/ebv4.0/root_storage/en/eb_list_page/january_2026-0.pdf",
    sourcePublishedAt: "2026-01-01",
    status: "monthly",
  },
  {
    metricKey: "overdraft_interest_rate",
    metricName: "Weighted average overdraft interest rate",
    category: "lending_conditions",
    value: 8.14,
    unit: "percent",
    periodStart: "2025-12-01",
    periodEnd: "2025-12-31",
    frequency: "monthly",
    sourceKey: "cbj_msb_2026_01",
    sourceUrl: "https://www.cbj.gov.jo/ebv4.0/root_storage/en/eb_list_page/january_2026-0.pdf",
    sourcePublishedAt: "2026-01-01",
    status: "monthly",
    notes: "58bp lower than end-2024 level per CBJ MSB.",
  },
  {
    metricKey: "overdraft_interest_rate",
    metricName: "Weighted average overdraft interest rate",
    category: "lending_conditions",
    value: 8.72,
    unit: "percent",
    periodStart: "2024-12-01",
    periodEnd: "2024-12-31",
    frequency: "monthly",
    sourceKey: "cbj_msb_2026_01",
    sourceUrl: "https://www.cbj.gov.jo/ebv4.0/root_storage/en/eb_list_page/january_2026-0.pdf",
    sourcePublishedAt: "2026-01-01",
    status: "monthly",
  },
];
