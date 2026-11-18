import bcrypt from "bcryptjs";
import { prisma } from "../../prisma";
import { investAudit } from "../lib/auditInvest";
import { maybeEncrypt } from "../lib/crypto";
import { moneyField, dstr } from "../lib/moneyField";
import { ensureDefaultOrganization } from "./core";

export async function listInvestors() {
  const org = await ensureDefaultOrganization();
  const rows = await prisma.invInvestor.findMany({
    where: { organizationId: org.id },
    include: {
      memberships: { where: { active: true }, select: { projectId: true } },
      contributions: { where: { approvalStatus: "approved", countsAsEquity: true } },
    },
    orderBy: { legalName: "asc" },
  });

  return rows.map((r) => {
    const totalContributed = r.contributions.reduce((a, c) => a + Number(dstr(c.amount)), 0);
    return {
      id: r.id,
      name: r.displayName || r.legalName,
      email: r.email,
      phone: r.phone,
      nationalId: null, // never expose in list
      notes: r.notes,
      active: r.active,
      createdAt: r.createdAt.toISOString(),
      projectIds: r.memberships.map((m) => m.projectId),
      totals: {
        contributedCapital: moneyField(totalContributed.toFixed(3), { currency: "JOD", finalized: true }),
      },
    };
  });
}

export async function createInvestor(data: Record<string, unknown>, actor: { id?: string; email?: string }) {
  const org = await ensureDefaultOrganization();
  const legalName = String(data.name || data.legalName || "").trim();
  if (!legalName) throw Object.assign(new Error("Name is required"), { status: 400 });

  const investor = await prisma.invInvestor.create({
    data: {
      organizationId: org.id,
      legalName,
      displayName: data.displayName ? String(data.displayName) : legalName,
      email: data.email ? String(data.email).toLowerCase().trim() : null,
      phone: data.phone ? String(data.phone) : null,
      nationalIdEnc: maybeEncrypt(data.nationalId ? String(data.nationalId) : null),
      address: data.address ? String(data.address) : null,
      bankDetailsEnc: data.bankDetails
        ? maybeEncrypt(typeof data.bankDetails === "string" ? data.bankDetails : JSON.stringify(data.bankDetails))
        : null,
      notes: data.notes ? String(data.notes) : null,
    },
  });

  // Optional portal credentials
  if (data.portalEmail && data.portalPassword) {
    const email = String(data.portalEmail).toLowerCase().trim();
    const passwordHash = await bcrypt.hash(String(data.portalPassword), 12);
    await prisma.invPortalUser.create({
      data: { investorId: investor.id, email, passwordHash },
    });
  }

  await investAudit({
    organizationId: org.id,
    actorId: actor.id,
    actorEmail: actor.email,
    action: "investor.create",
    entityType: "InvInvestor",
    entityId: investor.id,
    newState: { legalName, email: investor.email },
  });

  return {
    id: investor.id,
    name: investor.displayName || investor.legalName,
    email: investor.email,
    phone: investor.phone,
    active: investor.active,
    createdAt: investor.createdAt.toISOString(),
  };
}

export async function getInvestor(id: string) {
  const r = await prisma.invInvestor.findUnique({
    where: { id },
    include: {
      memberships: {
        where: { active: true },
        include: { project: true },
      },
      contributions: { where: { approvalStatus: "approved" } },
      expensesPaid: { where: { status: { in: ["approved", "reimbursed"] } } },
      portalUser: { select: { id: true, email: true, active: true, lastLoginAt: true } },
    },
  });
  if (!r) throw Object.assign(new Error("Investor not found"), { status: 404 });

  const contributed = r.contributions
    .filter((c) => c.countsAsEquity)
    .reduce((a, c) => a + Number(dstr(c.amount)), 0);
  const outstanding = r.expensesPaid.reduce((a, e) => {
    const due = Number(dstr(e.reimbursementDue)) - Number(dstr(e.reimbursementPaid));
    return a + Math.max(0, due);
  }, 0);

  return {
    id: r.id,
    name: r.displayName || r.legalName,
    email: r.email,
    phone: r.phone,
    nationalId: null,
    notes: r.notes,
    active: r.active,
    createdAt: r.createdAt.toISOString(),
    projectIds: r.memberships.map((m) => m.projectId),
    projects: r.memberships.map((m) => ({
      id: m.project.id,
      name: m.project.name,
      code: m.project.referenceNo,
      status: m.project.status,
      ownershipPercent: m.ownershipPercent != null ? dstr(m.ownershipPercent) : null,
      role: m.isCoordinator ? "coordinator" : "investor",
    })),
    portal: r.portalUser
      ? { email: r.portalUser.email, active: r.portalUser.active, lastLoginAt: r.portalUser.lastLoginAt }
      : null,
    totals: {
      contributedCapital: moneyField(contributed.toFixed(3), { currency: "JOD", finalized: true }),
      outstandingReimbursements: moneyField(outstanding.toFixed(3), { currency: "JOD", finalized: true }),
    },
  };
}

