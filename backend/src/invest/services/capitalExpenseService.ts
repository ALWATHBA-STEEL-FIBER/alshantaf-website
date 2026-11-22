import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { PROJECT_COA, validateBalancedJournal } from "../finance";
import { investAudit } from "../lib/auditInvest";
import { moneyField, dstr } from "../lib/moneyField";
import { cleanSplitInput } from "./expenseSplit";

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
  return rows.map(serializeContribution);
}

export const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "other"] as const;

function paymentMethodOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (!(PAYMENT_METHODS as readonly string[]).includes(String(v))) throw Object.assign(new Error("طريقة دفع غير صالحة"), { status: 400 });
  return String(v);
}

function textOrNull(v: unknown, max: number): string | null {
  if (v == null) return null;
  const x = String(v).trim();
  return x ? x.slice(0, max) : null;
}

export function serializeContribution(c: {
  id: string;
  investorId: string;
  investor: { displayName: string | null; legalName: string; code: string | null };
  amount: { toString(): string };
  currency: string;
  contributedAt: Date;
  approvalStatus: string;
  description: string | null;
  kind: string;
  paymentMethod: string | null;
  paymentRef: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    investorId: c.investorId,
    investorName: c.investor.displayName || c.investor.legalName,
    investorCode: c.investor.code,
    amount: moneyField(c.amount, { currency: c.currency, finalized: c.approvalStatus === "approved" }),
    contributedAt: c.contributedAt.toISOString().slice(0, 10),
    status: c.approvalStatus,
    notes: c.description,
    kind: c.kind,
    paymentMethod: c.paymentMethod,
    paymentRef: c.paymentRef,
    edited: c.updatedAt.getTime() - c.createdAt.getTime() > 2000,
  };
}

/** Journal lines for a capital movement (reverse=true swaps debit/credit). */
function contributionLines(investorId: string, amount: string, withdrawal: boolean, currency: string, reverse = false) {
  const inflow = withdrawal === reverse; // deposit, or reversal of a withdrawal
  return [
    { accountCode: PROJECT_COA.BANK, debit: inflow ? amount : "0", credit: inflow ? "0" : amount, currency, partnerId: investorId },
    { accountCode: PROJECT_COA.INVESTOR_CAPITAL, debit: inflow ? "0" : amount, credit: inflow ? amount : "0", currency, partnerId: investorId },
  ];
}

/** Partner capital (signed, approved, equity) excluding one contribution row. */
async function capitalExcluding(projectId: string, investorId: string, excludeId: string) {
  const rows = await prisma.invContribution.findMany({
    where: { projectId, investorId, approvalStatus: "approved", countsAsEquity: true, id: { not: excludeId } },
    select: { amount: true, kind: true },
  });
  return rows.reduce((a, r) => a + (r.kind === "withdrawal" ? -1 : 1) * Number(dstr(r.amount)), 0);
}

const CLOSED = ["settled", "closed", "cancelled"];

/**
 * Edit a partner payment. Money changes (amount / type / partner / date) reverse the old journal
 * and post a corrected one, so the ledger keeps a full trail.
 */
