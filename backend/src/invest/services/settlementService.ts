import { prisma } from "../../prisma";
import { PROJECT_COA, runSettlement } from "../finance";
import { investAudit } from "../lib/auditInvest";
import { moneyField, dstr } from "../lib/moneyField";
import { parseCommissionRule, resolveProjectPartners } from "./core";
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
  if (existingPosted && body.force !== true) {
    throw Object.assign(new Error("Project already has a posted settlement"), { status: 409 });
  }

  const partners = await resolveProjectPartners(projectId);
  if (partners.length === 0) {
    throw Object.assign(new Error("No active partners"), { status: 400 });
  }

  const sale = body.saleProceeds ?? body.salePrice ?? project.actualSalePrice;
  if (sale == null) throw Object.assign(new Error("saleProceeds is required"), { status: 400 });

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
    })),
    commission: parseCommissionRule(body.commissionRule ?? project.commissionRule) ?? {
      basis: "distributable_profit",
      percent: 0,
    },
    coordinatorParticipatesInProfit: project.coordinatorParticipatesInProfit,
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
    if (again && body.force !== true) {
      throw Object.assign(new Error("Concurrent settlement blocked"), { status: 409 });
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
            capitalReturned: l.capitalReturned,
            expenseReimbursement: l.expenseReimbursement,
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
        status: "settled",
      },
    });

    await tx.invProjectStatusEvent.create({
      data: {
        projectId,
        fromStatus: project.status,
        toStatus: "settled",
        note: "Settlement posted",
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

  return {
    id: s.id,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    finalized: s.status === "posted" || s.status === "paid",
    hypothetical: s.hypothetical,
    totals: {
      saleProceeds: moneyField(s.saleProceeds, { currency: s.currency, finalized: true }),
      closingCosts: moneyField(s.closingCosts, { currency: s.currency, finalized: true }),
      totalPayouts: moneyField(
        s.lines.reduce((a, l) => a + Number(dstr(l.totalPayout)), 0).toFixed(3),
        { currency: s.currency, finalized: true }
      ),
    },
    lines: s.lines.map((l) => ({
      partnerId: l.partnerId,
      label: l.label,
      isCoordinator: l.isCoordinator,
      capitalReturned: moneyField(l.capitalReturned, { currency: s.currency, finalized: true }),
      expenseReimbursement: moneyField(l.expenseReimbursement, { currency: s.currency, finalized: true }),
      profitShare: moneyField(l.profitShare, { currency: s.currency, finalized: true }),
      commissionEarned: moneyField(l.commissionEarned, { currency: s.currency, finalized: true }),
      totalPayout: moneyField(l.totalPayout, { currency: s.currency, finalized: true }),
      paidAmount: moneyField(l.paidAmount, { currency: s.currency, finalized: true }),
    })),
  };
}
