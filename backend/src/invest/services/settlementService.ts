import { prisma } from "../../prisma";
import { PROJECT_COA, runSettlement } from "../finance";
import { investAudit } from "../lib/auditInvest";
import { moneyField, dstr } from "../lib/moneyField";
import { commissionRuleFor, resolveProjectPartners } from "./core";
import { cleanCommissionRule, serializeSettlementResult } from "./projectService";
import { postBalancedJournal } from "./capitalExpenseService";

export async function createAndPostSettlement(
  projectId: string,
  body: Record<string, unknown>,
  actor: { id?: string; email?: string }
) {
  const project = await prisma.invProject.findUnique({ where: { id: projectId } });
  if (!project) throw Object.assign(new Error("Project not found"), { status: 404 });

  // Prevent double distribution
  const existingPosted = await prisma.invSettlement.findFirst({
    where: { projectId, status: { in: ["posted", "paid"] }, hypothetical: false },
  });
  if (existingPosted) {
    throw Object.assign(new Error("تمت تسوية هذا المشروع مسبقاً"), { status: 409 });
  }

  if (["settled", "closed", "cancelled"].includes(project.status)) {
    throw Object.assign(new Error("المشروع مغلق أو تمت تسويته"), { status: 409 });
  }
  const partners = await resolveProjectPartners(projectId);
  if (partners.length === 0) {
    throw Object.assign(new Error("لا يوجد شركاء"), { status: 400 });
  }
  const pendingCount = await prisma.invExpense.count({ where: { projectId, status: "pending" } });
  if (pendingCount > 0) {
    throw Object.assign(new Error(`يوجد ${pendingCount} مصروف بانتظار الاعتماد — اعتمدها أو ألغها قبل الإغلاق`), {
      status: 400,
    });
  }

  for (const k of ["saleProceeds", "closingCosts", "unpaidLiabilities"] as const) {
    const v = body[k];
    if (v != null && v !== "" && !(Number(v) >= 0)) {
      throw Object.assign(new Error("قيمة مالية غير صالحة"), { status: 400 });
    }
  }
  const sale = body.saleProceeds ?? body.salePrice ?? project.actualSalePrice;
  if (sale == null || sale === "" || !(Number(sale) > 0)) {
    throw Object.assign(new Error("أدخل سعر البيع الفعلي"), { status: 400 });
  }
  const saleDate = body.saleDate ? new Date(String(body.saleDate)) : new Date();
  if (Number.isNaN(saleDate.getTime())) throw Object.assign(new Error("تاريخ البيع غير صالح"), { status: 400 });

  const result = runSettlement({
    saleProceeds: dstr(sale),
    closingCosts: dstr(body.closingCosts ?? 0),
    unpaidLiabilities: dstr(body.unpaidLiabilities ?? 0),
    partners: partners.map((p) => ({
      partnerId: p.partnerId,
      label: p.label,
      isCoordinator: p.isCoordinator,
      capitalContributed: p.capitalContributed,
      ownershipPercent: p.ownershipPercent,
      expensesOutstanding: p.expensesOutstanding,
      expenseBurden: p.expenseBurden,
    })),
    commission: commissionRuleFor(cleanCommissionRule(project.commissionRule), partners),
    coordinatorParticipatesInProfit: project.coordinatorParticipatesInProfit,
    shareLossesByOwnership: project.shareLossesByOwnership,
    waterfallSteps: Array.isArray(project.waterfallSteps) ? (project.waterfallSteps as string[]) : undefined,
    currency: project.currency,
    currencyScale: project.currencyScale,
  });

  if (!result.balanced) {
    throw Object.assign(new Error("Settlement failed balance invariant"), { status: 422 });
  }

  // Advisory-style lock via transaction + status check
  const settlement = await prisma.$transaction(async (tx) => {
    const again = await tx.invSettlement.findFirst({
      where: { projectId, status: { in: ["posted", "paid"] }, hypothetical: false },
    });
    if (again) {
      throw Object.assign(new Error("تمت تسوية هذا المشروع مسبقاً"), { status: 409 });
    }

    const s = await tx.invSettlement.create({
      data: {
        projectId,
        status: "draft",
        saleProceeds: result.saleProceeds,
        closingCosts: result.closingCosts,
        unpaidLiabilities: result.unpaidLiabilities,
        currency: result.currency,
        resultJson: result as object,
        hypothetical: false,
        createdBy: actor.id,
        lines: {
          create: result.partnerLines.map((l) => ({
            partnerId: l.partnerId,
            label: l.label,
            isCoordinator: l.isCoordinator,
            ownershipPercent: l.ownershipPercent,
            capitalReturned: l.capitalReturned,
            expenseReimbursement: l.expenseReimbursement,
            grossProfit: l.grossProfit,
            commissionPaid: l.commissionPaid,
            profitShare: l.profitShare,
            commissionEarned: l.commissionEarned,
            totalPayout: l.totalPayout,
          })),
        },
      },
      include: { lines: true },
    });

    // Build distribution journal: Dr equity/liabilities, Cr bank (payouts)
    // Simplified: Dr Investor Capital + Reimbursement Payable + Management Fee / Distributions; Cr Bank
    const lines: {
      accountCode: string;
      debit: string;
      credit: string;
      currency: string;
      partnerId?: string;
      memo?: string;
    }[] = [];

    // Sale receipt already assumed held in bank — we record distributions out of bank
    for (const l of result.partnerLines) {
      if (Number(l.totalPayout) <= 0) continue;
      lines.push({
        accountCode: PROJECT_COA.DISTRIBUTIONS,
        debit: l.totalPayout,
        credit: "0",
        currency: result.currency,
        partnerId: l.partnerId,
        memo: `Settlement payout ${l.label}`,
      });
    }
    if (Number(result.totalPayouts) > 0) {
      lines.push({
        accountCode: PROJECT_COA.BANK,
        debit: "0",
        credit: result.totalPayouts,
        currency: result.currency,
        memo: "Settlement payouts",
      });
    }

    // Mark approved expenses as reimbursed (full outstanding)
    const approved = await tx.invExpense.findMany({ where: { projectId, status: "approved" } });
    for (const e of approved) {
      await tx.invExpense.update({
        where: { id: e.id },
        data: { status: "reimbursed", reimbursementPaid: e.reimbursementDue },
      });
    }

    await tx.invProject.update({
      where: { id: projectId },
      data: {
        actualSalePrice: result.saleProceeds,
        actualSaleDate: saleDate,
        status: "settled",
      },
    });

    await tx.invProjectStatusEvent.create({
      data: {
        projectId,
        fromStatus: project.status,
        toStatus: "settled",
        note: "تم إغلاق المشروع وتوزيع الأرباح",
        actorId: actor.id,
        actorEmail: actor.email,
      },
    });

    await tx.invSettlement.update({
      where: { id: s.id },
      data: {
        status: "posted",
        postedAt: new Date(),
        postedBy: actor.id,
        approvedAt: new Date(),
        approvedBy: actor.id,
      },
    });

    return { settlement: s, journalLines: lines };
  });

  if (settlement.journalLines.length >= 2) {
    const journal = await postBalancedJournal({
      organizationId: project.organizationId,
      projectId,
      memo: `Settlement ${settlement.settlement.id}`,
      valueDate: new Date(),
      createdBy: actor.id,
      idempotencyKey: `settlement:${settlement.settlement.id}`,
      lines: settlement.journalLines,
    });

    await prisma.invTransaction.create({
      data: {
        projectId,
        type: "settlement.posted",
        amount: result.totalPayouts,
        currency: result.currency,
        transactionDate: new Date(),
        description: "Final settlement distribution",
        approvalStatus: "approved",
        createdBy: actor.id,
        journalId: journal.id,
        metadata: { settlementId: settlement.settlement.id },
      },
    });
  }

  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "settlement.post",
    entityType: "InvSettlement",
    entityId: settlement.settlement.id,
    newState: { totalPayouts: result.totalPayouts, saleProceeds: result.saleProceeds },
  });

  return getSettlement(projectId, settlement.settlement.id);
}