export async function updateContribution(id: string, data: Record<string, unknown>, actor: { id?: string; email?: string }) {
  const c = await prisma.invContribution.findUnique({ where: { id }, include: { project: true } });
  if (!c) throw Object.assign(new Error("الدفعة غير موجودة"), { status: 404 });
  if (c.approvalStatus !== "approved") throw Object.assign(new Error("لا يمكن تعديل دفعة معكوسة"), { status: 400 });
  if (CLOSED.includes(c.project.status)) throw Object.assign(new Error("لا يمكن تعديل دفعة في مشروع مغلق أو تمت تسويته"), { status: 400 });
  const has = (k: string) => Object.prototype.hasOwnProperty.call(data, k);

  const investorId = has("investorId") ? String(data.investorId || "").trim() : c.investorId;
  if (investorId !== c.investorId) {
    const m = await prisma.invMembership.findUnique({ where: { projectId_investorId: { projectId: c.projectId, investorId } } });
    if (!m || !m.active) throw Object.assign(new Error("الشريك ليس عضواً في المشروع"), { status: 400 });
  }
  const amount = has("amount") ? dstr(data.amount as string | number | null | undefined) : dstr(c.amount);
  if (!(Number(amount) > 0) || Number(amount) > 1e12) throw Object.assign(new Error("المبلغ يجب أن يكون أكبر من صفر"), { status: 400 });
  const kind = has("kind") ? String(data.kind) : c.kind;
  if (!CONTRIBUTION_KINDS.includes(kind as (typeof CONTRIBUTION_KINDS)[number])) throw Object.assign(new Error("نوع دفعة غير صالح"), { status: 400 });
  const contributedAt = has("contributedAt") ? parseDate(data.contributedAt) : c.contributedAt;
  const description = has("notes") ? textOrNull(data.notes, 1000) : has("description") ? textOrNull(data.description, 1000) : c.description;
  const paymentMethod = has("paymentMethod") ? paymentMethodOrNull(data.paymentMethod) : c.paymentMethod;
  const paymentRef = has("paymentRef") ? textOrNull(data.paymentRef, 120) : c.paymentRef;

  const signedNew = (kind === "withdrawal" ? -1 : 1) * Number(amount);
  for (const inv of new Set([c.investorId, investorId])) {
    const rest = await capitalExcluding(c.projectId, inv, id);
    const after = rest + (inv === investorId && c.countsAsEquity ? signedNew : 0);
    if (after < -0.0005) {
      throw Object.assign(new Error("التعديل يجعل رأس مال الشريك سالباً (السحوبات أكبر من الدفعات)"), { status: 400 });
    }
  }

  const moneyChanged =
    investorId !== c.investorId ||
    Number(amount) !== Number(dstr(c.amount)) ||
    kind !== c.kind ||
    contributedAt.toISOString().slice(0, 10) !== c.contributedAt.toISOString().slice(0, 10);

  let journalId = c.journalId;
  if (moneyChanged) {
    const stamp = c.updatedAt.getTime();
    const rev = await postBalancedJournal({
      organizationId: c.project.organizationId,
      projectId: c.projectId,
      memo: `Edit (reverse) contribution ${c.id}`,
      valueDate: new Date(),
      createdBy: actor.id,
      idempotencyKey: `edit-rev:contribution:${c.id}:${stamp}`,
      lines: contributionLines(c.investorId, dstr(c.amount), c.kind === "withdrawal", c.currency, true),
    });
    if (c.journalId) {
      await prisma.invJournal.update({ where: { id: c.journalId }, data: { status: "reversed" } }).catch(() => undefined);
      await prisma.invJournal.update({ where: { id: rev.id }, data: { reversesJournalId: c.journalId } }).catch(() => undefined);
    }
    const fresh = await postBalancedJournal({
      organizationId: c.project.organizationId,
      projectId: c.projectId,
      memo: `Capital contribution ${kind} (edited)`,
      valueDate: contributedAt,
      createdBy: actor.id,
      idempotencyKey: `edit-new:contribution:${c.id}:${stamp}`,
      lines: contributionLines(investorId, amount, kind === "withdrawal", c.currency),
    });
    journalId = fresh.id;
  }

  const row = await prisma.invContribution.update({
    where: { id },
    data: {
      investorId,
      amount,
      kind: kind as "initial" | "additional" | "capital_call" | "adjustment" | "withdrawal",
      contributedAt,
      description,
      paymentMethod,
      paymentRef,
      journalId,
    },
    include: { investor: true },
  });
  if (moneyChanged) {
    await prisma.invTransaction.create({
      data: {
        projectId: c.projectId,
        partnerId: investorId,
        type: "contribution.edited",
        amount,
        currency: c.currency,
        transactionDate: contributedAt,
        description: `${dstr(c.amount)} → ${amount}`,
        approvalStatus: "approved",
        createdBy: actor.id,
        journalId,
      },
    });
  }
  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "contribution.update",
    entityType: "InvContribution",
    entityId: id,
    previousState: { investorId: c.investorId, amount: dstr(c.amount), kind: c.kind, contributedAt: c.contributedAt, description: c.description },
    newState: { investorId, amount, kind, contributedAt, description, paymentMethod, paymentRef },
  });
  return serializeContribution(row);
}

