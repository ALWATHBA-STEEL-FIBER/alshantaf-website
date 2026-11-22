export type IndustryType =
  | "lightSpecial"
  | "light"
  | "mediumSpecial"
  | "medium"
  | "industrialCraft"
  | "industrialHeavy"
  | "industrialTransformative"
  | "industrialGeneral"
  | "agriToIndustrial"
  | "technical"
  | "residentialA"
  | "residentialB"
  | "residentialC"
  | "residentialD"
  | "residentialPopular"
  | "residentialHighDensity"
  | "residentialGreen"
  | "greenWithinA"
  | "greenWithinB"
  | "greenWithinC"
  | "greenWithinD"
  | "residentialPrivateA"
  | "residentialPrivateB"
  | "residentialPrivateC"
  | "residentialRural"
  | "residentialAgri"
  | "agriFacilities"
  | "commercialCentral"
  | "commercialShowrooms"
  | "commercialLinear"
  | "commercialOffice"
  | "commercialIndustrial"
  | "commercialNeighborhoodService"
  | "commercialCenter"
  | "commercialOrdinaryA"
  | "commercialOrdinaryB"
  | "commercialOrdinaryC"
  | "commercialWithinD"
  | "commercialLocal"
  | "commercialComplex"
  | "mixedUse"
  | "mixedUseUrban"
  | "mixedUseEntertainment"
  | "commercialOutsideCentral"
  | "commercialOutsideShowrooms"
  | "commercialOutsideLinear"
  | "commercialOutsideLocal";
export type DealType = "sale" | "rent" | "sale_or_rent" | "partnership";
export type PropertyStatus = "available" | "reserved" | "sold" | "rented" | "canceled";
export type PublishStatus = "published" | "draft" | "archived";
export type PresenterRole = "owner" | "presenter" | "broker" | "company" | "other";
export type SubmissionStatus = "pending" | "duplicate_review" | "needs_info" | "approved" | "rejected";
export type LandCheckStatus = "new" | "contacted" | "closed";

export type OfferImportance = "none" | "golden" | "platinum" | "titanium";

export interface Listing {
  id: string;
  listingNo: string;
  title: string;
  area: string;
  propertyType: string | null;
  industryType: IndustryType;
  dealType: DealType;
  size: string | null;
  price: string | null;
  governorate: string | null;
  directorate: string | null;
  village: string | null;
  basin: string | null;
  neighborhood: string | null;
  parcel: string | null;
  locationUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  administrativeValue: number | null;
  administrativeValueSource: string | null;
  administrativeValueAt: string | null;
  phone: string | null;
  status: PropertyStatus;
  publishStatus: PublishStatus;
  featured: boolean;
  /** Admin-curated rank; titanium is shown on the landing page. */
  importance?: OfferImportance;
  presenterRole: PresenterRole | null;
  presenterName: string | null;
  showPresenter: boolean;
  /** When false, public offer hides DLS mid-range (rate × area) estimate. */
  showEstimatedValue: boolean;
  description: string;
  internalNotes: string | null;
  mainImage: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  images: string[];
  video: string | null;
  document: string | null;
  viewCount: number;
  ownerAccessCode?: string | null;
  smsOptIn?: boolean;
  notifiedMilestones?: number[];
}

export interface Submission {
  id: string;
  serialNo: string;
  trackingCode: string;
  source: "owner" | "broker";
  applicant: string;
  phone: string;
  office: string | null;
  whatsapp: string | null;
  email: string | null;
  authExpiry: string | null;
  governorate: string | null;
  directorate: string | null;
  village: string | null;
  basin: string | null;
  parcel: string | null;
  neighborhood: string | null;
  coordinates: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  administrativeValue: number | null;
  administrativeValueSource: string | null;
  administrativeValueAt: string | null;
  dlsKey: string | null;
  area: string | null;
  price: string | null;
  industryType: IndustryType | null;
  activity: string | null;
  details: string;
  images: string[];
  video: string | null;
  document: string | null;
  duplicate: boolean;
  status: SubmissionStatus;
  reviewer: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  convertedListingId: string | null;
}

