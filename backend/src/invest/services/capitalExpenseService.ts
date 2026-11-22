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
  if (!(Number(amount) > 0) || Number(amount) > 1e12) {
    throw Object.assign(new Error("المبلغ يجب أن يكون أكبر من صفر"), { status: 400 });
  }

  const membership = await prisma.invMembership.findUnique({
    where: { projectId_investorId: { projectId, investorId } },
  });
  if (!membership || !membership.active) {
    throw Object.assign(new Error("الشريك ليس عضواً في المشروع"), { status: 400 });
  }
  if (["settled", "closed", "cancelled"].includes(project.status)) {
    throw Object.assign(new Error("المشروع مغلق"), { status: 400 });
  }

  const kind = CONTRIBUTION_KINDS.includes(String(data.kind) as (typeof CONTRIBUTION_KINDS)[number])
    ? String(data.kind)
    : "additional";
  const contributedAt = parseDate(data.contributedAt);
  const withdrawal = kind === "withdrawal";
  if (withdrawal) {
    const { resolveProjectPartners } = await import("./core");
    const me = (await resolveProjectPartners(projectId)).find((p) => p.investorId === investorId);
    if (!me || Number(me.capitalContributed) < Number(amount)) {
      throw Object.assign(new Error(`لا يمكن سحب أكثر من رأس مال الشريك (${me?.capitalContributed ?? "0"})`), { status: 400 });
    }
  }

  const journal = await postBalancedJournal({
    organizationId: project.organizationId,
    projectId,
    memo: `Capital contribution ${kind}`,
    valueDate: contributedAt,
    createdBy: actor.id,
    idempotencyKey: data.idempotencyKey ? String(data.idempotencyKey) : undefined,
    lines: [
      {
        accountCode: PROJECT_COA.BANK,
        debit: withdrawal ? "0" : amount,
        credit: withdrawal ? amount : "0",
        currency: project.currency,
        partnerId: investorId,
      },
      {
        accountCode: PROJECT_COA.INVESTOR_CAPITAL,
        debit: withdrawal ? amount : "0",
        credit: withdrawal ? "0" : amount,
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
      // Withdrawals reduce the partner's equity (resolveProjectPartners subtracts them).
      countsAsEquity: data.countsAsEquity !== false,
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

export function serializeExpense(e: {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  amount: { toString(): string };
  currency: string;
  expenseDate: Date;
  status: string;
  createdAt: Date;
  approvedAt: Date | null;
  rejectedReason: string | null;
  payerInvestorId: string | null;
  paidByCoordinator: boolean;
  reimbursementDue: { toString(): string };
  payerInvestor?: { displayName: string | null; legalName: string; code: string | null } | null;
}) {
  const fundedBy = e.payerInvestorId || e.paidByCoordinator ? "partner" : "project";
  return {
    id: e.id,
    title: e.title,
    category: e.category,
    description: e.description,
    amount: moneyField(e.amount, { currency: e.currency, finalized: e.status === "approved" || e.status === "reimbursed" }),
    expenseDate: e.expenseDate.toISOString().slice(0, 10),
    status: e.status,
    submittedAt: e.createdAt.toISOString(),
    approvedAt: e.approvedAt?.toISOString() ?? null,
    rejectedReason: e.rejectedReason,
    finalized: e.status === "approved" || e.status === "reimbursed",
    fundedBy,
    payerInvestorId: e.payerInvestorId,
    payerName: e.payerInvestor ? e.payerInvestor.displayName || e.payerInvestor.legalName : e.paidByCoordinator ? "المنسق" : null,
    payerCode: e.payerInvestor?.code ?? null,
    paidByCoordinator: e.paidByCoordinator,
    reimbursable: fundedBy === "partner" && Number(dstr(e.reimbursementDue)) > 0,
  };
}

export async function listExpenses(projectId: string) {
  const rows = await prisma.invExpense.findMany({
    where: { projectId },
    include: { payerInvestor: { select: { displayName: true, legalName: true, code: true } } },
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(serializeExpense);
}

const CONTRIBUTION_KINDS = ["initial", "additional", "capital_call", "adjustment", "withdrawal"] as const;

export const EXPENSE_CATEGORIES = [
  "land_purchase_fees",
  "registration",
  "survey",
  "legal",
  "brokerage",
  "taxes",
  "development",
  "fencing",
  "maintenance",
  "marketing",
  "valuation",
  "transport",
  "other",
] as const;

function parseDate(v: unknown): Date {
  if (v == null || v === "") return new Date();
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw Object.assign(new Error("تاريخ غير صالح"), { status: 400 });
  return d;
}

function strictMakerChecker() {
  return process.env.INVEST_STRICT_MAKER_CHECKER === "1";
}

export async function reverseContribution(id: string, actor: { id?: string; email?: string }, reason?: string) {
  const c = await prisma.invContribution.findUnique({ where: { id }, include: { project: true } });
  if (!c) throw Object.assign(new Error("الحركة غير موجودة"), { status: 404 });
  if (c.approvalStatus !== "approved") throw Object.assign(new Error("الحركة معكوسة مسبقاً"), { status: 400 });
  if (["settled", "closed"].includes(c.project.status)) {
    throw Object.assign(new Error("لا يمكن عكس حركة في مشروع تمت تسويته"), { status: 400 });
  }
  const amount = dstr(c.amount);
  const withdrawal = c.kind === "withdrawal";
  const journal = await postBalancedJournal({
    organizationId: c.project.organizationId,
    projectId: c.projectId,
    memo: `Reversal of contribution ${c.id}${reason ? `: ${reason}` : ""}`,
    valueDate: new Date(),
    createdBy: actor.id,
    idempotencyKey: `reverse:contribution:${c.id}`,
    lines: [
      { accountCode: PROJECT_COA.BANK, debit: withdrawal ? amount : "0", credit: withdrawal ? "0" : amount, currency: c.currency, partnerId: c.investorId },
      { accountCode: PROJECT_COA.INVESTOR_CAPITAL, debit: withdrawal ? "0" : amount, credit: withdrawal ? amount : "0", currency: c.currency, partnerId: c.investorId },
    ],
  });
  if (c.journalId) {
    await prisma.invJournal.update({ where: { id: c.journalId }, data: { status: "reversed" } }).catch(() => undefined);
    await prisma.invJournal.update({ where: { id: journal.id }, data: { reversesJournalId: c.journalId } }).catch(() => undefined);
  }
  await prisma.invContribution.update({ where: { id }, data: { approvalStatus: "reversed" } });
  await prisma.invTransaction.create({
    data: {
      projectId: c.projectId,
      partnerId: c.investorId,
      type: "contribution.reversed",
      amount,
      currency: c.currency,
      transactionDate: new Date(),
      description: reason ?? null,
      approvalStatus: "approved",
      createdBy: actor.id,
      journalId: journal.id,
    },
  });
  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "contribution.reverse",
    entityType: "InvContribution",
    entityId: id,
    reason,
  });
}

export async function reverseExpense(id: string, actor: { id?: string; email?: string }, reason?: string) {
  const e = await prisma.invExpense.findUnique({ where: { id }, include: { project: true } });
  if (!e) throw Object.assign(new Error("المصروف غير موجود"), { status: 404 });
  if (["settled", "closed"].includes(e.project.status)) {
    throw Object.assign(new Error("لا يمكن إلغاء مصروف في مشروع تمت تسويته"), { status: 400 });
  }
  if (e.status === "pending") {
    await prisma.invExpense.update({
      where: { id },
      data: { status: "rejected", rejectedReason: reason ?? "ألغي", approvedBy: actor.id, approvedAt: new Date() },
    });
  } else if (e.status === "approved") {
    const amount = dstr(e.amount);
    const partnerFunded = Boolean(e.payerInvestorId || e.paidByCoordinator);
    const journal = await postBalancedJournal({
      organizationId: e.project.organizationId,
      projectId: e.projectId,
      memo: `Reversal of expense: ${e.title}`,
      valueDate: new Date(),
      createdBy: actor.id,
      idempotencyKey: `reverse:expense:${e.id}`,
      lines: [
        {
          accountCode: partnerFunded ? PROJECT_COA.REIMBURSEMENT_PAYABLE : PROJECT_COA.BANK,
          debit: amount,
          credit: "0",
          currency: e.currency,
          partnerId: e.payerInvestorId ?? undefined,
        },
        { accountCode: PROJECT_COA.EXPENSE, debit: "0", credit: amount, currency: e.currency, partnerId: e.payerInvestorId ?? undefined },
      ],
    });
    if (e.journalId) {
      await prisma.invJournal.update({ where: { id: e.journalId }, data: { status: "reversed" } }).catch(() => undefined);
      await prisma.invJournal.update({ where: { id: journal.id }, data: { reversesJournalId: e.journalId } }).catch(() => undefined);
    }
    await prisma.invExpense.update({
      where: { id },
      data: { status: "written_off", rejectedReason: reason ?? "ألغي بعد الاعتماد", reimbursementDue: "0" },
    });
  } else {
    throw Object.assign(new Error("لا يمكن إلغاء هذا المصروف"), { status: 400 });
  }
  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "expense.reverse",
    entityType: "InvExpense",
    entityId: id,
    reason,
  });
}

export async function createExpense(
  projectId: string,
  data: Record<string, unknown>,
  actor: { id?: string; email?: string }
) {
  const project = await prisma.invProject.findUnique({ where: { id: projectId } });
  if (!project) throw Object.assign(new Error("المشروع غير موجود"), { status: 404 });
  if (["settled", "closed", "cancelled"].includes(project.status)) {
    throw Object.assign(new Error("المشروع مغلق"), { status: 400 });
  }
  const title = String(data.title || "").trim();
  if (!title) throw Object.assign(new Error("وصف المصروف مطلوب"), { status: 400 });
  const amount = dstr(data.amount as string | number | null | undefined);
  if (!(Number(amount) > 0) || Number(amount) > 1e12) {
    throw Object.assign(new Error("المبلغ يجب أن يكون أكبر من صفر"), { status: 400 });
  }

  const fundedBy = data.fundedBy === "project" ? "project" : "partner";
  let payerInvestorId: string | null = null;
  if (fundedBy === "partner") {
    payerInvestorId = data.payerInvestorId ? String(data.payerInvestorId) : null;
    if (!payerInvestorId) {
      const coord = await prisma.invMembership.findFirst({ where: { projectId, isCoordinator: true, active: true } });
      payerInvestorId = coord?.investorId ?? null;
    }
    if (!payerInvestorId) throw Object.assign(new Error("اختر الشريك الذي دفع المصروف"), { status: 400 });
    const m = await prisma.invMembership.findUnique({
      where: { projectId_investorId: { projectId, investorId: payerInvestorId } },
    });
    if (!m || !m.active) throw Object.assign(new Error("الدافع ليس شريكاً في المشروع"), { status: 400 });
  }

  const row = await prisma.invExpense.create({
    data: {
      projectId,
      title: title.slice(0, 300),
      category: data.category && (EXPENSE_CATEGORIES as readonly string[]).includes(String(data.category)) ? String(data.category) : "other",
      description: data.description ? String(data.description).slice(0, 2000) : null,
      amount,
      currency: project.currency,
      expenseDate: parseDate(data.expenseDate),
      status: "pending",
      // Partner-paid expenses are reimbursed at settlement; project-funded ones came out of the pool.
      reimbursementDue: fundedBy === "partner" ? amount : "0",
      reimbursementPaid: "0",
      paidByCoordinator: false,
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
    newState: { projectId, amount, title, fundedBy, payerInvestorId },
  });

  if (data.approveNow === true && !strictMakerChecker()) {
    await approveExpense(row.id, actor, true, undefined, { allowSelf: true });
  }
  const fresh = await prisma.invExpense.findUniqueOrThrow({
    where: { id: row.id },
    include: { payerInvestor: { select: { displayName: true, legalName: true, code: true } } },
  });
  return serializeExpense(fresh);
}

export async function approveExpense(
  expenseId: string,
  actor: { id?: string; email?: string },
  approve: boolean,
  reason?: string,
  opts: { allowSelf?: boolean } = {}
) {
  const expense = await prisma.invExpense.findUnique({
    where: { id: expenseId },
    include: { project: true },
  });
  if (!expense) throw Object.assign(new Error("Expense not found"), { status: 404 });
  if (expense.status !== "pending") {
    throw Object.assign(new Error("المصروف ليس بانتظار الاعتماد"), { status: 400 });
  }
  if (["settled", "closed", "cancelled"].includes(expense.project.status)) {
    throw Object.assign(new Error("المشروع مغلق"), { status: 400 });
  }
  // Maker-checker: creator cannot approve
  // Maker-checker is opt-in (INVEST_STRICT_MAKER_CHECKER=1): a single-admin office must be able to
  // record and approve its own expenses.
  if (
    approve &&
    strictMakerChecker() &&
    !opts.allowSelf &&
    expense.createdBy &&
    actor.id &&
    expense.createdBy === actor.id
  ) {
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
        accountCode:
          expense.payerInvestorId || expense.paidByCoordinator ? PROJECT_COA.REIMBURSEMENT_PAYABLE : PROJECT_COA.BANK,
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
