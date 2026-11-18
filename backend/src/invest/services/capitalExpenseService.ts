import { prisma } from "../../prisma";
import { PROJECT_COA, validateBalancedJournal } from "../finance";
import { investAudit } from "../lib/auditInvest";
import { moneyField, dstr } from "../lib/moneyField";

async function accountId(organizationId: string, code: string) {
  const a = await prisma.invLedgerAccount.findUnique({
    where: { organizationId_code: { organizationId, code } },
  });
  if (!a) throw Object.assign(new Error(`Ledger account ${code} missing`), { status: 500 });
  return a.id;
}

export async function postBalancedJournal(input: {
  organizationId: string;
  projectId: string;
  memo: string;
  valueDate: Date;
  createdBy?: string;
  idempotencyKey?: string;
  lines: { accountCode: string; debit: string; credit: string; currency: string; partnerId?: string; memo?: string }[];
}) {
  validateBalancedJournal(input.lines);
  if (input.idempotencyKey) {
    const existing = await prisma.invJournal.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: input.organizationId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return existing;
  }

  const resolved = [];
  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i];
    resolved.push({
      accountId: await accountId(input.organizationId, line.accountCode),
      partnerId: line.partnerId ?? null,
      debit: line.debit,
      credit: line.credit,
      currency: line.currency,
      memo: line.memo ?? null,
      lineNo: i + 1,
    });
  }

  return prisma.invJournal.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      status: "posted",
      memo: input.memo,
      valueDate: input.valueDate,
      postedAt: new Date(),
      postedBy: input.createdBy,
      createdBy: input.createdBy,
      idempotencyKey: input.idempotencyKey,
      lines: { create: resolved },
    },
  });
}

export async function listContributions(projectId: string) {
  const rows = await prisma.invContribution.findMany({
    where: { projectId },
    include: { investor: true },
    orderBy: { contributedAt: "desc" },
  });
  return rows.map((c) => ({
    id: c.id,
    investorId: c.investorId,
    investorName: c.investor.displayName || c.investor.legalName,
    amount: moneyField(c.amount, { currency: c.currency, finalized: c.approvalStatus === "approved" }),
    contributedAt: c.contributedAt.toISOString().slice(0, 10),
    status: c.approvalStatus,
    notes: c.description,
    kind: c.kind,
  }));
}

export async function createContribution(
  projectId: string,
  data: Record<string, unknown>,
  actor: { id?: string; email?: string }
) {
  const project = await prisma.invProject.findUnique({ where: { id: projectId } });
  if (!project) throw Object.assign(new Error("Project not found"), { status: 404 });
  const investorId = String(data.investorId || "").trim();
  if (!investorId) throw Object.assign(new Error("investorId is required"), { status: 400 });
  const amount = dstr(data.amount as string | number | null | undefined);
  if (!amount || Number(amount) <= 0) throw Object.assign(new Error("amount must be positive"), { status: 400 });

  const membership = await prisma.invMembership.findUnique({
    where: { projectId_investorId: { projectId, investorId } },
  });
  if (!membership) throw Object.assign(new Error("Investor is not a project member"), { status: 400 });

  const kind = String(data.kind || "additional");
  const contributedAt = data.contributedAt ? new Date(String(data.contributedAt)) : new Date();

  const journal = await postBalancedJournal({
    organizationId: project.organizationId,
    projectId,
    memo: `Capital contribution ${kind}`,
    valueDate: contributedAt,
    createdBy: actor.id,
    idempotencyKey: data.idempotencyKey ? String(data.idempotencyKey) : undefined,
    lines: [
      { accountCode: PROJECT_COA.BANK, debit: amount, credit: "0", currency: project.currency, partnerId: investorId },
      {
        accountCode: PROJECT_COA.INVESTOR_CAPITAL,
        debit: "0",
        credit: amount,
        currency: project.currency,
        partnerId: investorId,
      },
    ],
  });

  const row = await prisma.invContribution.create({
    data: {
      projectId,
      investorId,
      kind: kind as "initial" | "additional" | "capital_call" | "adjustment" | "withdrawal",
      amount,
      currency: project.currency,
      contributedAt,
      description: data.notes ? String(data.notes) : data.description ? String(data.description) : null,
      countsAsEquity: data.countsAsEquity !== false && kind !== "withdrawal",
      approvalStatus: "approved",
      approvedBy: actor.id,
      approvedAt: new Date(),
      createdBy: actor.id,
      journalId: journal.id,
    },
    include: { investor: true },
  });

  await prisma.invTransaction.create({
    data: {
      projectId,
      partnerId: investorId,
      type: `contribution.${kind}`,
      amount,
      currency: project.currency,
      transactionDate: contributedAt,
      description: row.description,
      approvalStatus: "approved",
      createdBy: actor.id,
      journalId: journal.id,
    },
  });

  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "contribution.create",
    entityType: "InvContribution",
    entityId: row.id,
    newState: { projectId, investorId, amount, kind },
  });

  return {
    id: row.id,
    investorId,
    investorName: row.investor.displayName || row.investor.legalName,
    amount: moneyField(row.amount, { currency: row.currency, finalized: true }),
    contributedAt: row.contributedAt.toISOString().slice(0, 10),
    status: row.approvalStatus,
    notes: row.description,
  };
}

