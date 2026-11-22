import * as projects from "../services/projectService";

const projectHref = (id: string) => `/admin/invest/projects/${id}`;

/** Money fields come back as { amount, … } objects; the model only needs the number. */
function amt(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object" && "amount" in (v as object)) return String((v as { amount: unknown }).amount ?? "");
  return String(v);
}

/** Compact project picture for the model. */
export async function projectBrief(projectId: string) {
  const d = await projects.getProjectDetail(projectId);
  const p = d as unknown as Record<string, unknown> & {
    members: { investorId: string; investorName: string; code: string | null; isCoordinator: boolean; ownershipPercent: string; capital: string; expenseBurden?: string; effectiveCommissionPercent: string | null }[];
    contributions: { id: string; investorId: string; amount: unknown; kind: string; contributedAt: string; paymentMethod?: string | null; paymentRef?: string | null; status?: string }[];
    expenses: { id: string; title: string; amount: unknown; category: string | null; expenseDate: string; status: string; reimbursable?: unknown; payerName?: string | null; splitMode?: string }[];
  };
  const initial = new Map<string, string>();
  for (const c of [...p.contributions].reverse()) if (c.kind === "initial" && c.status === "approved" && !initial.has(c.investorId)) initial.set(c.investorId, amt(c.amount) ?? "0");
  return {
    id: p.id,
    name: p.name,
    code: p.code ?? p.referenceNo,
    status: p.status,
    location: p.location,
    plotParcelNo: p.plotParcelNo,
    landAreaSqm: p.landAreaSqm,
    purchaseDate: p.purchaseDate,
    purchasePrice: amt(p.purchasePrice),
    targetSalePrice: amt(p.targetSalePrice),
    estimatedValue: p.estimatedValue,
    commissionRule: p.commissionRule,
    stats: p.stats,
    partners: p.members.map((m) => ({
      investorId: m.investorId,
      name: m.investorName,
      code: m.code,
      coordinator: m.isCoordinator,
      ownershipPercent: m.ownershipPercent,
      capital: m.capital,
      initialPayment: initial.get(m.investorId) ?? "0",
      expenseShare: m.expenseBurden,
      cutPercent: m.effectiveCommissionPercent,
    })),
    payments: p.contributions.slice(0, 25).map((c) => ({
      id: c.id,
      investorId: c.investorId,
      amount: amt(c.amount),
      kind: c.kind,
      date: c.contributedAt,
      method: c.paymentMethod,
      ref: c.paymentRef,
      status: c.status,
    })),
    expenses: p.expenses.slice(0, 40).map((e) => ({
      id: e.id,
      title: e.title,
      amount: amt(e.amount),
      category: e.category,
      date: e.expenseDate,
      status: e.status,
      refundedToPayer: Boolean(e.reimbursable),
      payer: e.payerName,
      split: e.splitMode,
    })),
    contract: p.contract,
    contractProgress: p.contractProgress,
    link: projectHref(String(p.id)),
  };
}

