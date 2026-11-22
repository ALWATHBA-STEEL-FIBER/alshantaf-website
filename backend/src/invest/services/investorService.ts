import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { Decimal } from "../finance/decimal";
import { investAudit } from "../lib/auditInvest";
import { maybeEncrypt, nationalIdHash, normalizeNationalId, safeDecrypt } from "../lib/crypto";
import { moneyField, dstr } from "../lib/moneyField";
import { ensureDefaultOrganization } from "./core";

type Actor = { id?: string; email?: string };

function bad(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

/** Keep digits and a leading + so phone search works regardless of spacing. */
export function normalizePhone(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const plus = s.startsWith("+") ? "+" : "";
  const digits = s.replace(/[^0-9]/g, "");
  return digits ? plus + digits : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

async function nextInvestorCode(organizationId: string): Promise<string> {
  const rows = await prisma.invInvestor.findMany({
    where: { organizationId, code: { startsWith: "P-" } },
    select: { code: true },
  });
  let max = 0;
  for (const r of rows) {
    const n = Number(String(r.code).slice(2));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `P-${String(max + 1).padStart(4, "0")}`;
}

/** Partners created by scripts or older code have no number yet — give them one. */
async function backfillMissingCodes(organizationId: string) {
  const missing = await prisma.invInvestor.findMany({
    where: { organizationId, code: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  for (const m of missing) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await prisma.invInvestor.update({ where: { id: m.id }, data: { code: await nextInvestorCode(organizationId) } });
        break;
      } catch (e) {
        if ((e as { code?: string }).code !== "P2002") throw e;
      }
    }
  }
}

function buildSearchWhere(organizationId: string, q: string): Prisma.InvInvestorWhereInput {
  const term = q.trim();
  if (!term) return { organizationId };
  const or: Prisma.InvInvestorWhereInput[] = [
    { legalName: { contains: term, mode: "insensitive" } },
    { displayName: { contains: term, mode: "insensitive" } },
    { code: { contains: term, mode: "insensitive" } },
    { email: { contains: term.toLowerCase() } },
    { city: { contains: term, mode: "insensitive" } },
  ];
  const digits = term.replace(/[^0-9]/g, "");
  if (digits.length >= 3) or.push({ phone: { contains: digits } });
  if (/^\d+$/.test(digits) && digits.length >= 1 && digits.length <= 4) {
    or.push({ code: { endsWith: digits.padStart(4, "0") } });
  }
  if (/^\d{4}$/.test(term)) or.push({ nationalIdLast4: term });
  const nid = normalizeNationalId(term);
  if (nid.length >= 5) or.push({ nationalIdHash: nationalIdHash(nid) });
  return { organizationId, OR: or };
}

const listInclude = {
  memberships: {
    where: { active: true },
    select: { projectId: true, isCoordinator: true, project: { select: { status: true } } },
  },
  contributions: { where: { approvalStatus: "approved" as const, countsAsEquity: true } },
  portalUser: { select: { email: true, active: true } },
} satisfies Prisma.InvInvestorInclude;

type ListRow = Prisma.InvInvestorGetPayload<{ include: typeof listInclude }>;

function serializeListRow(r: ListRow) {
  const capital = r.contributions.reduce(
    (a, c) => a.plus(new Decimal(dstr(c.amount)).times(c.kind === "withdrawal" ? -1 : 1)),
    new Decimal(0)
  );
  const open = r.memberships.filter((m) => !["settled", "closed", "cancelled"].includes(m.project.status));
  return {
    id: r.id,
    code: r.code,
    name: r.displayName || r.legalName,
    legalName: r.legalName,
    kind: r.kind,
    email: r.email,
    phone: r.phone,
    city: r.city,
    nationalIdLast4: r.nationalIdLast4,
    notes: r.notes,
    active: r.active,
    createdAt: r.createdAt.toISOString(),
    projectIds: r.memberships.map((m) => m.projectId),
    projectCount: r.memberships.length,
    openProjectCount: open.length,
    coordinatorOf: r.memberships.filter((m) => m.isCoordinator).length,
    portal: r.portalUser ? { email: r.portalUser.email, active: r.portalUser.active } : null,
    totals: {
      contributedCapital: moneyField(capital.toFixed(3), { currency: "JOD", finalized: true }),
    },
  };
}

export async function listInvestors(opts: { q?: string; active?: string; limit?: number } = {}) {
  const org = await ensureDefaultOrganization();
  await backfillMissingCodes(org.id);
  const where = buildSearchWhere(org.id, opts.q || "");
  if (opts.active === "1") where.active = true;
  if (opts.active === "0") where.active = false;
  const rows = await prisma.invInvestor.findMany({
    where,
    include: listInclude,
    orderBy: [{ active: "desc" }, { legalName: "asc" }],
    take: Math.min(Math.max(opts.limit ?? 500, 1), 1000),
  });
  return rows.map(serializeListRow);
}

/** Find existing partners that look like the one being created (same phone, ID, email or name). */
export async function findDuplicates(data: Record<string, unknown>, excludeId?: string) {
  const org = await ensureDefaultOrganization();
  const or: Prisma.InvInvestorWhereInput[] = [];
  const phone = normalizePhone(data.phone);
  if (phone) or.push({ phone });
  const email = str(data.email)?.toLowerCase();
  if (email) or.push({ email });
  const nid = str(data.nationalId);
  if (nid) or.push({ nationalIdHash: nationalIdHash(nid) });
  const name = str(data.name || data.legalName);
  if (name) or.push({ legalName: { equals: name, mode: "insensitive" } });
  if (!or.length) return [];
  const rows = await prisma.invInvestor.findMany({
    where: { organizationId: org.id, OR: or, ...(excludeId ? { id: { not: excludeId } } : {}) },
    include: listInclude,
    take: 5,
  });
  return rows.map(serializeListRow);
}

export async function createInvestor(data: Record<string, unknown>, actor: Actor) {
  const org = await ensureDefaultOrganization();
  const legalName = str(data.name || data.legalName);
  if (!legalName) throw bad("الاسم مطلوب");
  const nid = str(data.nationalId);
  const email = str(data.email)?.toLowerCase() ?? null;
  const phone = normalizePhone(data.phone);

  if (data.force !== true) {
    const dup = await findDuplicates({ phone, email, nationalId: nid });
    if (dup.length) {
      throw Object.assign(new Error(`يوجد شريك بنفس البيانات: ${dup[0].name} (${dup[0].code})`), {
        status: 409,
        duplicates: dup,
      });
    }
  }

  let investor;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await nextInvestorCode(org.id);
    try {
      investor = await prisma.invInvestor.create({
        data: {
          organizationId: org.id,
          code,
          kind: data.kind === "company" ? "company" : "individual",
          legalName,
          displayName: str(data.displayName) ?? legalName,
          email,
          phone,
          city: str(data.city),
          nationalIdEnc: maybeEncrypt(nid),
          nationalIdHash: nationalIdHash(nid),
          nationalIdLast4: nid ? normalizeNationalId(nid).slice(-4) : null,
          address: str(data.address),
          bankDetailsEnc: str(data.bankDetails) ? maybeEncrypt(String(data.bankDetails)) : null,
          notes: str(data.notes),
        },
      });
      break;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002" && attempt < 4) continue;
      throw e;
    }
  }
  if (!investor) throw bad("تعذّر إنشاء الشريك", 500);

  if (data.portalEmail && data.portalPassword) {
    const passwordHash = await bcrypt.hash(String(data.portalPassword), 12);
    await prisma.invPortalUser.create({
      data: { investorId: investor.id, email: String(data.portalEmail).toLowerCase().trim(), passwordHash },
    });
  }

  await investAudit({
    organizationId: org.id,
    actorId: actor.id,
    actorEmail: actor.email,
    action: "investor.create",
    entityType: "InvInvestor",
    entityId: investor.id,
    newState: { legalName, code: investor.code },
  });

  const row = await prisma.invInvestor.findUniqueOrThrow({ where: { id: investor.id }, include: listInclude });
  return serializeListRow(row);
}

export async function getInvestor(id: string) {
  const r = await prisma.invInvestor.findUnique({
    where: { id },
    include: {
      memberships: { include: { project: true }, orderBy: { joinedAt: "desc" } },
      contributions: { include: { project: { select: { name: true, referenceNo: true } } }, orderBy: { contributedAt: "desc" } },
      expensesPaid: {
        where: { status: { in: ["pending", "approved", "reimbursed"] } },
        include: { project: { select: { name: true } } },
        orderBy: { expenseDate: "desc" },
      },
      portalUser: { select: { id: true, email: true, active: true, lastLoginAt: true } },
    },
  });
  if (!r) throw bad("الشريك غير موجود", 404);

  // Latest posted settlement line per project for this partner.
  const settlementLines = await prisma.invSettlementLine.findMany({
    where: { partnerId: id, settlement: { status: { in: ["posted", "paid"] }, hypothetical: false } },
    include: { settlement: { select: { projectId: true, createdAt: true, currency: true } } },
    orderBy: { settlement: { createdAt: "desc" } },
  });
  const lineByProject = new Map<string, (typeof settlementLines)[number]>();
  for (const l of settlementLines) if (!lineByProject.has(l.settlement.projectId)) lineByProject.set(l.settlement.projectId, l);

  const { resolveProjectPartners } = await import("./core");
  const projects = [];
  let capitalTotal = new Decimal(0);
  let realized = new Decimal(0);
  let paidOut = new Decimal(0);
  let toReceive = new Decimal(0);
  for (const m of r.memberships) {
    const partners = m.active ? await resolveProjectPartners(m.projectId) : [];
    const me = partners.find((p) => p.investorId === id);
    const line = lineByProject.get(m.projectId);
    if (me) capitalTotal = capitalTotal.plus(me.capitalContributed);
    if (line) {
      realized = realized.plus(dstr(line.profitShare)).plus(dstr(line.commissionEarned));
      paidOut = paidOut.plus(dstr(line.paidAmount));
      toReceive = toReceive.plus(new Decimal(dstr(line.totalPayout)).minus(dstr(line.paidAmount)));
    }
    projects.push({
      id: m.project.id,
      name: m.project.name,
      code: m.project.referenceNo,
      status: m.project.status,
      currency: m.project.currency,
      active: m.active,
      role: m.isCoordinator ? "coordinator" : "investor",
      ownershipPercent: me?.ownershipPercent ?? (m.ownershipPercent != null ? dstr(m.ownershipPercent) : null),
      capital: me?.capitalContributed ?? "0.000",
      expensesOutstanding: me?.expensesOutstanding ?? "0.000",
      commissionPercent: m.commissionPercent != null ? dstr(m.commissionPercent) : null,
      joinedAt: m.joinedAt.toISOString(),
      settlement: line
        ? {
            grossProfit: dstr(line.grossProfit),
            commissionPaid: dstr(line.commissionPaid),
            profitShare: dstr(line.profitShare),
            commissionEarned: dstr(line.commissionEarned),
            totalPayout: dstr(line.totalPayout),
            paidAmount: dstr(line.paidAmount),
            paidAt: line.paidAt?.toISOString() ?? null,
          }
        : null,
    });
  }

  const outstanding = r.expensesPaid
    .filter((e) => e.status === "approved")
    .reduce((a, e) => a.plus(Decimal.max(0, new Decimal(dstr(e.reimbursementDue)).minus(dstr(e.reimbursementPaid)))), new Decimal(0));

  return {
    id: r.id,
    code: r.code,
    name: r.displayName || r.legalName,
    legalName: r.legalName,
    displayName: r.displayName,
    kind: r.kind,
    email: r.email,
    phone: r.phone,
    city: r.city,
    address: r.address,
    nationalId: safeDecrypt(r.nationalIdEnc),
    nationalIdLast4: r.nationalIdLast4,
    bankDetails: safeDecrypt(r.bankDetailsEnc),
    notes: r.notes,
    active: r.active,
    createdAt: r.createdAt.toISOString(),
    projectIds: r.memberships.filter((m) => m.active).map((m) => m.projectId),
    projects,
    contributions: r.contributions.map((c) => ({
      id: c.id,
      projectId: c.projectId,
      projectName: c.project.name,
      kind: c.kind,
      amount: dstr(c.amount),
      currency: c.currency,
      contributedAt: c.contributedAt.toISOString().slice(0, 10),
      status: c.approvalStatus,
      notes: c.description,
    })),
    expenses: r.expensesPaid.map((e) => ({
      id: e.id,
      projectId: e.projectId,
      projectName: e.project.name,
      title: e.title,
      category: e.category,
      amount: dstr(e.amount),
      expenseDate: e.expenseDate.toISOString().slice(0, 10),
      status: e.status,
    })),
    portal: r.portalUser
      ? { email: r.portalUser.email, active: r.portalUser.active, lastLoginAt: r.portalUser.lastLoginAt }
      : null,
    totals: {
      contributedCapital: moneyField(capitalTotal.toFixed(3), { currency: "JOD", finalized: true }),
      outstandingReimbursements: moneyField(outstanding.toFixed(3), { currency: "JOD", finalized: true }),
      realizedProfit: moneyField(realized.toFixed(3), { currency: "JOD", finalized: true }),
      paidOut: moneyField(paidOut.toFixed(3), { currency: "JOD", finalized: true }),
      toReceive: moneyField(toReceive.toFixed(3), { currency: "JOD", finalized: true }),
    },
  };
}

export async function updateInvestor(id: string, data: Record<string, unknown>, actor: Actor) {
  const existing = await prisma.invInvestor.findUnique({ where: { id } });
  if (!existing) throw bad("الشريك غير موجود", 404);

  const has = (k: string) => Object.prototype.hasOwnProperty.call(data, k);
  const nid = has("nationalId") ? str(data.nationalId) : undefined;
  const legalName = has("name") || has("legalName") ? str(data.name ?? data.legalName) : undefined;
  if (legalName === null) throw bad("الاسم مطلوب");

  if (data.force !== true && (has("phone") || has("email") || nid)) {
    const dup = await findDuplicates(
      { phone: has("phone") ? data.phone : null, email: has("email") ? data.email : null, nationalId: nid },
      id
    );
    if (dup.length) {
      throw Object.assign(new Error(`يوجد شريك بنفس البيانات: ${dup[0].name} (${dup[0].code})`), {
        status: 409,
        duplicates: dup,
      });
    }
  }

  await prisma.invInvestor.update({
    where: { id },
    data: {
      legalName: legalName ?? undefined,
      displayName: has("displayName") ? str(data.displayName) : legalName ?? undefined,
      kind: has("kind") ? (data.kind === "company" ? "company" : "individual") : undefined,
      email: has("email") ? str(data.email)?.toLowerCase() ?? null : undefined,
      phone: has("phone") ? normalizePhone(data.phone) : undefined,
      city: has("city") ? str(data.city) : undefined,
      address: has("address") ? str(data.address) : undefined,
      notes: has("notes") ? str(data.notes) : undefined,
      active: has("active") ? Boolean(data.active) : undefined,
      ...(nid !== undefined
        ? {
            nationalIdEnc: maybeEncrypt(nid),
            nationalIdHash: nationalIdHash(nid),
            nationalIdLast4: nid ? normalizeNationalId(nid).slice(-4) : null,
          }
        : {}),
      bankDetailsEnc: has("bankDetails") ? maybeEncrypt(str(data.bankDetails)) : undefined,
    },
  });

  if (data.portalEmail && data.portalPassword) {
    const email = String(data.portalEmail).toLowerCase().trim();
    const passwordHash = await bcrypt.hash(String(data.portalPassword), 12);
    await prisma.invPortalUser.upsert({
      where: { investorId: id },
      create: { investorId: id, email, passwordHash },
      update: { email, passwordHash, active: true },
    });
  }

  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "investor.update",
    entityType: "InvInvestor",
    entityId: id,
  });

  return getInvestor(id);
}