export interface PublicSettings {
  whatsappNumber: string;
  contactPhone1: string;
  contactPhone2: string;
  contactEmail: string;
  facebookUrl: string;
  instagramUrl: string;
  submissionsEnabled: boolean;
  maintenanceBanner: string;
}

export interface AdminSettings {
  whatsappNumber: string;
  contactPhone1: string;
  contactPhone2: string;
  contactEmail: string;
  facebookUrl: string;
  instagramUrl: string;
  submissionsEnabled: "true" | "false";
  maintenanceBanner: string;
}

export interface AdminAiConfig {
  provider: "auto" | "openai" | "groq";
  openaiModel: string;
  openaiTemperature: number;
  openaiReasoningEffort: "none" | "low" | "medium" | "high";
  openaiMaxCompletionTokens: number;
  openaiKeySet: boolean;
  openaiKeyHint: string | null;
  openaiKeySource: "db" | "env" | null;
  groqModel: string;
  groqTemperature: number;
  groqKeySet: boolean;
  groqKeyHint: string | null;
  groqKeySource: "db" | "env" | null;
  guardEnabled: boolean;
  guardModel: string;
  guardThreshold: number;
  activeProvider: "openai" | "groq" | null;
  activeModel: string | null;
}

export type AdminAiConfigPatch = {
  provider?: "auto" | "openai" | "groq";
  openaiModel?: string;
  openaiTemperature?: number;
  openaiReasoningEffort?: "none" | "low" | "medium" | "high";
  openaiMaxCompletionTokens?: number;
  openaiApiKey?: string;
  clearOpenaiApiKey?: boolean;
  groqModel?: string;
  groqTemperature?: number;
  groqApiKey?: string;
  clearGroqApiKey?: boolean;
  guardEnabled?: boolean;
  guardModel?: string;
  guardThreshold?: number;
};