/** Delete a partner payment: reverses its journal (if still active) and removes the row. */
export async function deleteContribution(id: string, actor: { id?: string; email?: string }, reason?: string) {
  const c = await prisma.invContribution.findUnique({ where: { id }, include: { project: true } });
  if (!c) throw Object.assign(new Error("الدفعة غير موجودة"), { status: 404 });
  if (CLOSED.includes(c.project.status)) throw Object.assign(new Error("لا يمكن حذف دفعة في مشروع مغلق أو تمت تسويته"), { status: 400 });
  if (c.approvalStatus === "approved") {
    if (c.kind !== "withdrawal" && c.countsAsEquity) {
      const rest = await capitalExcluding(c.projectId, c.investorId, id);
      if (rest < -0.0005) throw Object.assign(new Error("احذف السحوبات أولاً — حذف هذه الدفعة يجعل رأس المال سالباً"), { status: 400 });
    }
    await reverseContribution(id, actor, reason ?? "حذف الدفعة");
  }
  await prisma.invContribution.delete({ where: { id } });
  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "contribution.delete",
    entityType: "InvContribution",
    entityId: id,
    reason,
    previousState: { projectId: c.projectId, investorId: c.investorId, amount: dstr(c.amount), kind: c.kind, contributedAt: c.contributedAt },
  });
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
      description: textOrNull(data.notes ?? data.description, 1000),
      paymentMethod: paymentMethodOrNull(data.paymentMethod),
      paymentRef: textOrNull(data.paymentRef, 120),
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

  return serializeContribution(row);
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
  splitMode?: string;
  splitShares?: unknown;
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
    splitMode: e.splitMode ?? "ownership",
    splitShares: (e.splitShares as Record<string, string> | null) ?? null,
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
  const split = cleanSplitInput(data.splitMode, data.splitShares, await activeMemberIds(projectId));

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
      splitMode: split.splitMode,
      splitShares: split.splitShares ?? undefined,
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

async function activeMemberIds(projectId: string) {
  const ms = await prisma.invMembership.findMany({ where: { projectId, active: true }, select: { investorId: true } });
  return ms.map((m) => m.investorId);
}

function expenseJournalLines(e: { amount: string; currency: string; payerInvestorId: string | null; partnerFunded: boolean }, reverse = false) {
  const debitExpense = !reverse;
  return [
    {
      accountCode: PROJECT_COA.EXPENSE,
      debit: debitExpense ? e.amount : "0",
      credit: debitExpense ? "0" : e.amount,
      currency: e.currency,
      partnerId: e.payerInvestorId ?? undefined,
    },
    {
      accountCode: e.partnerFunded ? PROJECT_COA.REIMBURSEMENT_PAYABLE : PROJECT_COA.BANK,
      debit: debitExpense ? "0" : e.amount,
      credit: debitExpense ? e.amount : "0",
      currency: e.currency,
      partnerId: e.payerInvestorId ?? undefined,
    },
  ];
}

/**
 * Edit an expense: text, category, date, who carries it (split), and — while not yet reimbursed —
 * the amount and who paid. Approved money changes re-post the journal.
 */
