import { ApiError } from "./api";

const CLIENT_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

async function clientFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CLIENT_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || "Request failed", res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Monetary field as returned by the invest API (no client-side defaults). */
export type InvestMoneyField = {
  amount?: string | number | null;
  currency?: string | null;
  finalized?: boolean | null;
  estimated?: boolean | null;
};

export type InvestProjectStatus =
  | "draft"
  | "fundraising"
  | "capital_collection"
  | "acquisition_pending"
  | "acquired"
  | "active_management"
  | "listed_for_sale"
  | "sale_pending"
  | "sold"
  | "settlement_pending"
  | "settled"
  | "closed"
  | "cancelled"
  | string;

export type InvestProjectSummary = {
  id: string;
  name: string;
  code?: string | null;
  status?: InvestProjectStatus | null;
  location?: string | null;
  currency?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type InvestProjectDetail = InvestProjectSummary & {
  description?: string | null;
  totals?: Record<string, InvestMoneyField | string | number | null | undefined>;
  ownership?: InvestOwnershipSlice[] | null;
  members?: InvestProjectMember[] | null;
  contributions?: InvestContribution[] | null;
  expenses?: InvestExpense[] | null;
  documents?: InvestDocument[] | null;
  settlements?: InvestSettlementSummary[] | null;
};

export type InvestOwnershipSlice = {
  id?: string;
  label: string;
  percent?: number | string | null;
  amount?: InvestMoneyField | string | number | null;
};

export type InvestProjectMember = {
  id: string;
  investorId: string;
  investorName?: string | null;
  ownershipPercent?: number | string | null;
  role?: string | null;
  joinedAt?: string | null;
};

export type InvestContribution = {
  id: string;
  investorId?: string | null;
  investorName?: string | null;
  amount?: InvestMoneyField | string | number | null;
  contributedAt?: string | null;
  status?: string | null;
  notes?: string | null;
};

export type InvestExpense = {
  id: string;
  title?: string | null;
  category?: string | null;
  amount?: InvestMoneyField | string | number | null;
  status?: "pending" | "approved" | "rejected" | string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  finalized?: boolean | null;
};

export type InvestDocument = {
  id: string;
  name?: string | null;
  url?: string | null;
  kind?: string | null;
  uploadedAt?: string | null;
};

export type InvestSettlementSummary = {
  id: string;
  status?: string | null;
  createdAt?: string | null;
  finalized?: boolean | null;
};

export type InvestSettlementDetail = InvestSettlementSummary & {
  lines?: Record<string, unknown>[] | null;
  totals?: Record<string, InvestMoneyField | string | number | null | undefined> | null;
  hypothetical?: boolean | null;
};

export type InvestInvestor = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  nationalId?: string | null;
  notes?: string | null;
  active?: boolean | null;
  createdAt?: string | null;
  projectIds?: string[] | null;
  totals?: Record<string, InvestMoneyField | string | number | null | undefined> | null;
};

export type InvestDashboard = {
  totals?: Record<string, InvestMoneyField | string | number | null | undefined>;
  counts?: Record<string, number | null | undefined>;
  projects?: InvestProjectSummary[] | null;
  recent?: Record<string, unknown>[] | null;
};

export type InvestSimulationInput = {
  exitValue?: number | string | null;
  discountRate?: number | string | null;
  holdingMonths?: number | null;
  notes?: string | null;
  [key: string]: unknown;
};

export type InvestSimulationResult = {
  hypothetical: true;
  summary?: Record<string, InvestMoneyField | string | number | null | undefined>;
  allocations?: InvestOwnershipSlice[] | Record<string, unknown>[] | null;
  warnings?: string[] | null;
};

export type InvestPortalSession = {
  id: string;
  email?: string | null;
  name?: string | null;
  investorId?: string | null;
};

export type InvestPortalDashboard = {
  totals?: Record<string, InvestMoneyField | string | number | null | undefined>;
  projects?: InvestProjectSummary[] | null;
};

export type InvestPortalProject = {
  project?: InvestProjectSummary | null;
  membership?: InvestProjectMember | null;
  contributions?: InvestContribution[] | null;
  ownership?: InvestOwnershipSlice[] | null;
  totals?: Record<string, InvestMoneyField | string | number | null | undefined> | null;
};

