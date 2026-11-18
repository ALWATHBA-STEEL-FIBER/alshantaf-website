import { prisma } from "../../prisma";
import { DEFAULT_WATERFALL_STEPS, runSettlement } from "../finance";
import { investAudit } from "../lib/auditInvest";
import { moneyField, dstr } from "../lib/moneyField";
import {
  ensureDefaultOrganization,
  isProjectStatus,
  parseCommissionRule,
  resolveProjectPartners,
} from "./core";

function loc(p: {
  city?: string | null;
  area?: string | null;
  landLocation?: string | null;
  country?: string | null;
}) {
  return [p.landLocation, p.area, p.city, p.country].filter(Boolean).join(", ") || null;
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

export async function listProjects() {
  await ensureDefaultOrganization();
  const rows = await prisma.invProject.findMany({ orderBy: { updatedAt: "desc" } });
  return rows.map(serializeProjectSummary);
}

export async function createProject(
  data: Record<string, unknown>,
  actor: { id?: string; email?: string }
) {
  const org = await ensureDefaultOrganization();
  const name = String(data.name || "").trim();
  if (!name) throw Object.assign(new Error("Name is required"), { status: 400 });
  const referenceNo =
    String(data.code || data.referenceNo || "").trim() ||
    `INV-${Date.now().toString(36).toUpperCase()}`;

  const project = await prisma.invProject.create({
    data: {
      organizationId: org.id,
      name,
      referenceNo,
      description: data.description ? String(data.description) : null,
      country: data.country ? String(data.country) : "JO",
      city: data.city ? String(data.city) : data.location ? String(data.location) : null,
      area: data.area ? String(data.area) : null,
      landLocation: data.landLocation ? String(data.landLocation) : data.location ? String(data.location) : null,
      plotParcelNo: data.plotParcelNo ? String(data.plotParcelNo) : null,
      landAreaSqm: data.landAreaSqm != null ? String(data.landAreaSqm) : null,
      purchasePrice: data.purchasePrice != null ? String(data.purchasePrice) : null,
      targetSalePrice: data.targetSalePrice != null ? String(data.targetSalePrice) : null,
      currency: data.currency ? String(data.currency).toUpperCase() : "JOD",
      currencyScale: data.currencyScale != null ? Number(data.currencyScale) : 3,
      coordinatorUserId: actor.id ?? null,
      waterfallSteps: [...DEFAULT_WATERFALL_STEPS],
      commissionRule: { basis: "distributable_profit", percent: 0 },
      status: "draft",
    },
  });

  await prisma.invProjectStatusEvent.create({
    data: {
      projectId: project.id,
      fromStatus: null,
      toStatus: "draft",
      actorId: actor.id,
      actorEmail: actor.email,
      note: "Project created",
    },
  });

  await investAudit({
    organizationId: org.id,
    actorId: actor.id,
    actorEmail: actor.email,
    action: "project.create",
    entityType: "InvProject",
    entityId: project.id,
    newState: { name, referenceNo },
  });

  return serializeProjectSummary(project);
}

export async function getProjectDetail(projectId: string) {
  const project = await prisma.invProject.findUnique({
    where: { id: projectId },
    include: {
      memberships: { where: { active: true }, include: { investor: true } },
      contributions: { include: { investor: true }, orderBy: { contributedAt: "desc" } },
      expenses: { orderBy: { expenseDate: "desc" }, take: 100 },
      documents: { orderBy: { createdAt: "desc" }, take: 50 },
      settlements: { where: { hypothetical: false }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!project) throw Object.assign(new Error("Project not found"), { status: 404 });

  const partners = await resolveProjectPartners(projectId);
  const ownership = partners.map((p) => ({
    id: p.partnerId,
    label: p.label,
    percent: p.ownershipPercent,
    amount: moneyField(p.capitalContributed, { currency: project.currency, finalized: true }),
  }));

  const totalCapital = partners.reduce((a, p) => a + Number(p.capitalContributed), 0);
  const totalExpenses = partners.reduce((a, p) => a + Number(p.expensesOutstanding), 0);

  return {
    ...serializeProjectSummary(project),
    description: project.description,
    purchasePrice: moneyField(project.purchasePrice, { currency: project.currency }),
    targetSalePrice: moneyField(project.targetSalePrice, { currency: project.currency, estimated: true, finalized: false }),
    actualSalePrice: moneyField(project.actualSalePrice, { currency: project.currency, finalized: true }),
    waterfallSteps: project.waterfallSteps,
    commissionRule: project.commissionRule,
    ownership,
    members: project.memberships.map((m) => ({
      id: m.id,
      investorId: m.investorId,
      investorName: m.investor.displayName || m.investor.legalName,
      ownershipPercent: partners.find((p) => p.investorId === m.investorId)?.ownershipPercent ?? dstr(m.ownershipPercent),
      role: m.isCoordinator ? "coordinator" : m.roleLabel || "investor",
      joinedAt: m.joinedAt.toISOString(),
    })),
    contributions: project.contributions.map((c) => ({
      id: c.id,
      investorId: c.investorId,
      investorName: c.investor.displayName || c.investor.legalName,
      amount: moneyField(c.amount, { currency: c.currency, finalized: c.approvalStatus === "approved" }),
      contributedAt: c.contributedAt.toISOString().slice(0, 10),
      status: c.approvalStatus,
      notes: c.description,
      kind: c.kind,
    })),
    expenses: project.expenses.map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      amount: moneyField(e.amount, { currency: e.currency, finalized: e.status === "approved" || e.status === "reimbursed" }),
      status: e.status,
      submittedAt: e.createdAt.toISOString(),
      approvedAt: e.approvedAt?.toISOString() ?? null,
      finalized: e.status === "approved" || e.status === "reimbursed",
    })),
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
    totals: {
      capitalRaised: moneyField(totalCapital.toFixed(3), { currency: project.currency, finalized: true }),
      outstandingReimbursements: moneyField(totalExpenses.toFixed(3), { currency: project.currency, finalized: true }),
      purchasePrice: moneyField(project.purchasePrice, { currency: project.currency }),
      estimatedValue: moneyField(project.targetSalePrice, {
        currency: project.currency,
        estimated: true,
        finalized: false,
      }),
      salePrice: moneyField(project.actualSalePrice, { currency: project.currency, finalized: true }),
    },
  };
}

export async function updateProject(projectId: string, data: Record<string, unknown>, actor: { id?: string; email?: string }) {
  const existing = await prisma.invProject.findUnique({ where: { id: projectId } });
  if (!existing) throw Object.assign(new Error("Project not found"), { status: 404 });

  const updated = await prisma.invProject.update({
    where: { id: projectId },
    data: {
      name: data.name != null ? String(data.name) : undefined,
      description: data.description != null ? String(data.description) : undefined,
      city: data.city != null ? String(data.city) : undefined,
      area: data.area != null ? String(data.area) : undefined,
      landLocation: data.landLocation != null ? String(data.landLocation) : data.location != null ? String(data.location) : undefined,
      plotParcelNo: data.plotParcelNo != null ? String(data.plotParcelNo) : undefined,
      purchasePrice: data.purchasePrice != null ? String(data.purchasePrice) : undefined,
      targetSalePrice: data.targetSalePrice != null ? String(data.targetSalePrice) : undefined,
      actualSalePrice: data.actualSalePrice != null ? String(data.actualSalePrice) : undefined,
      commissionRule: data.commissionRule != null ? (data.commissionRule as object) : undefined,
      waterfallSteps: data.waterfallSteps != null ? (data.waterfallSteps as object) : undefined,
      coordinatorParticipatesInProfit:
        data.coordinatorParticipatesInProfit != null ? Boolean(data.coordinatorParticipatesInProfit) : undefined,
    },
  });

  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "project.update",
    entityType: "InvProject",
    entityId: projectId,
    previousState: { name: existing.name },
    newState: { name: updated.name },
  });

  return getProjectDetail(projectId);
}

