/**
 * Seeds the demo land partnership from the product spec.
 * Does NOT create admin credentials — uses existing admin User if present.
 *
 * Run: npm run seed:invest-demo
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ensureDefaultOrganization } from "../services/core";

const prisma = new PrismaClient();

async function main() {
  const org = await ensureDefaultOrganization();

  // Idempotent demo project
  const ref = "DEMO-LAND-960K";
  const existing = await prisma.invProject.findUnique({
    where: { organizationId_referenceNo: { organizationId: org.id, referenceNo: ref } },
  });
  if (existing) {
    console.log("Demo project already exists:", existing.id);
    return;
  }

  const project = await prisma.invProject.create({
    data: {
      organizationId: org.id,
      name: "Demo Land Partnership — أمثلة التسوية",
      referenceNo: ref,
      description:
        "Demonstration project: land 500,000; sale 960,000; coordinator expense 100,000 (not ownership).",
      country: "JO",
      city: "Amman",
      area: "Demo",
      purchasePrice: "500000",
      targetSalePrice: "960000",
      actualSalePrice: "960000",
      currency: "JOD",
      currencyScale: 3,
      status: "sold",
      commissionRule: { basis: "distributable_profit", percent: 0 },
      coordinatorParticipatesInProfit: true,
    },
  });

  const mkInvestor = async (legalName: string, email: string, portalPass: string) => {
    const inv = await prisma.invInvestor.create({
      data: {
        organizationId: org.id,
        legalName,
        displayName: legalName,
        email,
        verificationStatus: "verified",
      },
    });
    await prisma.invPortalUser.create({
      data: {
        investorId: inv.id,
        email,
        passwordHash: await bcrypt.hash(portalPass, 12),
      },
    });
    return inv;
  };

  const coordinator = await mkInvestor("Coordinator (Demo)", "coordinator.demo@alshantaf.local", "DemoPortal!23");
  const investorA = await mkInvestor("Investor A (Demo)", "investor.a@alshantaf.local", "DemoPortal!23");
  const investorB = await mkInvestor("Investor B (Demo)", "investor.b@alshantaf.local", "DemoPortal!23");

  await prisma.invMembership.createMany({
    data: [
      {
        projectId: project.id,
        investorId: coordinator.id,
        isCoordinator: true,
        ownershipPercent: "20",
      },
      {
        projectId: project.id,
        investorId: investorA.id,
        isCoordinator: false,
        ownershipPercent: "40",
      },
      {
        projectId: project.id,
        investorId: investorB.id,
        isCoordinator: false,
        ownershipPercent: "40",
      },
    ],
  });

  const today = new Date();
  await prisma.invContribution.createMany({
    data: [
      {
        projectId: project.id,
        investorId: coordinator.id,
        kind: "initial",
        amount: "100000",
        currency: "JOD",
        contributedAt: today,
        countsAsEquity: true,
        approvalStatus: "approved",
        description: "Initial capital",
      },
      {
        projectId: project.id,
        investorId: investorA.id,
        kind: "initial",
        amount: "200000",
        currency: "JOD",
        contributedAt: today,
        countsAsEquity: true,
        approvalStatus: "approved",
        description: "Initial capital",
      },
      {
        projectId: project.id,
        investorId: investorB.id,
        kind: "initial",
        amount: "200000",
        currency: "JOD",
        contributedAt: today,
        countsAsEquity: true,
        approvalStatus: "approved",
        description: "Initial capital",
      },
    ],
  });

  await prisma.invExpense.create({
    data: {
      projectId: project.id,
      title: "Additional project expenses (coordinator-paid)",
      category: "acquisition",
      amount: "100000",
      currency: "JOD",
      expenseDate: today,
      status: "approved",
      reimbursementDue: "100000",
      reimbursementPaid: "0",
      paidByCoordinator: true,
      payerInvestorId: coordinator.id,
      approvedAt: today,
      description: "Does NOT increase ownership percentage",
    },
  });

  console.log(
    JSON.stringify(
      {
        projectId: project.id,
        referenceNo: ref,
        portalLogins: [
          { email: "coordinator.demo@alshantaf.local", password: "DemoPortal!23" },
          { email: "investor.a@alshantaf.local", password: "DemoPortal!23" },
          { email: "investor.b@alshantaf.local", password: "DemoPortal!23" },
        ],
        note: "Demo portal passwords are for local/demo only — change before production.",
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
