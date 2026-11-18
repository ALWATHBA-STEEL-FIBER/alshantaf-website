import { prisma } from "../../prisma";
import {
  PROJECT_COA,
  computeOwnershipFromCapital,
  type CommissionRuleInput,
  type MoneyString,
} from "../finance";
import { dstr } from "../lib/moneyField";

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
  label: string;
  isCoordinator: boolean;
  capitalContributed: MoneyString;
  ownershipPercent: MoneyString;
  expensesOutstanding: MoneyString;
};

/** Resolve live ownership + capital + unreimbursed expenses for settlement. */
export async function resolveProjectPartners(projectId: string): Promise<ResolvedPartner[]> {
  const memberships = await prisma.invMembership.findMany({
    where: { projectId, active: true },
    include: { investor: true },
  });
  if (memberships.length === 0) return [];

  const contributions = await prisma.invContribution.findMany({
    where: {
      projectId,
      approvalStatus: { in: ["approved"] },
      countsAsEquity: true,
    },
  });

  const capitalByInvestor = new Map<string, number>();
  for (const m of memberships) capitalByInvestor.set(m.investorId, 0);
  for (const c of contributions) {
    const prev = capitalByInvestor.get(c.investorId) ?? 0;
    capitalByInvestor.set(c.investorId, prev + Number(dstr(c.amount)));
  }

  const expenses = await prisma.invExpense.findMany({
    where: { projectId, status: { in: ["approved"] } },
  });
  const expenseByInvestor = new Map<string, number>();
  for (const m of memberships) expenseByInvestor.set(m.investorId, 0);
  for (const e of expenses) {
    const due = Number(dstr(e.reimbursementDue)) - Number(dstr(e.reimbursementPaid));
    if (due <= 0) continue;
    if (e.payerInvestorId) {
      expenseByInvestor.set(e.payerInvestorId, (expenseByInvestor.get(e.payerInvestorId) ?? 0) + due);
    } else if (e.paidByCoordinator) {
      const coord = memberships.find((m) => m.isCoordinator);
      if (coord) {
        expenseByInvestor.set(coord.investorId, (expenseByInvestor.get(coord.investorId) ?? 0) + due);
      }
    }
  }

  const hasExplicit = memberships.some((m) => m.ownershipPercent != null);
  let percentByInvestor = new Map<string, string>();

  if (hasExplicit) {
    for (const m of memberships) {
      percentByInvestor.set(m.investorId, dstr(m.ownershipPercent ?? 0));
    }
  } else {
    const computed = computeOwnershipFromCapital(
      memberships.map((m) => ({
        partnerId: m.investorId,
        equityCapital: String(capitalByInvestor.get(m.investorId) ?? 0),
      }))
    );
    percentByInvestor = new Map(computed.map((c) => [c.partnerId, c.ownershipPercent]));
  }

  return memberships.map((m) => ({
    partnerId: m.investorId,
    investorId: m.investorId,
    label: m.investor.displayName || m.investor.legalName,
    isCoordinator: m.isCoordinator,
    capitalContributed: Number(capitalByInvestor.get(m.investorId) ?? 0).toFixed(3),
    ownershipPercent: percentByInvestor.get(m.investorId) ?? "0",
    expensesOutstanding: Number(expenseByInvestor.get(m.investorId) ?? 0).toFixed(3),
  }));
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
