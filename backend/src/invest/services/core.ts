import { prisma } from "../../prisma";
import {
  PROJECT_COA,
  computeOwnershipFromCapital,
  type CommissionRuleInput,
  type MoneyString,
} from "../finance";
import { dstr } from "../lib/moneyField";
import { Decimal } from "../finance/decimal";

const DEFAULT_ORG_SLUG = "alshantaf";

export async function ensureDefaultOrganization() {
  let org = await prisma.invOrganization.findUnique({ where: { slug: DEFAULT_ORG_SLUG } });
  if (!org) {
    org = await prisma.invOrganization.create({
      data: { name: "Al Shantaf", slug: DEFAULT_ORG_SLUG, baseCurrency: "JOD", timezone: "Asia/Amman" },
    });
    await seedChartOfAccounts(org.id);
  } else {
    const count = await prisma.invLedgerAccount.count({ where: { organizationId: org.id } });
    if (count === 0) await seedChartOfAccounts(org.id);
  }
  return org;
}

async function seedChartOfAccounts(organizationId: string) {
  const rows: { code: string; name: string; accountType: string }[] = [
    { code: PROJECT_COA.CASH, name: "Cash", accountType: "asset" },
    { code: PROJECT_COA.BANK, name: "Bank", accountType: "asset" },
    { code: PROJECT_COA.LAND_ASSET, name: "Land asset", accountType: "asset" },
    { code: PROJECT_COA.EXPENSE, name: "Project expenses", accountType: "expense" },
    { code: PROJECT_COA.REIMBURSEMENT_PAYABLE, name: "Reimbursement payable", accountType: "liability" },
    { code: PROJECT_COA.INVESTOR_CAPITAL, name: "Investor capital", accountType: "equity" },
    { code: PROJECT_COA.PROJECT_REVENUE, name: "Project revenue", accountType: "revenue" },
    { code: PROJECT_COA.MANAGEMENT_FEE, name: "Management fees", accountType: "expense" },
    { code: PROJECT_COA.DISTRIBUTIONS, name: "Investor distributions", accountType: "equity" },
    { code: PROJECT_COA.ROUNDING, name: "Rounding", accountType: "equity" },
  ];
  for (const row of rows) {
    await prisma.invLedgerAccount.upsert({
      where: { organizationId_code: { organizationId, code: row.code } },
      create: { organizationId, ...row, currency: "JOD" },
      update: { name: row.name },
    });
  }
}

export type ResolvedPartner = {
  partnerId: string;
  investorId: string;
  membershipId: string;
  label: string;
  code: string | null;
  phone: string | null;
  isCoordinator: boolean;
  /** Per-partner coordinator cut override (null = project default). */
  commissionPercent: string | null;
  notes: string | null;
  joinedAt: string;
  capitalContributed: MoneyString;
  ownershipPercent: MoneyString;
  /** Approved partner-paid expenses still to be reimbursed. */
  expensesOutstanding: MoneyString;
  /** Pending (not yet approved) partner-paid expenses. */
  expensesPending: MoneyString;
  ownershipMode: "capital" | "manual";
};