export const investApi = {
  dashboard: () => clientFetch<InvestDashboard>("/invest/dashboard"),

  projects: () => clientFetch<InvestProjectSummary[]>("/invest/projects"),
  createProject: (data: Record<string, unknown>) =>
    clientFetch<InvestProjectSummary>("/invest/projects", { method: "POST", body: JSON.stringify(data) }),
  project: (id: string) => clientFetch<InvestProjectDetail>(`/invest/projects/${id}`),
  updateProject: (id: string, data: Record<string, unknown>) =>
    clientFetch<InvestProjectDetail>(`/invest/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  setProjectStatus: (id: string, data: { status: InvestProjectStatus; note?: string }) =>
    clientFetch<InvestProjectDetail>(`/invest/projects/${id}/status`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  investors: () => clientFetch<InvestInvestor[]>("/invest/investors"),
  createInvestor: (data: Record<string, unknown>) =>
    clientFetch<InvestInvestor>("/invest/investors", { method: "POST", body: JSON.stringify(data) }),
  investor: (id: string) => clientFetch<InvestInvestor>(`/invest/investors/${id}`),
  updateInvestor: (id: string, data: Record<string, unknown>) =>
    clientFetch<InvestInvestor>(`/invest/investors/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  addProjectMember: (projectId: string, data: Record<string, unknown>) =>
    clientFetch<InvestProjectMember>(`/invest/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listProjectContributions: (projectId: string) =>
    clientFetch<InvestContribution[]>(`/invest/projects/${projectId}/contributions`),
  createProjectContribution: (projectId: string, data: Record<string, unknown>) =>
    clientFetch<InvestContribution>(`/invest/projects/${projectId}/contributions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  projectExpenses: (projectId: string) =>
    clientFetch<InvestExpense[]>(`/invest/projects/${projectId}/expenses`),
  createProjectExpense: (projectId: string, data: Record<string, unknown>) =>
    clientFetch<InvestExpense>(`/invest/projects/${projectId}/expenses`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  approveExpense: (expenseId: string, data?: Record<string, unknown>) =>
    clientFetch<InvestExpense>(`/invest/expenses/${expenseId}/approve`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  rejectExpense: (expenseId: string, data?: Record<string, unknown>) =>
    clientFetch<InvestExpense>(`/invest/expenses/${expenseId}/reject`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),

  simulateSettlement: (projectId: string, data: InvestSimulationInput) =>
    clientFetch<InvestSimulationResult>(`/invest/projects/${projectId}/simulate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createSettlement: (projectId: string, data?: Record<string, unknown>) =>
    clientFetch<InvestSettlementDetail>(`/invest/projects/${projectId}/settlements`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  settlement: (projectId: string, settlementId: string) =>
    clientFetch<InvestSettlementDetail>(`/invest/projects/${projectId}/settlements/${settlementId}`),

  portalLogin: (email: string, password: string) =>
    clientFetch<InvestPortalSession>("/invest/portal/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  portalLogout: () => clientFetch<void>("/invest/portal/logout", { method: "POST", body: JSON.stringify({}) }),
  portalMe: () => clientFetch<InvestPortalSession>("/invest/portal/me"),
  portalDashboard: () => clientFetch<InvestPortalDashboard>("/invest/portal/dashboard"),
  portalProjects: () => clientFetch<InvestProjectSummary[]>("/invest/portal/projects"),
  portalProject: (id: string) => clientFetch<InvestPortalProject>(`/invest/portal/projects/${id}`),
};
// ─────────────────────────────────────────────────────────────
// Partnership CRM (v2) — richer shapes used by the admin workspace.
// ─────────────────────────────────────────────────────────────

export type CommissionBasis = "investor_net_profit" | "distributable_profit" | "sale_value" | "fixed" | "hybrid";

export type CommissionRule = {
  basis: CommissionBasis;
  percent?: string | number | null;
  fixedAmount?: string | number | null;
};

export type PartnerRow = {
  id: string;
  code: string | null;
  name: string;
  legalName: string;
  kind: "individual" | "company" | string;
  email: string | null;
  phone: string | null;
  city: string | null;
  nationalIdLast4: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  projectIds: string[];
  projectCount: number;
  openProjectCount: number;
  coordinatorOf: number;
  portal: { email: string; active: boolean } | null;
  totals: { contributedCapital: InvestMoneyField };
};

export type PartnerProjectRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  currency: string;
  active: boolean;
  role: "coordinator" | "investor";
  ownershipPercent: string | null;
  capital: string;
  expensesOutstanding: string;
  commissionPercent: string | null;
  joinedAt: string;
  settlement: {
    grossProfit: string;
    commissionPaid: string;
    profitShare: string;
    commissionEarned: string;
    totalPayout: string;
    paidAmount: string;
    paidAt: string | null;
  } | null;
};

export type PartnerFull = Omit<PartnerRow, "projectCount" | "openProjectCount" | "coordinatorOf" | "totals"> & {
  displayName: string | null;
  address: string | null;
  nationalId: string | null;
  bankDetails: string | null;
  hasNationalId?: boolean;
  hasBankDetails?: boolean;
  projects: PartnerProjectRow[];
  contributions: {
    id: string;
    projectId: string;
    projectName: string;
    kind: string;
    amount: string;
    currency: string;
    contributedAt: string;
    status: string;
    notes: string | null;
  }[];
  expenses: {
    id: string;
    projectId: string;
    projectName: string;
    title: string;
    category: string | null;
    amount: string;
    expenseDate: string;
    status: string;
  }[];
  portal: { email: string; active: boolean; lastLoginAt: string | null } | null;
  totals: Record<"contributedCapital" | "outstandingReimbursements" | "realizedProfit" | "paidOut" | "toReceive", InvestMoneyField>;
};

export type ProjectStats = {
  partnerCount: number;
  capital: string;
  purchasePrice: string | null;
  fundingPercent: string | null;
  fundingGap: string | null;
  poolCash: string;
  expensesApproved: string;
  expensesPending: string;
  expensesPendingCount: number;
  expensesPartnerPaid: string;
  expensesPoolPaid: string;
  totalCost: string;
  totalInvested: string;
  targetSalePrice: string | null;
  actualSalePrice: string | null;
  projectedProfit: string | null;
  projectedRoiPercent: string | null;
  coordinator: { investorId: string; name: string } | null;
};

export type ProjectListRow = InvestProjectSummary & { plotParcelNo: string | null; stats: ProjectStats };

export type ProjectMember = {
  id: string;
  investorId: string;
  investorName: string;
  code: string | null;
  phone: string | null;
  ownershipPercent: string;
  ownershipMode: "capital" | "manual";
  role: "coordinator" | "investor";
  isCoordinator: boolean;
  commissionPercent: string | null;
  effectiveCommissionPercent: string | null;
  capital: string;
  expensesOutstanding: string;
  expensesPending: string;
  expenseBurden?: string;
  notes: string | null;
  joinedAt: string;
};

export type ProjectExpense = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  amount: InvestMoneyField;
  expenseDate: string;
  status: "pending" | "approved" | "rejected" | "reimbursed" | "written_off" | string;
  submittedAt: string;
  approvedAt: string | null;
  rejectedReason: string | null;
  finalized: boolean;
  fundedBy: "partner" | "project";
  payerInvestorId: string | null;
  payerName: string | null;
  payerCode: string | null;
  reimbursable: boolean;
  splitMode: "ownership" | "equal" | "custom" | string;
  splitShares: Record<string, string> | null;
  /** Who carries this expense (amount + % per partner). */
  allocation?: { investorId: string; percent: string; amount: string }[];
  /** Custom split no longer matches any active partner → falls back to ownership. */
  splitFallback?: boolean;
};

export type ProjectContribution = {
  id: string;
  investorId: string;
  investorName: string;
  investorCode: string | null;
  amount: InvestMoneyField;
  contributedAt: string;
  status: string;
  notes: string | null;
  kind: string;
  paymentMethod: string | null;
  paymentRef: string | null;
  edited?: boolean;
};

export type SellerInstallment = {
  id: string;
  label: string;
  amount: string;
  dueDate: string | null;
  paidDate: string | null;
  note: string | null;
};

export type ContractDetails = {
  contractNo: string | null;
  contractDate: string | null;
  sellerName: string | null;
  sellerIdNo: string | null;
  sellerPhone: string | null;
  registeredTo: string | null;
  deedNo: string | null;
  registryOffice: string | null;
  village: string | null;
  basin: string | null;
  plotNo: string | null;
  brokerName: string | null;
  brokerFee: string | null;
  contractPrice: string | null;
  downPayment: string | null;
  downPaymentDate: string | null;
  paymentTerms: string | null;
  transferDate: string | null;
  notes: string | null;
  installments: SellerInstallment[];
};

export type ContractProgress = {
  price: string;
  paid: string;
  remaining: string;
  scheduled: string;
  unscheduled: string;
  overdue: string;
  paidPercent: string | null;
};

export type ProjectCosts = {
  purchasePrice: string;
  expensesTotal: string;
  totalCost: string;
  costPerSqm: string | null;
  byCategory: { category: string; amount: string; count: number; percentOfCost: string }[];
  perPartner: {
    investorId: string;
    name: string;
    code: string | null;
    isCoordinator: boolean;
    ownershipPercent: string;
    capital: string;
    expensesPaid: string;
    landShare: string;
    expenseShare: string;
    expenseSharePercent: string;
    costShare: string;
    costSharePercent: string;
    balance: string;
  }[];
};

export type ProjectValuation = {
  value: string;
  date: string | null;
  note: string | null;
  gain: string;
  gainPercent: string | null;
  perSqm: string | null;
  lines: { investorId: string; name: string; totalPayout: string; netGain: string; profitShare: string; roiPercent: string }[];
  error?: string;
};

export type ProjectFull = InvestProjectSummary & {
  description: string | null;
  city: string | null;
  area: string | null;
  landLocation: string | null;
  plotParcelNo: string | null;
  landAreaSqm: string | null;
  purchaseDate: string | null;
  expectedSaleDate: string | null;
  actualSaleDate: string | null;
  agreementNotes: string | null;
  contract: ContractDetails | null;
  contractProgress: ContractProgress;
  estimatedValue: string | null;
  estimatedValueDate: string | null;
  estimatedValueNote: string | null;
  costs: ProjectCosts;
  valuation: ProjectValuation | null;
  commissionRule: CommissionRule;
  coordinatorParticipatesInProfit: boolean;
  shareLossesByOwnership: boolean;
  closed: boolean;
  stats: ProjectStats;
  purchasePrice: InvestMoneyField;
  targetSalePrice: InvestMoneyField;
  actualSalePrice: InvestMoneyField;
  ownership: InvestOwnershipSlice[];
  members: ProjectMember[];
  contributions: ProjectContribution[];
  expenses: ProjectExpense[];
  settlements: InvestSettlementSummary[];
  statusHistory: { id: string; from: string | null; to: string; note: string | null; actor: string | null; at: string }[];
};

export type DistributionLine = {
  partnerId: string;
  label: string;
  code?: string | null;
  phone?: string | null;
  isCoordinator: boolean;
  ownershipPercent: string;
  capitalContributed?: string;
  expensesPaid?: string;
  capitalReturned: string;
  expenseReimbursement: string;
  expenseSplitAdjustment?: string;
  grossProfit: string;
  commissionPaid: string;
  commissionRatePercent?: string;
  profitShare: string;
  commissionEarned: string;
  totalPayout: string;
  netGain?: string;
  roiPercent?: string;
  profitPercentBefore?: string;
  profitPercentAfter?: string;
  paidAmount?: string;
  paidAt?: string | null;
  paidRef?: string | null;
};

export type DistributionResult = {
  hypothetical?: boolean;
  currency: string;
  saleProceeds: string;
  closingCosts: string;
  unpaidLiabilities: string;
  netProceedsAfterCosts: string;
  totalCapitalReturned: string;
  totalExpenseReimbursements: string;
  distributableProfitBeforeCommission: string;
  coordinatorCommission: string;
  distributableProfitAfterCommission: string;
  totalPayouts: string;
  residualCash: string;
  lossShared: boolean;
  balanced: boolean;
  lines: DistributionLine[];
  notes: string[];
};

export type PostedSettlement = {
  id: string;
  status: string;
  createdAt: string;
  postedAt: string | null;
  finalized: boolean;
  currency: string;
  summary: DistributionResult | null;
  totals: Record<"saleProceeds" | "closingCosts" | "totalPayouts" | "totalPaid", InvestMoneyField>;
  lines: DistributionLine[];
};

const qs = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const crmApi = {
  meta: () => clientFetch<{ expenseCategories: string[] }>("/invest/meta"),
  partners: (q?: string, active?: string) => clientFetch<PartnerRow[]>(`/invest/investors${qs({ q, active })}`),
  partner: (id: string) => clientFetch<PartnerFull>(`/invest/investors/${id}`),
  createPartner: (data: Record<string, unknown>) =>
    clientFetch<PartnerRow>("/invest/investors", { method: "POST", body: JSON.stringify(data) }),
  updatePartner: (id: string, data: Record<string, unknown>) =>
    clientFetch<PartnerFull>(`/invest/investors/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  revealPartner: (id: string) =>
    clientFetch<{ nationalId: string | null; bankDetails: string | null }>(`/invest/investors/${id}/reveal`, {
      method: "POST",
      body: "{}",
    }),
  duplicates: (data: Record<string, unknown>) =>
    clientFetch<PartnerRow[]>("/invest/investors/duplicates", { method: "POST", body: JSON.stringify(data) }),

  projects: (q?: string, status?: string) => clientFetch<ProjectListRow[]>(`/invest/projects${qs({ q, status })}`),
  project: (id: string) => clientFetch<ProjectFull>(`/invest/projects/${id}`),
  createProject: (data: Record<string, unknown>) =>
    clientFetch<InvestProjectSummary>("/invest/projects", { method: "POST", body: JSON.stringify(data) }),
  updateProject: (id: string, data: Record<string, unknown>) =>
    clientFetch<ProjectFull>(`/invest/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  setStatus: (id: string, status: string, note?: string) =>
    clientFetch<ProjectFull>(`/invest/projects/${id}/status`, { method: "POST", body: JSON.stringify({ status, note }) }),

  addMember: (projectId: string, data: Record<string, unknown>) =>
    clientFetch<unknown>(`/invest/projects/${projectId}/members`, { method: "POST", body: JSON.stringify(data) }),
  updateMember: (projectId: string, investorId: string, data: Record<string, unknown>) =>
    clientFetch<ProjectFull>(`/invest/projects/${projectId}/members/${investorId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  removeMember: (projectId: string, investorId: string) =>
    clientFetch<ProjectFull>(`/invest/projects/${projectId}/members/${investorId}`, { method: "DELETE" }),

  addContribution: (projectId: string, data: Record<string, unknown>) =>
    clientFetch<unknown>(`/invest/projects/${projectId}/contributions`, { method: "POST", body: JSON.stringify(data) }),
  reverseContribution: (id: string, reason?: string) =>
    clientFetch<unknown>(`/invest/contributions/${id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }),
  updateContribution: (id: string, data: Record<string, unknown>) =>
    clientFetch<ProjectContribution>(`/invest/contributions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteContribution: (id: string, reason?: string) =>
    clientFetch<unknown>(`/invest/contributions/${id}${qs({ reason })}`, { method: "DELETE" }),

  addExpense: (projectId: string, data: Record<string, unknown>) =>
    clientFetch<ProjectExpense>(`/invest/projects/${projectId}/expenses`, { method: "POST", body: JSON.stringify(data) }),
  approveExpense: (id: string) => clientFetch<unknown>(`/invest/expenses/${id}/approve`, { method: "POST", body: "{}" }),
  reverseExpense: (id: string, reason?: string) =>
    clientFetch<unknown>(`/invest/expenses/${id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }),
  updateExpense: (id: string, data: Record<string, unknown>) =>
    clientFetch<ProjectExpense>(`/invest/expenses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteExpense: (id: string, reason?: string) =>
    clientFetch<unknown>(`/invest/expenses/${id}${qs({ reason })}`, { method: "DELETE" }),

  preview: (data: Record<string, unknown>) =>
    clientFetch<DistributionResult>("/invest/preview", { method: "POST", body: JSON.stringify(data) }),
  simulate: (projectId: string, data: Record<string, unknown>) =>
    clientFetch<DistributionResult>(`/invest/projects/${projectId}/simulate`, { method: "POST", body: JSON.stringify(data) }),
  settle: (projectId: string, data: Record<string, unknown>) =>
    clientFetch<PostedSettlement>(`/invest/projects/${projectId}/settlements`, { method: "POST", body: JSON.stringify(data) }),
  settlement: (projectId: string) =>
    clientFetch<{ settlement: PostedSettlement | null }>(`/invest/projects/${projectId}/settlement`),
  markPayout: (projectId: string, settlementId: string, partnerId: string, data: Record<string, unknown>) =>
    clientFetch<PostedSettlement>(`/invest/projects/${projectId}/settlements/${settlementId}/payouts/${partnerId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