/** Add (or re-activate) a partner on a project, optionally with their opening capital. */
export async function addProjectMember(projectId: string, data: Record<string, unknown>, actor: Actor) {
  const investorId = String(data.investorId || "").trim();
  if (!investorId) throw bad("اختر الشريك");

  const project = await prisma.invProject.findUnique({ where: { id: projectId } });
  if (!project) throw bad("المشروع غير موجود", 404);
  if (["settled", "closed", "cancelled"].includes(project.status)) throw bad("المشروع مغلق");
  const investor = await prisma.invInvestor.findUnique({ where: { id: investorId } });
  if (!investor) throw bad("الشريك غير موجود", 404);

  const isCoordinator = Boolean(data.isCoordinator || data.role === "coordinator");
  const commissionPercent = parsePercentOrNull(data.commissionPercent);

  const membership = await prisma.$transaction(async (tx) => {
    if (isCoordinator) {
      await tx.invMembership.updateMany({ where: { projectId, isCoordinator: true }, data: { isCoordinator: false } });
    }
    return tx.invMembership.upsert({
      where: { projectId_investorId: { projectId, investorId } },
      create: {
        projectId,
        investorId,
        isCoordinator,
        ownershipPercent: data.ownershipPercent != null && data.ownershipPercent !== "" ? String(data.ownershipPercent) : null,
        commissionPercent: commissionPercent ?? null,
        notes: str(data.notes),
        roleLabel: isCoordinator ? "coordinator" : "investor",
        active: true,
      },
      update: {
        isCoordinator,
        commissionPercent: commissionPercent === undefined ? undefined : commissionPercent,
        notes: data.notes !== undefined ? str(data.notes) : undefined,
        active: true,
        leftAt: null,
      },
      include: { investor: true },
    });
  });

  const opening = dstr(data.capital ?? data.initialContribution ?? 0);
  if (Number(opening) > 0) {
    const { createContribution } = await import("./capitalExpenseService");
    await createContribution(
      projectId,
      {
        investorId,
        amount: opening,
        kind: "initial",
        contributedAt: data.contributedAt,
        notes: str(data.capitalNotes) ?? "رأس مال الدخول",
      },
      actor
    );
  }

  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "membership.add",
    entityType: "InvMembership",
    entityId: membership.id,
    newState: { projectId, investorId, isCoordinator, opening },
  });

  return {
    id: membership.id,
    investorId,
    investorName: membership.investor.displayName || membership.investor.legalName,
    role: membership.isCoordinator ? "coordinator" : "investor",
    joinedAt: membership.joinedAt.toISOString(),
  };
}