/** Resolve live ownership + capital + unreimbursed expenses for settlement. */
export async function resolveProjectPartners(projectId: string): Promise<ResolvedPartner[]> {
  const memberships = await prisma.invMembership.findMany({
    where: { projectId, active: true },
    include: { investor: true },
    orderBy: [{ isCoordinator: "desc" }, { joinedAt: "asc" }],
  });
  if (memberships.length === 0) return [];

  const contributions = await prisma.invContribution.findMany({
    where: { projectId, approvalStatus: "approved", countsAsEquity: true },
  });
  const capital = new Map<string, Decimal>(memberships.map((m) => [m.investorId, new Decimal(0)]));
  for (const c of contributions) {
    if (!capital.has(c.investorId)) continue;
    const sign = c.kind === "withdrawal" ? -1 : 1;
    capital.set(c.investorId, capital.get(c.investorId)!.plus(new Decimal(dstr(c.amount)).times(sign)));
  }

  const expenses = await prisma.invExpense.findMany({
    where: { projectId, status: { in: ["approved", "pending"] } },
  });
  const coord = memberships.find((m) => m.isCoordinator);
  const outstanding = new Map<string, Decimal>(memberships.map((m) => [m.investorId, new Decimal(0)]));
  const pending = new Map<string, Decimal>(memberships.map((m) => [m.investorId, new Decimal(0)]));
  for (const e of expenses) {
    const payer = e.payerInvestorId ?? (e.paidByCoordinator ? coord?.investorId : undefined);
    if (!payer || !outstanding.has(payer)) continue;
    if (e.status === "pending") {
      pending.set(payer, pending.get(payer)!.plus(new Decimal(dstr(e.amount))));
      continue;
    }
    const due = new Decimal(dstr(e.reimbursementDue)).minus(new Decimal(dstr(e.reimbursementPaid)));
    if (due.lte(0)) continue;
    outstanding.set(payer, outstanding.get(payer)!.plus(due));
  }

  const hasExplicit = memberships.some((m) => m.ownershipPercent != null);
  let percentByInvestor = new Map<string, string>();
  if (hasExplicit) {
    for (const m of memberships) percentByInvestor.set(m.investorId, dstr(m.ownershipPercent ?? 0));
  } else {
    const computed = computeOwnershipFromCapital(
      memberships.map((m) => ({
        partnerId: m.investorId,
        equityCapital: Decimal.max(0, capital.get(m.investorId) ?? 0).toFixed(3),
      }))
    );
    percentByInvestor = new Map(computed.map((c) => [c.partnerId, c.ownershipPercent]));
  }

  return memberships.map((m) => ({
    partnerId: m.investorId,
    investorId: m.investorId,
    membershipId: m.id,
    label: m.investor.displayName || m.investor.legalName,
    code: m.investor.code,
    phone: m.investor.phone,
    isCoordinator: m.isCoordinator,
    commissionPercent: m.commissionPercent != null ? dstr(m.commissionPercent) : null,
    notes: m.notes,
    joinedAt: m.joinedAt.toISOString(),
    capitalContributed: Decimal.max(0, capital.get(m.investorId) ?? 0).toFixed(3),
    ownershipPercent: percentByInvestor.get(m.investorId) ?? "0",
    expensesOutstanding: (outstanding.get(m.investorId) ?? new Decimal(0)).toFixed(3),
    expensesPending: (pending.get(m.investorId) ?? new Decimal(0)).toFixed(3),
    ownershipMode: hasExplicit ? "manual" : "capital",
  }));
}

/** Project rule + per-partner overrides from memberships. */
export function commissionRuleFor(raw: unknown, partners: ResolvedPartner[]): CommissionRuleInput {
  const rule = parseCommissionRule(raw) ?? { basis: "investor_net_profit", percent: 0 };
  const overrides: Record<string, string> = { ...((rule.perInvestorPercent as Record<string, string>) || {}) };
  for (const p of partners) {
    if (p.commissionPercent != null) overrides[p.partnerId] = p.commissionPercent;
  }
  return { ...rule, perInvestorPercent: Object.keys(overrides).length ? overrides : undefined };
}

export function parseCommissionRule(raw: unknown): CommissionRuleInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const basis = String(o.basis || "distributable_profit") as CommissionRuleInput["basis"];
  return {
    basis,
    percent: o.percent != null ? String(o.percent) : 0,
    fixedAmount: o.fixedAmount != null ? String(o.fixedAmount) : 0,
    perInvestorPercent: (o.perInvestorPercent as Record<string, string>) || undefined,
    chargeOnCoordinatorProfit: o.chargeOnCoordinatorProfit !== false,
  };
}

export const PROJECT_STATUSES = [
  "draft",
  "fundraising",
  "capital_collection",
  "acquisition_pending",
  "acquired",
  "active_management",
  "listed_for_sale",
  "sale_pending",
  "sold",
  "settlement_pending",
  "settled",
  "closed",
  "cancelled",
] as const;

export function isProjectStatus(v: string): v is (typeof PROJECT_STATUSES)[number] {
  return (PROJECT_STATUSES as readonly string[]).includes(v);
}