export async function getSettlement(projectId: string, settlementId: string) {
  const s = await prisma.invSettlement.findFirst({
    where: { id: settlementId, projectId },
    include: { lines: true },
  });
  if (!s) throw Object.assign(new Error("Settlement not found"), { status: 404 });
  const investors = await prisma.invInvestor.findMany({
    where: { id: { in: s.lines.map((l) => l.partnerId) } },
    select: { id: true, code: true, phone: true },
  });
  const inv = new Map(investors.map((i) => [i.id, i]));
  const result = (s.resultJson ?? null) as Parameters<typeof serializeSettlementResult>[0] | null;
  const byPartner = new Map((result?.partnerLines ?? []).map((l) => [l.partnerId, l]));
  const totalPayouts = s.lines.reduce((a, l) => a + Number(dstr(l.totalPayout)), 0);
  const totalPaid = s.lines.reduce((a, l) => a + Number(dstr(l.paidAmount)), 0);

  return {
    id: s.id,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    postedAt: s.postedAt?.toISOString() ?? null,
    finalized: s.status === "posted" || s.status === "paid",
    hypothetical: s.hypothetical,
    currency: s.currency,
    summary: result ? serializeSettlementResult(result) : null,
    totals: {
      saleProceeds: moneyField(s.saleProceeds, { currency: s.currency, finalized: true }),
      closingCosts: moneyField(s.closingCosts, { currency: s.currency, finalized: true }),
      totalPayouts: moneyField(totalPayouts.toFixed(3), { currency: s.currency, finalized: true }),
      totalPaid: moneyField(totalPaid.toFixed(3), { currency: s.currency, finalized: true }),
    },
    lines: s.lines
      .sort((a, b) => Number(b.isCoordinator) - Number(a.isCoordinator) || Number(dstr(b.totalPayout)) - Number(dstr(a.totalPayout)))
      .map((l) => {
        const full = byPartner.get(l.partnerId);
        return {
          ...(full ?? {}),
          partnerId: l.partnerId,
          label: l.label,
          code: inv.get(l.partnerId)?.code ?? null,
          phone: inv.get(l.partnerId)?.phone ?? null,
          isCoordinator: l.isCoordinator,
          ownershipPercent: full?.ownershipPercent ?? dstr(l.ownershipPercent),
          capitalReturned: dstr(l.capitalReturned),
          expenseReimbursement: dstr(l.expenseReimbursement),
          grossProfit: dstr(l.grossProfit),
          commissionPaid: dstr(l.commissionPaid),
          profitShare: dstr(l.profitShare),
          commissionEarned: dstr(l.commissionEarned),
          totalPayout: dstr(l.totalPayout),
          paidAmount: dstr(l.paidAmount),
          paidAt: l.paidAt?.toISOString() ?? null,
          paidRef: l.paidRef,
        };
      }),
  };
}

