import { prisma } from "../../prisma";
import { DEFAULT_WATERFALL_STEPS, computeOwnershipFromCapital, runSettlement, type CommissionRuleInput } from "../finance";
import { Decimal } from "../finance/decimal";
import { investAudit } from "../lib/auditInvest";
import { moneyField, dstr } from "../lib/moneyField";
import {
  commissionRuleFor,
  ensureDefaultOrganization,
  isProjectStatus,
  parseCommissionRule,
  resolveProjectPartners,
  type ResolvedPartner,
} from "./core";
import { serializeExpense } from "./capitalExpenseService";

type Actor = { id?: string; email?: string };

function bad(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function moneyOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) throw bad("قيمة مالية غير صالحة");
  return String(n);
}

function dateOrNull(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw bad("تاريخ غير صالح");
  return d;
}

function loc(p: { city?: string | null; area?: string | null; landLocation?: string | null; country?: string | null }) {
  return [p.landLocation, p.area, p.city].filter(Boolean).join("، ") || null;
}

export function serializeProjectSummary(p: {
  id: string;
  name: string;
  referenceNo: string;
  status: string;
  currency: string;
  city?: string | null;
  area?: string | null;
  landLocation?: string | null;
  country?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    name: p.name,
    code: p.referenceNo,
    status: p.status,
    currency: p.currency,
    location: loc(p),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Normalize a commission rule coming from the UI. */
export function cleanCommissionRule(raw: unknown): CommissionRuleInput {
  const r = parseCommissionRule(raw) ?? { basis: "investor_net_profit", percent: 0 };
  const allowed = ["investor_net_profit", "distributable_profit", "sale_value", "fixed", "hybrid"];
  if (!allowed.includes(r.basis)) throw bad("طريقة احتساب العمولة غير معروفة");
  const pctN = Number(r.percent ?? 0);
  if (!Number.isFinite(pctN) || pctN < 0 || pctN > 100) throw bad("نسبة المنسق يجب أن تكون بين 0 و 100");
  const fixedN = Number(r.fixedAmount ?? 0);
  if (!Number.isFinite(fixedN) || fixedN < 0) throw bad("المبلغ الثابت غير صالح");
  return { basis: r.basis, percent: String(pctN), fixedAmount: String(fixedN) };
}

function sumStr(xs: string[]) {
  return xs.reduce((a, b) => a.plus(b), new Decimal(0));
}

/** Money totals that every project view needs. */
async function projectStats(project: {
  id: string;
  currency: string;
  purchasePrice: Decimal | { toString(): string } | null;
  targetSalePrice: { toString(): string } | null;
  actualSalePrice: { toString(): string } | null;
}, partners?: ResolvedPartner[]) {
  const ps = partners ?? (await resolveProjectPartners(project.id));
  const expenses = await prisma.invExpense.findMany({
    where: { projectId: project.id, status: { in: ["pending", "approved", "reimbursed"] } },
    select: { amount: true, status: true, payerInvestorId: true, paidByCoordinator: true },
  });
  const capital = sumStr(ps.map((p) => p.capitalContributed));
  let approved = new Decimal(0);
  let pending = new Decimal(0);
  let partnerPaid = new Decimal(0);
  let poolPaid = new Decimal(0);
  let pendingCount = 0;
  for (const e of expenses) {
    const a = new Decimal(dstr(e.amount));
    if (e.status === "pending") {
      pending = pending.plus(a);
      pendingCount += 1;
      continue;
    }
    approved = approved.plus(a);
    if (e.payerInvestorId || e.paidByCoordinator) partnerPaid = partnerPaid.plus(a);
    else poolPaid = poolPaid.plus(a);
  }
  const purchase = project.purchasePrice != null ? new Decimal(dstr(project.purchasePrice)) : null;
  const sale = project.actualSalePrice ?? project.targetSalePrice;
  const totalCost = (purchase ?? new Decimal(0)).plus(approved);
  const invested = capital.plus(partnerPaid);
  const projectedProfit = sale != null ? new Decimal(dstr(sale)).minus(invested) : null;
  return {
    partnerCount: ps.length,
    capital: capital.toFixed(3),
    purchasePrice: purchase?.toFixed(3) ?? null,
    fundingPercent: purchase && purchase.gt(0) ? capital.times(100).dividedBy(purchase).toFixed(1) : null,
    fundingGap: purchase ? Decimal.max(0, purchase.minus(capital)).toFixed(3) : null,
    poolCash: capital.minus(purchase ?? 0).minus(poolPaid).toFixed(3),
    expensesApproved: approved.toFixed(3),
    expensesPending: pending.toFixed(3),
    expensesPendingCount: pendingCount,
    expensesPartnerPaid: partnerPaid.toFixed(3),
    expensesPoolPaid: poolPaid.toFixed(3),
    totalCost: totalCost.toFixed(3),
    totalInvested: invested.toFixed(3),
    targetSalePrice: project.targetSalePrice != null ? dstr(project.targetSalePrice) : null,
    actualSalePrice: project.actualSalePrice != null ? dstr(project.actualSalePrice) : null,
    projectedProfit: projectedProfit?.toFixed(3) ?? null,
    projectedRoiPercent:
      projectedProfit && invested.gt(0) ? projectedProfit.times(100).dividedBy(invested).toFixed(1) : null,
    coordinator: ps.find((p) => p.isCoordinator)
      ? { investorId: ps.find((p) => p.isCoordinator)!.investorId, name: ps.find((p) => p.isCoordinator)!.label }
      : null,
  };
}

export async function listProjects(opts: { q?: string; status?: string } = {}) {
  await ensureDefaultOrganization();
  const q = (opts.q || "").trim();
  const rows = await prisma.invProject.findMany({
    where: {
      ...(opts.status === "open"
        ? { status: { notIn: ["settled", "closed", "cancelled"] } }
        : opts.status === "closed"
          ? { status: { in: ["settled", "closed", "cancelled"] } }
          : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { referenceNo: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
              { area: { contains: q, mode: "insensitive" } },
              { landLocation: { contains: q, mode: "insensitive" } },
              { plotParcelNo: { contains: q, mode: "insensitive" } },
              {
                memberships: {
                  some: {
                    active: true,
                    investor: {
                      OR: [
                        { legalName: { contains: q, mode: "insensitive" } },
                        { displayName: { contains: q, mode: "insensitive" } },
                        { code: { contains: q, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  const out = [];
  for (const p of rows) {
    out.push({
      ...serializeProjectSummary(p),
      plotParcelNo: p.plotParcelNo,
      stats: await projectStats(p),
    });
  }
  return out;
}

type PartnerInput = {
  investorId: string;
  capital?: string | number | null;
  isCoordinator?: boolean;
  commissionPercent?: string | number | null;
};

/**
 * Create a project in one go: details, coordinator rule, and the partners with their opening capital.
 */
export async function createProject(data: Record<string, unknown>, actor: Actor) {
  const org = await ensureDefaultOrganization();
  const name = str(data.name);
  if (!name) throw bad("اسم المشروع مطلوب");
  const referenceNo = str(data.code || data.referenceNo) || `INV-${Date.now().toString(36).toUpperCase()}`;
  const dupRef = await prisma.invProject.findFirst({ where: { organizationId: org.id, referenceNo } });
  if (dupRef) throw bad(`رمز المشروع ${referenceNo} مستخدم`, 409);

  const partners = Array.isArray(data.partners) ? (data.partners as PartnerInput[]) : [];
  const seen = new Set<string>();
  for (const p of partners) {
    if (!p || !p.investorId) throw bad("شريك غير صالح");
    if (seen.has(p.investorId)) throw bad("تمت إضافة نفس الشريك مرتين");
    seen.add(p.investorId);
    if (p.capital != null && p.capital !== "" && !(Number(p.capital) >= 0)) throw bad("رأس مال غير صالح");
  }
  if (partners.length > 50) throw bad("الحد الأقصى 50 شريكاً للمشروع");
  {
    const { parsePercentOrNull } = await import("./investorService");
    for (const p of partners) parsePercentOrNull(p.commissionPercent); // throws before anything is written
  }
  if (partners.filter((p) => p.isCoordinator).length > 1) throw bad("منسق واحد فقط لكل مشروع");
  if (partners.length) {
    const found = await prisma.invInvestor.count({ where: { id: { in: [...seen] }, organizationId: org.id } });
    if (found !== seen.size) throw bad("بعض الشركاء غير موجودين");
  }
  const rule = cleanCommissionRule(data.commissionRule ?? { basis: "investor_net_profit", percent: 0 });

  const project = await prisma.invProject.create({
    data: {
      organizationId: org.id,
      name,
      referenceNo,
      description: str(data.description),
      country: str(data.country) ?? "JO",
      city: str(data.city),
      area: str(data.area),
      landLocation: str(data.landLocation ?? data.location),
      plotParcelNo: str(data.plotParcelNo),
      landAreaSqm: moneyOrNull(data.landAreaSqm),
      purchasePrice: moneyOrNull(data.purchasePrice),
      targetSalePrice: moneyOrNull(data.targetSalePrice),
      purchaseDate: dateOrNull(data.purchaseDate),
      expectedSaleDate: dateOrNull(data.expectedSaleDate),
      currency: str(data.currency)?.toUpperCase() ?? "JOD",
      currencyScale: 3,
      coordinatorUserId: actor.id ?? null,
      waterfallSteps: [...DEFAULT_WATERFALL_STEPS],
      commissionRule: rule as object,
      coordinatorParticipatesInProfit: data.coordinatorParticipatesInProfit !== false,
      shareLossesByOwnership: data.shareLossesByOwnership !== false,
      agreementNotes: str(data.agreementNotes),
      status: partners.length ? "capital_collection" : "draft",
    },
  });

  await prisma.invProjectStatusEvent.create({
    data: {
      projectId: project.id,
      fromStatus: null,
      toStatus: project.status,
      actorId: actor.id,
      actorEmail: actor.email,
      note: "تم إنشاء المشروع",
    },
  });

  const { addProjectMember } = await import("./investorService");
  for (const p of partners) {
    await addProjectMember(
      project.id,
      {
        investorId: p.investorId,
        isCoordinator: Boolean(p.isCoordinator),
        commissionPercent: p.commissionPercent ?? undefined,
        capital: p.capital ?? 0,
        contributedAt: data.purchaseDate ?? undefined,
      },
      actor
    );
  }

  await investAudit({
    organizationId: org.id,
    actorId: actor.id,
    actorEmail: actor.email,
    action: "project.create",
    entityType: "InvProject",
    entityId: project.id,
    newState: { name, referenceNo, partners: partners.length },
  });

  return serializeProjectSummary(project);
}

export async function getProjectDetail(projectId: string) {
  const project = await prisma.invProject.findUnique({
    where: { id: projectId },
    include: {
      contributions: { include: { investor: true }, orderBy: [{ contributedAt: "desc" }, { createdAt: "desc" }] },
      expenses: {
        include: { payerInvestor: { select: { displayName: true, legalName: true, code: true } } },
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      },
      documents: { orderBy: { createdAt: "desc" }, take: 50 },
      settlements: { where: { hypothetical: false }, orderBy: { createdAt: "desc" }, take: 20 },
      statusHistory: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!project) throw bad("المشروع غير موجود", 404);

  const partners = await resolveProjectPartners(projectId);
  const stats = await projectStats(project, partners);
  const rule = cleanCommissionRule(project.commissionRule);

  return {
    ...serializeProjectSummary(project),
    description: project.description,
    city: project.city,
    area: project.area,
    landLocation: project.landLocation,
    plotParcelNo: project.plotParcelNo,
    landAreaSqm: project.landAreaSqm != null ? dstr(project.landAreaSqm) : null,
    purchaseDate: project.purchaseDate?.toISOString().slice(0, 10) ?? null,
    expectedSaleDate: project.expectedSaleDate?.toISOString().slice(0, 10) ?? null,
    actualSaleDate: project.actualSaleDate?.toISOString().slice(0, 10) ?? null,
    agreementNotes: project.agreementNotes,
    commissionRule: rule,
    coordinatorParticipatesInProfit: project.coordinatorParticipatesInProfit,
    shareLossesByOwnership: project.shareLossesByOwnership,
    closed: ["settled", "closed", "cancelled"].includes(project.status),
    stats,
    purchasePrice: moneyField(project.purchasePrice, { currency: project.currency }),
    targetSalePrice: moneyField(project.targetSalePrice, { currency: project.currency, estimated: true, finalized: false }),
    actualSalePrice: moneyField(project.actualSalePrice, { currency: project.currency, finalized: true }),
    ownership: partners.map((p) => ({
      id: p.partnerId,
      label: p.label,
      percent: p.ownershipPercent,
      amount: moneyField(p.capitalContributed, { currency: project.currency, finalized: true }),
    })),
    members: partners.map((p) => ({
      id: p.membershipId,
      investorId: p.investorId,
      investorName: p.label,
      code: p.code,
      phone: p.phone,
      ownershipPercent: p.ownershipPercent,
      ownershipMode: p.ownershipMode,
      role: p.isCoordinator ? "coordinator" : "investor",
      isCoordinator: p.isCoordinator,
      commissionPercent: p.commissionPercent,
      effectiveCommissionPercent: p.isCoordinator
        ? "0"
        : rule.basis === "investor_net_profit"
          ? (p.commissionPercent ?? String(rule.percent ?? 0))
          : null,
      capital: p.capitalContributed,
      expensesOutstanding: p.expensesOutstanding,
      expensesPending: p.expensesPending,
      notes: p.notes,
      joinedAt: p.joinedAt,
    })),
    contributions: project.contributions.map((c) => ({
      id: c.id,
      investorId: c.investorId,
      investorName: c.investor.displayName || c.investor.legalName,
      investorCode: c.investor.code,
      amount: moneyField(c.amount, { currency: c.currency, finalized: c.approvalStatus === "approved" }),
      contributedAt: c.contributedAt.toISOString().slice(0, 10),
      status: c.approvalStatus,
      notes: c.description,
      kind: c.kind,
    })),
    expenses: project.expenses.map(serializeExpense),
    documents: project.documents.map((d) => ({
      id: d.id,
      name: d.name,
      kind: d.kind,
      uploadedAt: d.createdAt.toISOString(),
      url: `/api/invest/documents/${d.id}/download`,
    })),
    settlements: project.settlements.map((s) => ({
      id: s.id,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      finalized: s.status === "posted" || s.status === "paid",
    })),
    statusHistory: project.statusHistory.map((h) => ({
      id: h.id,
      from: h.fromStatus,
      to: h.toStatus,
      note: h.note,
      actor: h.actorEmail,
      at: h.createdAt.toISOString(),
    })),
    totals: {
      capitalRaised: moneyField(stats.capital, { currency: project.currency, finalized: true }),
      outstandingReimbursements: moneyField(sumStr(partners.map((p) => p.expensesOutstanding)).toFixed(3), {
        currency: project.currency,
        finalized: true,
      }),
      purchasePrice: moneyField(project.purchasePrice, { currency: project.currency }),
      estimatedValue: moneyField(project.targetSalePrice, { currency: project.currency, estimated: true, finalized: false }),
      salePrice: moneyField(project.actualSalePrice, { currency: project.currency, finalized: true }),
    },
  };
}

export async function updateProject(projectId: string, data: Record<string, unknown>, actor: Actor) {
  const existing = await prisma.invProject.findUnique({ where: { id: projectId } });
  if (!existing) throw bad("المشروع غير موجود", 404);
  const has = (k: string) => Object.prototype.hasOwnProperty.call(data, k);
  const settled = ["settled", "closed"].includes(existing.status);
  if (settled && (has("commissionRule") || has("shareLossesByOwnership") || has("coordinatorParticipatesInProfit"))) {
    throw bad("لا يمكن تعديل شروط التوزيع بعد التسوية");
  }
  if (has("name") && !str(data.name)) throw bad("اسم المشروع مطلوب");
  if (has("code")) {
    const ref = str(data.code);
    if (!ref) throw bad("رمز المشروع مطلوب");
    const dup = await prisma.invProject.findFirst({
      where: { organizationId: existing.organizationId, referenceNo: ref, id: { not: projectId } },
    });
    if (dup) throw bad(`رمز المشروع ${ref} مستخدم`, 409);
  }

  await prisma.invProject.update({
    where: { id: projectId },
    data: {
      name: has("name") ? str(data.name)! : undefined,
      referenceNo: has("code") ? str(data.code)! : undefined,
      description: has("description") ? str(data.description) : undefined,
      city: has("city") ? str(data.city) : undefined,
      area: has("area") ? str(data.area) : undefined,
      landLocation: has("landLocation") ? str(data.landLocation) : undefined,
      plotParcelNo: has("plotParcelNo") ? str(data.plotParcelNo) : undefined,
      landAreaSqm: has("landAreaSqm") ? moneyOrNull(data.landAreaSqm) : undefined,
      purchasePrice: has("purchasePrice") ? moneyOrNull(data.purchasePrice) : undefined,
      targetSalePrice: has("targetSalePrice") ? moneyOrNull(data.targetSalePrice) : undefined,
      actualSalePrice: has("actualSalePrice") && !settled ? moneyOrNull(data.actualSalePrice) : undefined,
      purchaseDate: has("purchaseDate") ? dateOrNull(data.purchaseDate) : undefined,
      expectedSaleDate: has("expectedSaleDate") ? dateOrNull(data.expectedSaleDate) : undefined,
      actualSaleDate: has("actualSaleDate") ? dateOrNull(data.actualSaleDate) : undefined,
      agreementNotes: has("agreementNotes") ? str(data.agreementNotes) : undefined,
      commissionRule: has("commissionRule") ? (cleanCommissionRule(data.commissionRule) as object) : undefined,
      coordinatorParticipatesInProfit: has("coordinatorParticipatesInProfit")
        ? Boolean(data.coordinatorParticipatesInProfit)
        : undefined,
      shareLossesByOwnership: has("shareLossesByOwnership") ? Boolean(data.shareLossesByOwnership) : undefined,
    },
  });

  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "project.update",
    entityType: "InvProject",
    entityId: projectId,
    previousState: { name: existing.name, commissionRule: existing.commissionRule },
    newState: data,
  });

  return getProjectDetail(projectId);
}

export async function setProjectStatus(projectId: string, status: string, note: string | undefined, actor: Actor) {
  if (!isProjectStatus(status)) throw bad(`حالة غير صالحة: ${status}`);
  const existing = await prisma.invProject.findUnique({ where: { id: projectId } });
  if (!existing) throw bad("المشروع غير موجود", 404);
  if (status === "settled") throw bad("استخدم «إغلاق المشروع وتوزيع الأرباح» للتسوية");
  if (existing.status === "settled" && status !== "closed") throw bad("المشروع تمت تسويته");

  await prisma.$transaction([
    prisma.invProject.update({ where: { id: projectId }, data: { status, closedAt: status === "closed" ? new Date() : undefined } }),
    prisma.invProjectStatusEvent.create({
      data: {
        projectId,
        fromStatus: existing.status,
        toStatus: status,
        note: note ?? null,
        actorId: actor.id,
        actorEmail: actor.email,
      },
    }),
  ]);

  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "project.status",
    entityType: "InvProject",
    entityId: projectId,
    previousState: { status: existing.status },
    newState: { status },
    reason: note,
  });

  return getProjectDetail(projectId);
}

export function serializeSettlementResult(result: ReturnType<typeof runSettlement>) {
  return {
    currency: result.currency,
    saleProceeds: result.saleProceeds,
    closingCosts: result.closingCosts,
    unpaidLiabilities: result.unpaidLiabilities,
    netProceedsAfterCosts: result.netProceedsAfterCosts,
    totalCapitalReturned: result.totalCapitalReturned,
    totalExpenseReimbursements: result.totalExpenseReimbursements,
    distributableProfitBeforeCommission: result.distributableProfitBeforeCommission,
    coordinatorCommission: result.coordinatorCommission,
    distributableProfitAfterCommission: result.distributableProfitAfterCommission,
    totalPayouts: result.totalPayouts,
    residualCash: result.residualCash,
    lossShared: result.lossShared,
    balanced: result.balanced,
    lines: result.partnerLines,
    notes: result.notes,
  };
}

/** What-if calculation on live project data. Never writes. */
export async function simulateProject(projectId: string, body: Record<string, unknown>) {
  const project = await prisma.invProject.findUnique({ where: { id: projectId } });
  if (!project) throw bad("المشروع غير موجود", 404);
  const partners = await resolveProjectPartners(projectId);
  if (!partners.length) throw bad("أضف شركاء أولاً");

  const sale = body.saleProceeds ?? project.actualSalePrice ?? project.targetSalePrice;
  if (sale == null || sale === "") throw bad("أدخل سعر البيع");
  const ruleRaw = body.commissionRule ? cleanCommissionRule(body.commissionRule) : cleanCommissionRule(project.commissionRule);
  const result = runSettlement({
    saleProceeds: dstr(moneyOrNull(sale)),
    closingCosts: dstr(moneyOrNull(body.closingCosts) ?? 0),
    unpaidLiabilities: dstr(moneyOrNull(body.unpaidLiabilities) ?? 0),
    partners: partners.map((p) => ({
      partnerId: p.partnerId,
      label: p.label,
      isCoordinator: p.isCoordinator,
      capitalContributed: p.capitalContributed,
      ownershipPercent: p.ownershipPercent,
      // Pending expenses are included so the preview matches what settlement will be once approved.
      expensesOutstanding:
        body.includePending === false
          ? p.expensesOutstanding
          : new Decimal(p.expensesOutstanding).plus(p.expensesPending).toFixed(3),
    })),
    commission: commissionRuleFor(ruleRaw, partners),
    coordinatorParticipatesInProfit: project.coordinatorParticipatesInProfit,
    shareLossesByOwnership: body.shareLossesByOwnership != null ? Boolean(body.shareLossesByOwnership) : project.shareLossesByOwnership,
    waterfallSteps: Array.isArray(project.waterfallSteps) ? (project.waterfallSteps as string[]) : undefined,
    currency: project.currency,
    currencyScale: project.currencyScale,
  });
  return { hypothetical: true as const, ...serializeSettlementResult(result) };
}

/** Stateless calculator for the new-project wizard (nothing stored). */
export function previewDistribution(body: Record<string, unknown>) {
  const rows = Array.isArray(body.partners) ? (body.partners as Record<string, unknown>[]) : [];
  if (!rows.length) throw bad("أضف شركاء");
  if (rows.length > 100) throw bad("عدد الشركاء كبير جداً");
  const ownership = computeOwnershipFromCapital(
    rows.map((r, i) => ({ partnerId: String(r.id ?? i), equityCapital: dstr(moneyOrNull(r.capital) ?? 0) }))
  );
  const rule = cleanCommissionRule(body.commissionRule);
  const overrides: Record<string, string> = {};
  rows.forEach((r, i) => {
    if (r.commissionPercent != null && r.commissionPercent !== "") overrides[String(r.id ?? i)] = String(r.commissionPercent);
  });
  const sale = moneyOrNull(body.saleProceeds);
  if (sale == null) throw bad("أدخل سعر البيع المتوقع");
  const result = runSettlement({
    saleProceeds: sale,
    closingCosts: dstr(moneyOrNull(body.closingCosts) ?? 0),
    partners: rows.map((r, i) => ({
      partnerId: String(r.id ?? i),
      label: String(r.label ?? `#${i + 1}`),
      isCoordinator: Boolean(r.isCoordinator),
      capitalContributed: dstr(moneyOrNull(r.capital) ?? 0),
      ownershipPercent: ownership[i].ownershipPercent,
      expensesOutstanding: dstr(moneyOrNull(r.expenses) ?? 0),
    })),
    commission: { ...rule, perInvestorPercent: Object.keys(overrides).length ? overrides : undefined },
    shareLossesByOwnership: body.shareLossesByOwnership !== false,
  });
  return { hypothetical: true as const, ...serializeSettlementResult(result) };
}
