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