export async function latestSettlement(projectId: string) {
  const s = await prisma.invSettlement.findFirst({
    where: { projectId, hypothetical: false, status: { in: ["posted", "paid"] } },
    orderBy: { createdAt: "desc" },
  });
  return s ? getSettlement(projectId, s.id) : null;
}

/** Record that a partner's payout was handed over (or undo it). */
export async function markPayout(
  projectId: string,
  settlementId: string,
  partnerId: string,
  body: Record<string, unknown>,
  actor: { id?: string; email?: string }
) {
  const s = await prisma.invSettlement.findFirst({ where: { id: settlementId, projectId }, include: { lines: true } });
  if (!s) throw Object.assign(new Error("Settlement not found"), { status: 404 });
  const line = s.lines.find((l) => l.partnerId === partnerId);
  if (!line) throw Object.assign(new Error("Partner not in settlement"), { status: 404 });
  const paid = body.paid !== false;
  await prisma.invSettlementLine.update({
    where: { id: line.id },
    data: paid
      ? {
          paidAmount: line.totalPayout,
          paidAt: body.paidAt && !Number.isNaN(new Date(String(body.paidAt)).getTime()) ? new Date(String(body.paidAt)) : new Date(),
          paidRef: body.paidRef ? String(body.paidRef).slice(0, 200) : null,
        }
      : { paidAmount: "0", paidAt: null, paidRef: null },
  });
  const lines = await prisma.invSettlementLine.findMany({ where: { settlementId } });
  const allPaid = lines.every((l) => Number(dstr(l.totalPayout)) <= 0 || Number(dstr(l.paidAmount)) >= Number(dstr(l.totalPayout)));
  await prisma.invSettlement.update({ where: { id: settlementId }, data: { status: allPaid ? "paid" : "posted" } });
  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: paid ? "settlement.payout.paid" : "settlement.payout.unpaid",
    entityType: "InvSettlementLine",
    entityId: line.id,
    newState: { paidRef: body.paidRef ?? null },
  });
  return getSettlement(projectId, settlementId);
}