/** undefined = not provided; null = clear (use project default). */
export function parsePercentOrNull(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw bad("النسبة يجب أن تكون بين 0 و 100");
  return String(n);
}

export async function updateProjectMember(projectId: string, investorId: string, data: Record<string, unknown>, actor: Actor) {
  const m = await prisma.invMembership.findUnique({ where: { projectId_investorId: { projectId, investorId } } });
  if (!m || !m.active) throw bad("الشريك ليس عضواً في المشروع", 404);
  const commissionPercent = parsePercentOrNull(data.commissionPercent);
  await prisma.$transaction(async (tx) => {
    if (data.isCoordinator === true) {
      await tx.invMembership.updateMany({ where: { projectId, isCoordinator: true }, data: { isCoordinator: false } });
    }
    await tx.invMembership.update({
      where: { id: m.id },
      data: {
        isCoordinator: data.isCoordinator != null ? Boolean(data.isCoordinator) : undefined,
        roleLabel: data.isCoordinator != null ? (data.isCoordinator ? "coordinator" : "investor") : undefined,
        commissionPercent,
        notes: data.notes !== undefined ? str(data.notes) : undefined,
      },
    });
  });
  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "membership.update",
    entityType: "InvMembership",
    entityId: m.id,
    previousState: { isCoordinator: m.isCoordinator, commissionPercent: m.commissionPercent?.toString() ?? null },
    newState: { isCoordinator: data.isCoordinator, commissionPercent },
  });
}

export async function removeProjectMember(projectId: string, investorId: string, actor: Actor) {
  const m = await prisma.invMembership.findUnique({ where: { projectId_investorId: { projectId, investorId } } });
  if (!m || !m.active) throw bad("الشريك ليس عضواً في المشروع", 404);
  const [contribs, expenses] = await Promise.all([
    prisma.invContribution.count({ where: { projectId, investorId, approvalStatus: "approved" } }),
    prisma.invExpense.count({ where: { projectId, payerInvestorId: investorId, status: { in: ["pending", "approved"] } } }),
  ]);
  if (contribs || expenses) {
    throw bad("لا يمكن إزالة شريك لديه رأس مال أو مصاريف — اعكس الحركات أولاً");
  }
  await prisma.invMembership.update({
    where: { id: m.id },
    data: { active: false, leftAt: new Date(), isCoordinator: false },
  });
  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "membership.remove",
    entityType: "InvMembership",
    entityId: m.id,
  });
}

// Keep a reference for callers that previously relied on the type.
export type InvestorListRow = ReturnType<typeof serializeListRow>;