export async function setProjectStatus(
  projectId: string,
  status: string,
  note: string | undefined,
  actor: { id?: string; email?: string }
) {
  if (!isProjectStatus(status)) {
    throw Object.assign(new Error(`Invalid status: ${status}`), { status: 400 });
  }
  const existing = await prisma.invProject.findUnique({ where: { id: projectId } });
  if (!existing) throw Object.assign(new Error("Project not found"), { status: 404 });

  await prisma.$transaction([
    prisma.invProject.update({ where: { id: projectId }, data: { status } }),
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

export async function simulateProject(projectId: string, body: Record<string, unknown>) {
  const project = await prisma.invProject.findUnique({ where: { id: projectId } });
  if (!project) throw Object.assign(new Error("Project not found"), { status: 404 });

  const partners = await resolveProjectPartners(projectId);
  const sale =
    body.saleProceeds ??
    body.exitValue ??
    body.salePrice ??
    project.actualSalePrice ??
    project.targetSalePrice;
  if (sale == null || sale === "") {
    throw Object.assign(new Error("saleProceeds / exitValue is required"), { status: 400 });
  }

  const closingCosts = body.closingCosts ?? body.discountRate ?? 0; // discountRate aliased poorly in UI — treat as closing if numeric pct of sale? Prefer closingCosts.
  // UI sends discountRate as % — interpret as closing cost percent of sale when closingCosts absent
  let closing = dstr(body.closingCosts ?? 0);
  if (body.closingCosts == null && body.discountRate != null && body.discountRate !== "") {
    const pct = Number(dstr(body.discountRate));
    if (!Number.isNaN(pct)) {
      closing = ((Number(dstr(sale)) * pct) / 100).toFixed(3);
    }
  }

  const result = runSettlement({
    saleProceeds: dstr(sale),
    closingCosts: closing,
    unpaidLiabilities: dstr(body.unpaidLiabilities ?? body.additionalExpenses ?? 0),
    partners: partners.map((p) => ({
      partnerId: p.partnerId,
      label: p.label,
      isCoordinator: p.isCoordinator,
      capitalContributed: p.capitalContributed,
      ownershipPercent: p.ownershipPercent,
      expensesOutstanding:
        body.ignoreExpenses === true ? "0" : p.expensesOutstanding,
    })),
    commission: parseCommissionRule(body.commissionRule ?? project.commissionRule) ?? {
      basis: "distributable_profit",
      percent: 0,
    },
    coordinatorParticipatesInProfit: project.coordinatorParticipatesInProfit,
    waterfallSteps: Array.isArray(body.waterfallSteps)
      ? (body.waterfallSteps as string[])
      : Array.isArray(project.waterfallSteps)
        ? (project.waterfallSteps as string[])
        : undefined,
    currency: project.currency,
    currencyScale: project.currencyScale,
  });

  return {
    hypothetical: true as const,
    summary: {
      saleProceeds: moneyField(result.saleProceeds, { currency: result.currency, estimated: true, finalized: false }),
      capitalReturned: moneyField(result.totalCapitalReturned, { currency: result.currency, estimated: true, finalized: false }),
      expenseReimbursements: moneyField(result.totalExpenseReimbursements, {
        currency: result.currency,
        estimated: true,
        finalized: false,
      }),
      distributableProfit: moneyField(result.distributableProfitBeforeCommission, {
        currency: result.currency,
        estimated: true,
        finalized: false,
      }),
      coordinatorCommission: moneyField(result.coordinatorCommission, {
        currency: result.currency,
        estimated: true,
        finalized: false,
      }),
      totalPayouts: moneyField(result.totalPayouts, { currency: result.currency, estimated: true, finalized: false }),
      residualCash: moneyField(result.residualCash, { currency: result.currency, estimated: true, finalized: false }),
    },
    allocations: result.partnerLines.map((l) => ({
      id: l.partnerId,
      label: l.label,
      percent: partners.find((p) => p.partnerId === l.partnerId)?.ownershipPercent,
      amount: moneyField(l.totalPayout, { currency: result.currency, estimated: true, finalized: false }),
      capitalReturned: moneyField(l.capitalReturned, { currency: result.currency, estimated: true }),
      expenseReimbursement: moneyField(l.expenseReimbursement, { currency: result.currency, estimated: true }),
      profitShare: moneyField(l.profitShare, { currency: result.currency, estimated: true }),
      commissionEarned: moneyField(l.commissionEarned, { currency: result.currency, estimated: true }),
    })),
    warnings: [
      "Hypothetical only — does not modify the ledger.",
      ...result.notes,
      ...(result.balanced ? [] : ["Warning: settlement lines did not perfectly balance sale proceeds."]),
    ],
    result,
  };
}