export async function updateExpense(id: string, data: Record<string, unknown>, actor: { id?: string; email?: string }) {
  const e = await prisma.invExpense.findUnique({ where: { id }, include: { project: true } });
  if (!e) throw Object.assign(new Error("المصروف غير موجود"), { status: 404 });
  if (!["pending", "approved"].includes(e.status)) throw Object.assign(new Error("لا يمكن تعديل مصروف ملغى أو مسترد"), { status: 400 });
  if (CLOSED.includes(e.project.status)) throw Object.assign(new Error("لا يمكن تعديل مصروف في مشروع مغلق أو تمت تسويته"), { status: 400 });
  const has = (k: string) => Object.prototype.hasOwnProperty.call(data, k);

  const title = has("title") ? String(data.title || "").trim().slice(0, 300) : e.title;
  if (!title) throw Object.assign(new Error("وصف المصروف مطلوب"), { status: 400 });
  const category = has("category")
    ? (EXPENSE_CATEGORIES as readonly string[]).includes(String(data.category)) ? String(data.category) : "other"
    : e.category;
  const description = has("description") ? textOrNull(data.description, 2000) : e.description;
  const expenseDate = has("expenseDate") ? parseDate(data.expenseDate) : e.expenseDate;
  const amount = has("amount") ? dstr(data.amount as string | number | null | undefined) : dstr(e.amount);
  if (!(Number(amount) > 0) || Number(amount) > 1e12) throw Object.assign(new Error("المبلغ يجب أن يكون أكبر من صفر"), { status: 400 });

  const members = await activeMemberIds(e.projectId);
  const wasPartner = Boolean(e.payerInvestorId || e.paidByCoordinator);
  const fundedBy = has("fundedBy") ? (data.fundedBy === "project" ? "project" : "partner") : wasPartner ? "partner" : "project";
  let payerInvestorId: string | null = fundedBy === "project" ? null : e.payerInvestorId;
  if (fundedBy === "partner" && has("payerInvestorId")) payerInvestorId = data.payerInvestorId ? String(data.payerInvestorId) : null;
  if (fundedBy === "partner" && !payerInvestorId) throw Object.assign(new Error("اختر الشريك الذي دفع المصروف"), { status: 400 });
  if (payerInvestorId && payerInvestorId !== e.payerInvestorId && !members.includes(payerInvestorId)) {
    throw Object.assign(new Error("الدافع ليس شريكاً في المشروع"), { status: 400 });
  }
  const split =
    has("splitMode") || has("splitShares")
      ? cleanSplitInput(has("splitMode") ? data.splitMode : e.splitMode, data.splitShares ?? e.splitShares, members)
      : { splitMode: e.splitMode, splitShares: e.splitShares as Record<string, string> | null };

  const partnerFunded = fundedBy === "partner";
  const moneyChanged =
    Number(amount) !== Number(dstr(e.amount)) || payerInvestorId !== e.payerInvestorId || partnerFunded !== wasPartner;
  if (moneyChanged && Number(dstr(e.reimbursementPaid)) > 0) {
    throw Object.assign(new Error("تم رد جزء من المصروف — لا يمكن تغيير المبلغ أو الدافع"), { status: 400 });
  }

  let journalId = e.journalId;
  if (moneyChanged && e.status === "approved") {
    const stamp = e.updatedAt.getTime();
    const rev = await postBalancedJournal({
      organizationId: e.project.organizationId,
      projectId: e.projectId,
      memo: `Edit (reverse) expense: ${e.title}`,
      valueDate: new Date(),
      createdBy: actor.id,
      idempotencyKey: `edit-rev:expense:${e.id}:${stamp}`,
      lines: expenseJournalLines({ amount: dstr(e.amount), currency: e.currency, payerInvestorId: e.payerInvestorId, partnerFunded: wasPartner }, true),
    });
    if (e.journalId) {
      await prisma.invJournal.update({ where: { id: e.journalId }, data: { status: "reversed" } }).catch(() => undefined);
      await prisma.invJournal.update({ where: { id: rev.id }, data: { reversesJournalId: e.journalId } }).catch(() => undefined);
    }
    const fresh = await postBalancedJournal({
      organizationId: e.project.organizationId,
      projectId: e.projectId,
      memo: `Expense (edited): ${title}`,
      valueDate: expenseDate,
      createdBy: actor.id,
      idempotencyKey: `edit-new:expense:${e.id}:${stamp}`,
      lines: expenseJournalLines({ amount, currency: e.currency, payerInvestorId, partnerFunded }),
    });
    journalId = fresh.id;
  }

  const row = await prisma.invExpense.update({
    where: { id },
    data: {
      title,
      category,
      description,
      expenseDate,
      amount,
      payerInvestorId,
      paidByCoordinator: partnerFunded ? (payerInvestorId ? false : e.paidByCoordinator) : false,
      reimbursementDue: partnerFunded ? amount : "0",
      splitMode: split.splitMode,
      splitShares: split.splitShares ?? Prisma.DbNull,
      journalId,
    },
    include: { payerInvestor: { select: { displayName: true, legalName: true, code: true } } },
  });
  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "expense.update",
    entityType: "InvExpense",
    entityId: id,
    previousState: { title: e.title, amount: dstr(e.amount), payerInvestorId: e.payerInvestorId, splitMode: e.splitMode, splitShares: e.splitShares },
    newState: { title, amount, payerInvestorId, fundedBy, splitMode: split.splitMode, splitShares: split.splitShares },
  });
  return serializeExpense(row);
}

/** Delete an expense: reverses its journal when approved, then removes it. */
export async function deleteExpense(id: string, actor: { id?: string; email?: string }, reason?: string) {
  const e = await prisma.invExpense.findUnique({ where: { id }, include: { project: true, _count: { select: { documents: true } } } });
  if (!e) throw Object.assign(new Error("المصروف غير موجود"), { status: 404 });
  if (CLOSED.includes(e.project.status)) throw Object.assign(new Error("لا يمكن حذف مصروف في مشروع مغلق أو تمت تسويته"), { status: 400 });
  if (e.status === "reimbursed" || Number(dstr(e.reimbursementPaid)) > 0) {
    throw Object.assign(new Error("المصروف مسترد — لا يمكن حذفه"), { status: 400 });
  }
  if (e._count.documents > 0) throw Object.assign(new Error("للمصروف مرفقات — استخدم «إلغاء» بدل الحذف"), { status: 400 });
  if (e.status === "approved") await reverseExpense(id, actor, reason ?? "حذف المصروف");
  await prisma.invExpense.delete({ where: { id } });
  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "expense.delete",
    entityType: "InvExpense",
    entityId: id,
    reason,
    previousState: { projectId: e.projectId, title: e.title, amount: dstr(e.amount), status: e.status, payerInvestorId: e.payerInvestorId },
  });
}