export async function listExpenses(projectId: string) {
  const rows = await prisma.invExpense.findMany({
    where: { projectId },
    orderBy: { expenseDate: "desc" },
  });
  return rows.map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    amount: moneyField(e.amount, { currency: e.currency, finalized: e.status === "approved" || e.status === "reimbursed" }),
    status: e.status,
    submittedAt: e.createdAt.toISOString(),
    approvedAt: e.approvedAt?.toISOString() ?? null,
    finalized: e.status === "approved" || e.status === "reimbursed",
    payerInvestorId: e.payerInvestorId,
    paidByCoordinator: e.paidByCoordinator,
  }));
}

export async function createExpense(
  projectId: string,
  data: Record<string, unknown>,
  actor: { id?: string; email?: string }
) {
  const project = await prisma.invProject.findUnique({ where: { id: projectId } });
  if (!project) throw Object.assign(new Error("Project not found"), { status: 404 });
  const title = String(data.title || data.description || "").trim();
  if (!title) throw Object.assign(new Error("title is required"), { status: 400 });
  const amount = dstr(data.amount as string | number | null | undefined);
  if (!amount || Number(amount) <= 0) throw Object.assign(new Error("amount must be positive"), { status: 400 });

  const paidByCoordinator = Boolean(data.paidByCoordinator) || !data.payerInvestorId;
  const payerInvestorId = data.payerInvestorId ? String(data.payerInvestorId) : null;

  const row = await prisma.invExpense.create({
    data: {
      projectId,
      title,
      category: data.category ? String(data.category) : null,
      description: data.description ? String(data.description) : null,
      amount,
      currency: project.currency,
      expenseDate: data.expenseDate ? new Date(String(data.expenseDate)) : new Date(),
      status: "pending",
      reimbursementDue: amount,
      reimbursementPaid: "0",
      paidByCoordinator,
      payerInvestorId,
      createdBy: actor.id,
    },
  });

  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "expense.create",
    entityType: "InvExpense",
    entityId: row.id,
    newState: { projectId, amount, title },
  });

  return {
    id: row.id,
    title: row.title,
    category: row.category,
    amount: moneyField(row.amount, { currency: row.currency, finalized: false }),
    status: row.status,
    submittedAt: row.createdAt.toISOString(),
    approvedAt: null,
    finalized: false,
  };
}

export async function approveExpense(
  expenseId: string,
  actor: { id?: string; email?: string },
  approve: boolean,
  reason?: string
) {
  const expense = await prisma.invExpense.findUnique({
    where: { id: expenseId },
    include: { project: true },
  });
  if (!expense) throw Object.assign(new Error("Expense not found"), { status: 404 });
  if (expense.status !== "pending") {
    throw Object.assign(new Error("Expense is not pending"), { status: 400 });
  }
  // Maker-checker: creator cannot approve
  if (approve && expense.createdBy && actor.id && expense.createdBy === actor.id) {
    throw Object.assign(new Error("Maker-checker: you cannot approve your own expense"), { status: 403 });
  }

  if (!approve) {
    const updated = await prisma.invExpense.update({
      where: { id: expenseId },
      data: { status: "rejected", rejectedReason: reason ?? null, approvedBy: actor.id, approvedAt: new Date() },
    });
    await investAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "expense.reject",
      entityType: "InvExpense",
      entityId: expenseId,
      reason,
    });
    return {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      amount: moneyField(updated.amount, { currency: updated.currency }),
      finalized: false,
    };
  }

  const amount = dstr(expense.amount);
  const journal = await postBalancedJournal({
    organizationId: expense.project.organizationId,
    projectId: expense.projectId,
    memo: `Expense approved: ${expense.title}`,
    valueDate: expense.expenseDate,
    createdBy: actor.id,
    lines: [
      {
        accountCode: PROJECT_COA.EXPENSE,
        debit: amount,
        credit: "0",
        currency: expense.currency,
        partnerId: expense.payerInvestorId ?? undefined,
      },
      {
        accountCode: PROJECT_COA.REIMBURSEMENT_PAYABLE,
        debit: "0",
        credit: amount,
        currency: expense.currency,
        partnerId: expense.payerInvestorId ?? undefined,
      },
    ],
  });

  const updated = await prisma.invExpense.update({
    where: { id: expenseId },
    data: {
      status: "approved",
      approvedBy: actor.id,
      approvedAt: new Date(),
      journalId: journal.id,
    },
  });

  await prisma.invTransaction.create({
    data: {
      projectId: expense.projectId,
      partnerId: expense.payerInvestorId,
      type: "expense.approved",
      amount,
      currency: expense.currency,
      transactionDate: expense.expenseDate,
      description: expense.title,
      approvalStatus: "approved",
      createdBy: actor.id,
      journalId: journal.id,
    },
  });

  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "expense.approve",
    entityType: "InvExpense",
    entityId: expenseId,
  });

  return {
    id: updated.id,
    title: updated.title,
    status: updated.status,
    amount: moneyField(updated.amount, { currency: updated.currency, finalized: true }),
    approvedAt: updated.approvedAt?.toISOString() ?? null,
    finalized: true,
  };
}