export interface AuditLogEntry {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface SiteViewSeries {
  days: number;
  totalViews: number;
  totalUniques: number;
  points: Array<{ date: string; views: number; uniqueVisitors: number }>;
}

export interface UniqueIpSeries {
  days: number;
  uniqueIps: number;
  totalHits: number;
  points: Array<{ date: string; uniqueIps: number }>;
}

export interface DashboardData {
  listings: { total: number; byPublishStatus: Record<string, number>; byStatus: Record<string, number> };
  submissions: { total: number; byStatus: Record<string, number> };
  landChecks: { total: number; byStatus: Record<string, number> };
  contactRequests: { total: number; byStatus: Record<string, number> };
  storage: { fileCount: number; totalBytes: number };
  recentAudit: AuditLogEntry[];
  siteViews?: {
    day1: SiteViewSeries;
    day7: SiteViewSeries;
    day30: SiteViewSeries;
  };
  uniqueIps?: {
    day1: UniqueIpSeries;
    day7: UniqueIpSeries;
    day30: UniqueIpSeries;
  };
}

export interface SiteDevice {
  id: string;
  visitorId: string;
  displayName: string | null;
  nameLocked: boolean;
  namedAt: string | null;
  ip: string | null;
  userAgent: string | null;
  language: string | null;
  platform: string | null;
  screen: string | null;
  timezone: string | null;
  lastPath: string;
  requestCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface SiteDeviceEvent {
  id: string;
  deviceId: string;
  ip: string | null;
  path: string;
  userAgent: string | null;
  createdAt: string;
}

export interface MonitorSummary {
  totalDevices: number;
  namedDevices: number;
  onlineDevices: number;
  eventsLast24h: number;
  uniqueIps: {
    day1: number;
    day7: number;
    day30: number;
    series1: UniqueIpSeries;
    series7: UniqueIpSeries;
    series30: UniqueIpSeries;
  };
}

export interface MediaItem {
  filename: string;
  url: string;
  size: number;
  modifiedAt: string | null;
  used: boolean;
}

export interface StandbyImage {
  id: string;
  url: string;
  title: string | null;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  permissions: string[];
  createdAt: string;
}

export interface TeamMember {
  name: string;
  phone: string | null;
  whatsapp: string | null;
}

export interface SubmissionTracking {
  serialNo: string;
  status: SubmissionStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  village: string | null;
  convertedListingId: string | null;
}

export interface PresenceInfo {
  count: number;
  paths: Record<string, number>;
}

export interface LandCheck {
  id: string;
  serialNo: string;
  clientKey?: string | null;
  isDraft?: boolean;
  name: string | null;
  phone: string | null;
  email: string | null;
  governorate: string | null;
  directorate: string | null;
  village: string | null;
  basin: string | null;
  neighborhood: string | null;
  parcel: string | null;
  coordinates: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  dlsKey: string | null;
  areaSqm: number | null;
  areaLabel: string | null;
  perimeterM?: number | null;
  administrativeValue: number | null;
  administrativeValueSource: string | null;
  administrativeValueAt: string | null;
  estimatedMedian: number | null;
  industryType: IndustryType | null;
  notes: string | null;
  status: LandCheckStatus;
  adminNotes: string | null;
  reviewer: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

export type ContactRequestStatus = "new" | "contacted" | "closed";

export interface ContactRequest {
  id: string;
  serialNo: string;
  name: string;
  phone: string;
  requestType: string;
  industryType: string | null;
  activityType: string | null;
  details: string;
  status: ContactRequestStatus;
  adminNotes: string | null;
  reviewer: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export type OrderBrand = "alshantaf" | "steelfiber";
export type OrderKind = "payments" | "installments" | "one_time" | "service";
export type OrderStatus = "open" | "closed" | "void";
export type OrderInstallmentStatus = "due" | "paid" | "skipped";

export interface CustomerOrder {
  id: string;
  serialNo: string;
  brand: OrderBrand;
  kind: OrderKind;
  status: OrderStatus;
  customerName: string;
  customerPhone: string | null;
  title: string;
  notes: string | null;
  currency: string;
  totalAmount: string;
  paidAmount: string;
  balanceAmount: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  lines: Array<{
    id: string;
    description: string;
    quantity: string;
    unitAmount: string;
    amount: string;
    sortOrder: number;
  }>;
  payments: Array<{
    id: string;
    amount: string;
    paidAt: string;
    method: string | null;
    note: string | null;
    markedBy: string;
  }>;
  installments: Array<{
    id: string;
    dueDate: string;
    amount: string;
    status: OrderInstallmentStatus;
    paidAt: string | null;
    note: string | null;
    sortOrder: number;
  }>;
  tokenPrefix: string | null;
  shareUrl: string | null;
}

export interface PublicOrderPayload {
  order: {
    serialNo: string;
    brand: OrderBrand;
    kind: OrderKind;
    status: OrderStatus;
    customerName: string;
    customerPhone: string | null;
    title: string;
    notes: string | null;
    currency: string;
    totalAmount: string;
    paidAmount: string;
    balanceAmount: string;
    createdAt: string;
    lines: Array<{
      description: string;
      quantity: string;
      unitAmount: string;
      amount: string;
    }>;
    payments: Array<{
      amount: string;
      paidAt: string;
      method: string | null;
      note: string | null;
    }>;
    installments: Array<{
      dueDate: string;
      amount: string;
      status: OrderInstallmentStatus;
      paidAt: string | null;
      note: string | null;
    }>;
  };
  brand: {
    id?: "alshantaf" | "steelfiber";
    nameAr: string;
    nameEn: string;
    domain: string;
    accent: string;
    logoUrl?: string;
    logoPrintUrl?: string;
    theme?: {
      primary: string;
      accent: string;
      accentSoft: string;
      bg: string;
      surface: string;
      ink: string;
      muted: string;
      line: string;
      soft: string;
      headerBg: string;
      headerFg: string;
      fontDisplay: string;
      fontBody: string;
      radius: string;
    };
  };
}

export interface AssistantOfferCard {
  id: string;
  listingNo: string;
  title: string;
  area: string;
  price: string | null;
  size: string | null;
  status: string;
  industryType: string;
  dealType: string;
  mainImage: string | null;
  featured: boolean;
  phone: string | null;
  description: string;
}

export interface AssistantServiceCard {
  id: string;
  title: string;
  note: string;
  href: string;
  cta: string;
  external?: boolean;
}

export type AssistantCard =
  | { type: "offer"; offer: AssistantOfferCard }
  | { type: "service"; service: AssistantServiceCard };

export interface AssistantChatResponse {
  reply: string;
  cards: AssistantCard[];
}

export interface SiteEngineer {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role?: "ENGINEER" | "COORDINATOR";
  isCoordinator?: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  projects: Array<{ id: string; name: string; code: string | null }>;
  coordinatedProjects?: Array<{ id: string; name: string; code: string | null }>;
}

export interface SiteWorker {
  id: string;
  name: string;
  employeeCode: string | null;
  notes: string | null;
  dailyPay: string;
  extraHourPay: string;
  owedAmount: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  projects: Array<{ id: string; name: string; code: string | null }>;
}

export interface SiteWorkerDetail extends SiteWorker {
  fullName: string | null;
  assignments: Array<{
    projectId: string;
    project: { id: string; name: string; code: string | null; active: boolean; weekCounter: number };
    displayName: string | null;
    jobTitle: string | null;
    hourlyRate: string;
    sortOrder: number;
    assignedAt: string;
    daysWorked: number;
    totalRegular: string;
    totalExtra: string;
    recordCount: number;
  }>;
  payouts: Array<{
    id: string;
    projectId: string;
    weekStart: string;
    daysWorked: number;
    totalExtraHours: string;
    amount: string;
    paid: boolean;
    paidAt: string | null;
    paidBy: string | null;
  }>;
  recentDays: Array<{
    id: string;
    projectId: string;
    project: { id: string; name: string; code: string | null };
    workDate: string;
    dayName: string;
    regularHours: string;
    extraHours: string;
    notes: string | null;
  }>;
  totals: {
    daysWorked: number;
    totalRegular: string;
    totalExtra: string;
    recordCount: number;
    owedAmount: string;
  };
}

export interface SiteProjectCostSummary {
  project: {
    id: string;
    name: string;
    code: string | null;
    active: boolean;
    coordinator: { id: string; name: string } | null;
    workerCount: number;
    recordCount: number;
  };
  range: { from: string | null; to: string | null };
  kpis: {
    expenses: string;
    expenseCount: number;
    labor: string;
    laborPaid: string;
    laborUnpaid: string;
    grandTotal: string;
    budget: string | null;
    budgetRemaining: string | null;
    budgetUsedPct: number | null;
  };
  hours: {
    attendanceRows: number;
    daysWorked: number;
    totalRegular: string;
    totalExtra: string;
  };
  byCategory: Array<{ key: string; label: string; amount: string }>;
  note: string;
  payouts: Array<{
    id: string;
    workerId: string;
    workerName: string;
    weekStart: string;
    daysWorked: number;
    totalExtraHours: string;
    amount: string;
    paid: boolean;
    paidAt: string | null;
  }>;
  recentExpenses: SiteExpense[];
}

export interface SiteProjectDetail extends SiteProject {
  roster: Array<{
    workerId: string;
    name: string;
    employeeCode: string | null;
    active: boolean;
    dailyPay: string;
    extraHourPay: string;
    displayName: string | null;
    jobTitle: string | null;
    hourlyRate: string;
    sortOrder: number;
    assignedAt: string;
    recordCount: number;
    totalRegular: string;
    totalExtra: string;
  }>;
  recentDays: Array<{
    id: string;
    workerId: string;
    worker: { id: string; name: string; employeeCode: string | null };
    workDate: string;
    dayName: string;
    regularHours: string;
    extraHours: string;
    notes: string | null;
  }>;
  payouts: Array<{
    id: string;
    workerId: string;
    workerName: string;
    weekStart: string;
    daysWorked: number;
    amount: string;
    paid: boolean;
    paidAt: string | null;
  }>;
  availableWorkers: Array<{
    id: string;
    name: string;
    employeeCode: string | null;
    dailyPay: string;
    extraHourPay: string;
  }>;
  costSummary?: SiteProjectCostSummary | null;
}

export interface SiteExcelPreview {
  project: { id: string; name: string; code: string | null };
  filename: string;
  sheetCount: number;
  sheets: Array<{ index: number; name: string; weekNumber: number | null }>;
  activeSheetIndex: number;
  sheet: {
    name: string;
    weekNumber: number | null;
    weekTitle: string | null;
    settlementDate: string | null;
    weekStart: string | null;
    workers: Array<{
      name: string;
      fullName: string | null;
      jobTitle: string;
      hourlyRate: number;
      days: Array<{
        date: string;
        dayLabel: string;
        regularHours: number;
        extraHours: number;
        otherWorks: string | null;
        notes: string | null;
      }>;
      totalRegular: number;
      totalExtra: number;
    }>;
  } | null;
}

export interface SiteWeekPayoutSheet {
  project: { id: string; name: string; code: string | null };
  weekStart: string;
  weekEnd: string;
  weekTotal: string;
  weekUnpaidTotal: string;
  workers: Array<{
    workerId: string;
    name: string;
    employeeCode: string | null;
    active: boolean;
    dailyPay: string;
    extraHourPay: string;
    daysWorked: number;
    /** Paid day-equivalents (regular hours / 8 per day, max 1). */
    dayUnits?: number;
    fullDays?: number;
    partialDays?: number;
    /** Days with only extra hours — paid as extra, not as a day. */
    extraOnlyDays?: number;
    totalRegularHours?: string;
    totalExtraHours: string;
    dayPayTotal: string;
    extraPayTotal: string;
    amount: string;
    owedAmount: string;
    paid: boolean;
    paidAt: string | null;
    paidBy: string | null;
    payoutId: string | null;
    storedAmount: string | null;
  }>;
}

export interface SiteProject {
  id: string;
  name: string;
  code: string | null;
  notes: string | null;
  active: boolean;
  excelFilename?: string | null;
  driveFileId?: string | null;
  weekCounter?: number;
  hasExcel?: boolean;
  driveEnabled?: boolean;
  coordinatorId?: string | null;
  coordinator?: { id: string; name: string } | null;
  budget?: string | null;
  createdAt: string;
  updatedAt: string;
  recordCount: number;
  engineers: Array<{ id: string; name: string; email: string; active: boolean }>;
  workers: Array<{ id: string; name: string; employeeCode: string | null; active: boolean }>;
  engineerIds: string[];
  workerIds: string[];
}

export interface SiteDailyRecord {
  id: string;
  projectId: string;
  workerId: string;
  engineerId: string;
  workDate: string;
  dayName: string;
  regularHours: string;
  extraHours: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  worker?: { id: string; name: string; employeeCode: string | null };
  engineer?: { id: string; name: string; email: string };
  project?: { id: string; name: string; code: string | null };
}

export interface SiteWeekSheet {
  project: { id: string; name: string; code: string | null };
  weekStart: string;
  weekEnd: string;
  includeAll?: boolean;
  rosterCount?: number;
  days: Array<{ date: string; dayName: string }>;
  workers: Array<{
    workerId: string;
    name: string;
    employeeCode: string | null;
    active?: boolean;
    days: Array<{
      date: string;
      dayName: string;
      regularHours: string | null;
      extraHours: string | null;
      notes: string | null;
      recordId: string | null;
      engineerName?: string | null;
    }>;
    totalRegular: string;
    totalExtra: string;
  }>;
}

export interface SiteProjectSummary {
  id: string;
  name: string;
  code: string | null;
  notes: string | null;
  workerCount: number;
  coordinator?: { id: string; name: string } | null;
  isCoordinator?: boolean;
}

export type SiteExpenseScope = "PROJECT" | "COMPANY";

export interface SiteExpenseCategory {
  key: string;
  ar: string;
  en: string;
  scopes: SiteExpenseScope[];
}

export interface SiteExpense {
  id: string;
  scope: SiteExpenseScope;
  projectId: string | null;
  project: { id: string; name: string; code: string | null; coordinator: { id: string; name: string } | null } | null;
  engineerId: string;
  engineer: { id: string; name: string };
  category: string;
  categoryLabel: string;
  description: string;
  amount: string;
  expenseDate: string;
  vendor: string | null;
  paymentMethod: string | null;
  paymentLabel: string;
  invoiceNo: string | null;
  hasReceipt: boolean;
  receiptMime: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
}

export interface SiteExpenseSummary {
  count: number;
  total: string;
  projectTotal: string;
  companyTotal: string;
  byCategory: Array<{ key: string; label: string; amount: string }>;
}

export interface SiteExpenseMeta {
  categories: SiteExpenseCategory[];
  paymentMethods: Array<{ key: string; ar: string; en: string }>;
  projects: Array<{
    id: string;
    name: string;
    code: string | null;
    coordinator: { id: string; name: string } | null;
    isCoordinator: boolean;
  }>;
  me: { id: string; name: string; isAdmin: boolean };
}

export interface SiteExpenseInput {
  scope: SiteExpenseScope;
  projectId?: string | null;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  vendor?: string | null;
  paymentMethod?: string | null;
  invoiceNo?: string | null;
  receiptFile?: string | null;
  receiptMime?: string | null;
  notes?: string | null;
}

export interface SiteEngineerExpenseSummary {
  month: string;
  monthMine: string;
  monthCompanyMine: string;
  monthProjects: string;
  allCompanyMine: string;
  projects: Array<{
    id: string;
    name: string;
    code: string | null;
    coordinator: { id: string; name: string } | null;
    isCoordinator: boolean;
    expensesMonth: string;
    expensesTotal: string;
    expenseCount: number;
    laborTotal: string;
    laborUnpaid: string;
    grandTotal: string;
    budget: string | null;
    budgetUsedPct: number | null;
  }>;
}

export interface SiteExpenseOverviewProject {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  workerCount: number;
  coordinatorId: string | null;
  expenses: string;
  expensesMonth: string;
  expenseCount: number;
  lastExpenseDate: string | null;
  labor: string;
  laborPaid: string;
  laborUnpaid: string;
  total: string;
  budget: string | null;
  budgetRemaining: string | null;
  budgetUsedPct: number | null;
}

export interface SiteExpenseOverviewGroup {
  projectCount: number;
  projectExpenses: string;
  labor: string;
  laborUnpaid: string;
  companyExpenses: string;
  total: string;
  projects: SiteExpenseOverviewProject[];
}

export interface SiteExpenseOverview {
  range: { from: string | null; to: string | null };
  totals: {
    projectExpenses: string;
    companyExpenses: string;
    labor: string;
    laborUnpaid: string;
    grand: string;
    expenseCount: number;
  };
  coordinators: Array<SiteExpenseOverviewGroup & { id: string; name: string; active: boolean }>;
  unassigned: SiteExpenseOverviewGroup;
  byCategory: Array<{ key: string; label: string; amount: string }>;
  byEngineer: Array<{
    id: string;
    name: string;
    projectExpenses: string;
    companyExpenses: string;
    total: string;
    count: number;
    isCoordinator: boolean;
  }>;
  months: Array<{ month: string; project: string; company: string; total: string }>;
  engineers: Array<{ id: string; name: string; active: boolean; role?: string; isCoordinator?: boolean }>;
}

export interface SiteDayPayload {
  project: { id: string; name: string; code: string | null };
  date: string;
  dayName: string;
  includeAll?: boolean;
  workers: Array<{
    workerId: string;
    name: string;
    employeeCode: string | null;
    jobTitle?: string | null;
    record: { id: string; regularHours: string; extraHours: string; notes: string | null } | null;
  }>;
  roster?: Array<{
    workerId: string;
    name: string;
    employeeCode: string | null;
    jobTitle?: string | null;
  }>;
}