export async function updateInvestor(id: string, data: Record<string, unknown>, actor: { id?: string; email?: string }) {
  const existing = await prisma.invInvestor.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error("Investor not found"), { status: 404 });

  await prisma.invInvestor.update({
    where: { id },
    data: {
      legalName: data.name != null || data.legalName != null ? String(data.name || data.legalName) : undefined,
      displayName: data.displayName != null ? String(data.displayName) : undefined,
      email: data.email != null ? String(data.email).toLowerCase().trim() : undefined,
      phone: data.phone != null ? String(data.phone) : undefined,
      address: data.address != null ? String(data.address) : undefined,
      notes: data.notes != null ? String(data.notes) : undefined,
      active: data.active != null ? Boolean(data.active) : undefined,
      nationalIdEnc:
        data.nationalId != null ? maybeEncrypt(String(data.nationalId)) ?? undefined : undefined,
      bankDetailsEnc:
        data.bankDetails != null
          ? maybeEncrypt(
              typeof data.bankDetails === "string" ? data.bankDetails : JSON.stringify(data.bankDetails)
            ) ?? undefined
          : undefined,
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

export async function addProjectMember(
  projectId: string,
  data: Record<string, unknown>,
  actor: { id?: string; email?: string }
) {
  const investorId = String(data.investorId || "").trim();
  if (!investorId) throw Object.assign(new Error("investorId is required"), { status: 400 });

  const project = await prisma.invProject.findUnique({ where: { id: projectId } });
  if (!project) throw Object.assign(new Error("Project not found"), { status: 404 });
  const investor = await prisma.invInvestor.findUnique({ where: { id: investorId } });
  if (!investor) throw Object.assign(new Error("Investor not found"), { status: 404 });

  const isCoordinator = Boolean(data.isCoordinator || data.role === "coordinator");
  if (isCoordinator) {
    await prisma.invMembership.updateMany({
      where: { projectId, isCoordinator: true },
      data: { isCoordinator: false },
    });
  }

  const membership = await prisma.invMembership.upsert({
    where: { projectId_investorId: { projectId, investorId } },
    create: {
      projectId,
      investorId,
      isCoordinator,
      ownershipPercent: data.ownershipPercent != null ? String(data.ownershipPercent) : null,
      roleLabel: data.role ? String(data.role) : null,
      active: true,
    },
    update: {
      isCoordinator,
      ownershipPercent: data.ownershipPercent != null ? String(data.ownershipPercent) : undefined,
      roleLabel: data.role ? String(data.role) : undefined,
      active: true,
      leftAt: null,
    },
    include: { investor: true },
  });

  // Optional initial contribution with membership
  if (data.initialContribution != null && Number(data.initialContribution) > 0) {
    await prisma.invContribution.create({
      data: {
        projectId,
        investorId,
        kind: "initial",
        amount: String(data.initialContribution),
        currency: project.currency,
        contributedAt: new Date(),
        countsAsEquity: true,
        approvalStatus: "approved",
        approvedBy: actor.id,
        approvedAt: new Date(),
        createdBy: actor.id,
        description: "Initial contribution on membership",
      },
    });
  }

  await investAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "membership.add",
    entityType: "InvMembership",
    entityId: membership.id,
    newState: { projectId, investorId, isCoordinator },
  });

  return {
    id: membership.id,
    investorId,
    investorName: membership.investor.displayName || membership.investor.legalName,
    ownershipPercent: membership.ownershipPercent != null ? dstr(membership.ownershipPercent) : null,
    role: membership.isCoordinator ? "coordinator" : membership.roleLabel || "investor",
    joinedAt: membership.joinedAt.toISOString(),
  };
}
