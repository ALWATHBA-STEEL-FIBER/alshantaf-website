import bcrypt from "bcryptjs";
import { prisma } from "../../prisma";
import { moneyField, dstr } from "../lib/moneyField";
import { ensureDefaultOrganization, resolveProjectPartners } from "./core";
import { serializeProjectSummary } from "./projectService";

export async function adminDashboard() {
  await ensureDefaultOrganization();
  const projects = await prisma.invProject.findMany({ orderBy: { updatedAt: "desc" } });
  const investors = await prisma.invInvestor.count({ where: { active: true } });
  const pendingExpenses = await prisma.invExpense.count({ where: { status: "pending" } });
  const contributions = await prisma.invContribution.findMany({
    where: { approvalStatus: "approved", countsAsEquity: true },
  });
  const totalInvested = contributions.reduce((a, c) => a + Number(dstr(c.amount)), 0);

  const settlements = await prisma.invSettlement.findMany({
    where: { status: { in: ["posted", "paid"] }, hypothetical: false },
    include: { lines: true },
  });
  const realizedProfits = settlements.reduce((a, s) => {
    const profit = s.lines.reduce((x, l) => x + Number(dstr(l.profitShare)), 0);
    return a + profit;
  }, 0);

  const expenses = await prisma.invExpense.findMany({ where: { status: "approved" } });
  const outstandingExpenses = expenses.reduce((a, e) => {
    return a + Math.max(0, Number(dstr(e.reimbursementDue)) - Number(dstr(e.reimbursementPaid)));
  }, 0);

  const recentTx = await prisma.invTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const activeProjects = projects.filter(
    (p) => !["closed", "cancelled", "settled"].includes(p.status)
  ).length;

  return {
    totals: {
      totalInvestedCapital: moneyField(totalInvested.toFixed(3), { currency: "JOD", finalized: true }),
      totalRealizedProfits: moneyField(realizedProfits.toFixed(3), { currency: "JOD", finalized: true }),
      outstandingReimbursements: moneyField(outstandingExpenses.toFixed(3), {
        currency: "JOD",
        finalized: true,
      }),
    },
    counts: {
      activeProjects,
      investors,
      pendingApprovals: pendingExpenses,
      projects: projects.length,
    },
    projects: projects.slice(0, 20).map(serializeProjectSummary),
    recent: recentTx.map((t) => ({
      id: t.id,
      type: t.type,
      amount: moneyField(t.amount, { currency: t.currency, finalized: true }),
      description: t.description,
      date: t.transactionDate.toISOString().slice(0, 10),
      projectId: t.projectId,
    })),
  };
}

export async function portalLogin(email: string, password: string) {
  const user = await prisma.invPortalUser.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { investor: true },
  });
  if (!user || !user.active || !user.investor.active) {
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw Object.assign(new Error("Invalid credentials"), { status: 401 });

  await prisma.invPortalUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.investor.displayName || user.investor.legalName,
    investorId: user.investorId,
  };
}

export async function portalDashboard(investorId: string) {
  const memberships = await prisma.invMembership.findMany({
    where: { investorId, active: true },
    include: { project: true },
  });

  let contributed = 0;
  const contributions = await prisma.invContribution.findMany({
    where: { investorId, approvalStatus: "approved", countsAsEquity: true },
  });
  contributed = contributions.reduce((a, c) => a + Number(dstr(c.amount)), 0);

  return {
    totals: {
      contributedCapital: moneyField(contributed.toFixed(3), { currency: "JOD", finalized: true }),
      activeInvestments: memberships.length,
    },
    projects: memberships.map((m) => serializeProjectSummary(m.project)),
  };
}

export async function portalProjects(investorId: string) {
  const memberships = await prisma.invMembership.findMany({
    where: { investorId, active: true },
    include: { project: true },
  });
  return memberships.map((m) => serializeProjectSummary(m.project));
}

export async function portalProject(investorId: string, projectId: string) {
  const membership = await prisma.invMembership.findUnique({
    where: { projectId_investorId: { projectId, investorId } },
    include: { project: true, investor: true },
  });
  if (!membership || !membership.active) {
    throw Object.assign(new Error("Not authorized for this project"), { status: 403 });
  }

  const partners = await resolveProjectPartners(projectId);
  const me = partners.find((p) => p.investorId === investorId);
  const contributions = await prisma.invContribution.findMany({
    where: { projectId, investorId, approvalStatus: "approved" },
    orderBy: { contributedAt: "desc" },
  });

  // Only own financials — other investors' private amounts omitted
  return {
    project: serializeProjectSummary(membership.project),
    membership: {
      id: membership.id,
      investorId,
      investorName: membership.investor.displayName || membership.investor.legalName,
      ownershipPercent: me?.ownershipPercent ?? null,
      role: membership.isCoordinator ? "coordinator" : "investor",
      joinedAt: membership.joinedAt.toISOString(),
    },
    contributions: contributions.map((c) => ({
      id: c.id,
      investorId,
      amount: moneyField(c.amount, { currency: c.currency, finalized: true }),
      contributedAt: c.contributedAt.toISOString().slice(0, 10),
      status: c.approvalStatus,
      notes: c.description,
    })),
    ownership: me
      ? [{ id: me.partnerId, label: "You / أنت", percent: me.ownershipPercent }]
      : [],
    totals: {
      contributedCapital: moneyField(me?.capitalContributed ?? "0", {
        currency: membership.project.currency,
        finalized: true,
      }),
      outstandingReimbursements: moneyField(me?.expensesOutstanding ?? "0", {
        currency: membership.project.currency,
        finalized: true,
      }),
      estimatedValue: moneyField(membership.project.targetSalePrice, {
        currency: membership.project.currency,
        estimated: true,
        finalized: false,
      }),
    },
  };
}
