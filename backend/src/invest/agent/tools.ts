/**
 * Tools the admin investment assistant can call. Every write goes through the same
 * services the admin UI uses (validation, double-entry journals, audit log).
 * Nothing here deletes data.
 */
import { prisma } from "../../prisma";
import * as projects from "../services/projectService";
import * as investors from "../services/investorService";
import * as capital from "../services/capitalExpenseService";
import { readContract } from "../services/contract";
import { projectBrief } from "./brief";
import { addProjectNote, readIndexFile, readProjectFile, syncKnowledge } from "./knowledge";
import { adminDashboard } from "../services/dashboardPortal";
import type { ToolSpec } from "./llm";
import { seal } from "./secure";

export type Actor = { id?: string; email?: string };
export type ToolAction = { label: string; href?: string };
export type ToolResult = { output: unknown; action?: ToolAction };

const projectHref = (id: string) => `/admin/invest/projects/${id}`;
const investorHref = (id: string) => `/admin/invest/investors/${id}`;

const str = { type: "string" } as const;
const num = { type: ["number", "string"] } as const;
const date = { type: "string", description: "YYYY-MM-DD" } as const;
const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "other"];

function fn(name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ToolSpec {
  return { type: "function", function: { name, description, parameters: { type: "object", properties, required } } };
}

export const TOOL_SPECS: ToolSpec[] = [
  fn("search_investors", "Search partners/investors by name, phone, code (P-0001), national ID or email.", { query: str }, ["query"]),
  fn(
    "create_investor",
    "Create a new partner. Search first to avoid duplicates. If a duplicate error comes back, ask the admin whether it is the same person.",
    { name: str, phone: str, email: str, nationalId: str, city: str, notes: str, force: { type: "boolean", description: "create even if a similar partner exists (only after the admin confirmed it is a different person)" } },
    ["name"]
  ),
  fn("list_projects", "List investment projects, optionally filtered by text.", { query: str }),
  fn("get_project", "Full current picture of one project: partners and their IDs, capital, initial payments, expenses, contract, totals.", { projectId: str }, ["projectId"]),
  fn(
    "create_project",
    "Create an investment project. The admin is added automatically as coordinator (use coordinatorCapital for the admin's own initial payment). Partners must already exist (use their investorId).",
    {
      name: str,
      code: { type: "string", description: "short reference code, optional" },
      description: str,
      city: str,
      area: str,
      landLocation: str,
      plotParcelNo: { type: "string", description: "plot / basin / village text" },
      landAreaSqm: num,
      purchasePrice: num,
      targetSalePrice: num,
      purchaseDate: date,
      expectedSaleDate: date,
      commissionPercent: { type: "number", description: "coordinator cut % on each partner's net profit (0 if none)" },
      coordinatorCapital: { ...num, description: "the admin's own initial payment" },
      partners: {
        type: "array",
        items: {
          type: "object",
          properties: { investorId: str, capital: num, commissionPercent: { type: ["number", "null"] } },
          required: ["investorId"],
        },
      },
      agreementNotes: str,
    },
    ["name"]
  ),
  fn(
    "update_project",
    "Change project fields (only send what changes).",
    {
      projectId: str,
      name: str,
      description: str,
      city: str,
      area: str,
      landLocation: str,
      plotParcelNo: str,
      landAreaSqm: num,
      purchasePrice: num,
      targetSalePrice: num,
      actualSalePrice: num,
      purchaseDate: date,
      expectedSaleDate: date,
      estimatedValue: { ...num, description: "latest market value assumption" },
      estimatedValueDate: date,
      estimatedValueNote: str,
      commissionPercent: { type: "number" },
      agreementNotes: str,
    },
    ["projectId"]
  ),
  fn(
    "update_contract",
    "Set purchase-contract details (merged into what exists). installments replaces the seller payment schedule when sent.",
    {
      projectId: str,
      contractNo: str,
      contractDate: date,
      sellerName: str,
      sellerIdNo: str,
      sellerPhone: str,
      registeredTo: str,
      deedNo: str,
      registryOffice: str,
      village: str,
      basin: str,
      plotNo: str,
      brokerName: str,
      brokerFee: num,
      contractPrice: num,
      downPayment: num,
      downPaymentDate: date,
      paymentTerms: str,
      transferDate: date,
      notes: str,
      installments: {
        type: "array",
        items: {
          type: "object",
          properties: { label: str, amount: num, dueDate: date, paidDate: date, note: str },
          required: ["amount"],
        },
      },
    },
    ["projectId"]
  ),
  fn(
    "add_partner",
    "Add an existing partner to a project with an optional initial payment.",
    { projectId: str, investorId: str, initialPayment: num, paymentDate: date, commissionPercent: { type: ["number", "null"] } },
    ["projectId", "investorId"]
  ),
  fn(
    "set_initial_payment",
    "Set (create/replace) a partner's initial payment in a project. 0 removes it.",
    { projectId: str, investorId: str, amount: num, date: date, paymentMethod: { type: "string", enum: PAYMENT_METHODS }, paymentRef: str },
    ["projectId", "investorId", "amount"]
  ),
  fn(
    "add_payment",
    "Record an extra capital payment (or withdrawal) by a partner.",
    {
      projectId: str,
      investorId: str,
      amount: num,
      kind: { type: "string", enum: ["additional", "capital_call", "adjustment", "withdrawal"] },
      date,
      paymentMethod: { type: "string", enum: PAYMENT_METHODS },
      paymentRef: str,
      notes: str,
    },
    ["projectId", "investorId", "amount"]
  ),
  fn(
    "add_expense",
    "Record a project expense/bill. fundedBy=partner means a partner paid it and is refunded at settlement (payerInvestorId; defaults to the coordinator). splitMode: ownership (default), equal, or custom with splitShares {investorId: percent} summing to 100.",
    {
      projectId: str,
      title: str,
      amount: num,
      category: { type: "string", enum: [...capital.EXPENSE_CATEGORIES] },
      date,
      description: { type: "string", description: "vendor / invoice no. / details" },
      fundedBy: { type: "string", enum: ["partner", "project"] },
      payerInvestorId: str,
      splitMode: { type: "string", enum: ["ownership", "equal", "custom"] },
      splitShares: { type: "object", additionalProperties: { type: "number" } },
      approve: { type: "boolean", description: "approve now so it counts immediately (default true)" },
    },
    ["projectId", "title", "amount"]
  ),
  fn(
    "attach_document",
    "Link a file the admin attached in this chat to a project and optionally to an expense.",
    {
      documentId: str,
      projectId: str,
      expenseId: str,
      kind: {
        type: "string",
        enum: ["expense_invoice", "receipt", "bank_transfer", "land_deed", "purchase_agreement", "sale_agreement", "investor_contract", "legal", "valuation", "property_photo", "statement", "other"],
      },
    },
    ["documentId", "projectId"]
  ),
  fn(
    "set_partner_cut",
    "Set the coordinator's percentage taken from ONE partner's net profit in a project (e.g. 50 means the coordinator takes half of that partner's profit). null = back to the project default. The coordinator does not need to invest to receive it.",
    { projectId: str, investorId: str, percent: { type: ["number", "null"] } },
    ["projectId", "investorId"]
  ),
  fn(
    "simulate_sale",
    "What-if profit split at a sale price (never writes). Shows per partner: capital back, expenses refunded, profit, coordinator cut paid/earned, total payout, ROI.",
    { projectId: str, salePrice: num, closingCosts: num },
    ["projectId"]
  ),
  fn("portfolio_overview", "Totals across all investment projects (capital, expenses, counts, statuses).", {}),
  fn("get_investor", "One partner's profile across all projects (no national ID).", { investorId: str }, ["investorId"]),
  fn(
    "read_memory_file",
    "Read your encrypted memory file: the portfolio index or one project's file, as json or txt. Use for questions across projects or history.",
    { projectId: { type: "string", description: "omit for the all-projects index" }, format: { type: "string", enum: ["json", "txt"] } }
  ),
  fn("note_project", "Add a lasting note to a project's memory file (decisions, agreements, reminders the admin tells you).", { projectId: str, note: str }, ["projectId", "note"]),
  fn("remember", "Save a durable note about how THIS admin works or prefers things (not project data — that lives in the projects).", { note: str }, ["note"]),
  fn("forget", "Delete one of your saved memory notes by id.", { memoryId: str }, ["memoryId"]),
];

function bad(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

function need(a: Record<string, unknown>, k: string) {
  const v = a[k];
  if (v == null || String(v).trim() === "") throw bad(`الحقل ${k} مطلوب`);
  return String(v).trim();
}

/** Only keep keys the caller actually sent (null/"" are dropped so nothing is wiped by accident). */
function pick(a: Record<string, unknown>, keys: string[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (a[k] !== undefined && a[k] !== null && a[k] !== "") out[k] = a[k];
  return out;
}

async function projectName(id: string) {
  return (await prisma.invProject.findUnique({ where: { id }, select: { name: true } }))?.name ?? "المشروع";
}

export async function runTool(
  name: string,
  a: Record<string, unknown>,
  ctx: { actor: Actor; userId: string; conversationId: string }
): Promise<ToolResult> {
  const actor = ctx.actor;
  switch (name) {
    case "search_investors": {
      const rows = await investors.listInvestors({ q: String(a.query ?? ""), limit: 15 });
      return {
        output: rows.map((r) => ({ investorId: r.id, name: r.name, code: r.code, phone: r.phone, city: r.city, nationalIdLast4: r.nationalIdLast4, projects: r.projectCount })),
      };
    }
    case "create_investor": {
      const out = (await investors.createInvestor(
        { ...pick(a, ["name", "phone", "email", "nationalId", "city", "notes"]), force: a.force === true },
        actor
      )) as { id: string; name?: string; code?: string | null };
      return { output: { investorId: out.id, code: out.code, name: out.name ?? a.name }, action: { label: `شريك جديد: ${out.name ?? a.name}`, href: investorHref(out.id) } };
    }
    case "list_projects": {
      const rows = (await projects.listProjects({ q: String(a.query ?? "") })) as Record<string, unknown>[];
      return { output: rows.slice(0, 30).map((r) => ({ projectId: r.id, name: r.name, code: r.code, status: r.status, location: r.location })) };
    }
    case "get_project":
      return { output: await projectBrief(need(a, "projectId")) };
    case "create_project": {
      const partners = Array.isArray(a.partners)
        ? (a.partners as Record<string, unknown>[]).map((p) => ({
            investorId: String(p.investorId ?? ""),
            capital: p.capital ?? 0,
            commissionPercent: p.commissionPercent ?? undefined,
          }))
        : [];
      const data: Record<string, unknown> = {
        ...pick(a, ["name", "code", "description", "city", "area", "landLocation", "plotParcelNo", "landAreaSqm", "purchasePrice", "targetSalePrice", "purchaseDate", "expectedSaleDate", "agreementNotes", "coordinatorCapital"]),
        partners,
        commissionRule: { basis: "investor_net_profit", percent: Number(a.commissionPercent ?? 0) || 0 },
      };
      const out = await projects.createProject(data, actor);
      await prisma.invAgentConversation.update({ where: { id: ctx.conversationId }, data: { projectId: out.id } }).catch(() => undefined);
      return { output: { created: true, projectId: out.id, code: out.code, picture: await projectBrief(out.id) }, action: { label: `تم إنشاء المشروع: ${out.name}`, href: projectHref(out.id) } };
    }
    case "update_project": {
      const id = need(a, "projectId");
      const data = pick(a, [
        "name", "description", "city", "area", "landLocation", "plotParcelNo", "landAreaSqm", "purchasePrice", "targetSalePrice",
        "actualSalePrice", "purchaseDate", "expectedSaleDate", "estimatedValue", "estimatedValueDate", "estimatedValueNote", "agreementNotes",
      ]);
      if (a.commissionPercent != null) data.commissionRule = { basis: "investor_net_profit", percent: Number(a.commissionPercent) || 0 };
      if (!Object.keys(data).length) throw bad("لا توجد حقول للتعديل");
      await projects.updateProject(id, data, actor);
      return { output: { updated: Object.keys(data) }, action: { label: `تعديل بيانات ${await projectName(id)}`, href: projectHref(id) } };
    }
    case "update_contract": {
      const id = need(a, "projectId");
      const row = await prisma.invProject.findUnique({ where: { id }, select: { contractDetails: true, name: true } });
      if (!row) throw bad("المشروع غير موجود");
      const current = (readContract(row.contractDetails) ?? {}) as Record<string, unknown>;
      const patch = pick(a, [
        "contractNo", "contractDate", "sellerName", "sellerIdNo", "sellerPhone", "registeredTo", "deedNo", "registryOffice", "village", "basin",
        "plotNo", "brokerName", "brokerFee", "contractPrice", "downPayment", "downPaymentDate", "paymentTerms", "transferDate", "notes",
      ]);
      const merged: Record<string, unknown> = { ...current, ...patch };
      if (Array.isArray(a.installments)) {
        merged.installments = (a.installments as Record<string, unknown>[]).map((r, i) => ({ id: `a${Date.now().toString(36)}${i}`, ...r }));
      }
      await projects.updateProject(id, { contract: merged }, actor);
      return { output: { saved: true }, action: { label: `تحديث عقد ${row.name}`, href: `${projectHref(id)}?tab=contract` } };
    }
    case "add_partner": {
      const id = need(a, "projectId");
      const out = await investors.addProjectMember(
        id,
        { investorId: need(a, "investorId"), capital: a.initialPayment ?? 0, contributedAt: a.paymentDate, commissionPercent: a.commissionPercent ?? undefined },
        actor
      );
      return { output: out, action: { label: `إضافة ${out.investorName} إلى ${await projectName(id)}`, href: projectHref(id) } };
    }
    case "set_initial_payment": {
      const id = need(a, "projectId");
      const inv = need(a, "investorId");
      await investors.setInitialPayment(
        id,
        inv,
        { amount: a.amount, ...pick({ contributedAt: a.date, paymentMethod: a.paymentMethod, paymentRef: a.paymentRef }, ["contributedAt", "paymentMethod", "paymentRef"]) },
        actor
      );
      return { output: { saved: true }, action: { label: `الدفعة الأولى ${a.amount} في ${await projectName(id)}`, href: projectHref(id) } };
    }
    case "add_payment": {
      const id = need(a, "projectId");
      const out = await capital.createContribution(
        id,
        {
          investorId: need(a, "investorId"),
          amount: a.amount,
          kind: a.kind ?? "additional",
          ...pick({ contributedAt: a.date, paymentMethod: a.paymentMethod, paymentRef: a.paymentRef, notes: a.notes }, ["contributedAt", "paymentMethod", "paymentRef", "notes"]),
        },
        actor
      );
      return { output: out, action: { label: `دفعة ${a.amount} في ${await projectName(id)}`, href: `${projectHref(id)}?tab=capital` } };
    }
    case "add_expense": {
      const id = need(a, "projectId");
      const out = await capital.createExpense(
        id,
        {
          title: a.title,
          amount: a.amount,
          category: a.category,
          expenseDate: a.date,
          description: a.description,
          fundedBy: a.fundedBy ?? "partner",
          payerInvestorId: a.payerInvestorId,
          splitMode: a.splitMode,
          splitShares: a.splitShares,
          approveNow: a.approve !== false,
        },
        actor
      );
      return { output: out, action: { label: `مصروف: ${a.title} (${a.amount})`, href: `${projectHref(id)}?tab=expenses` } };
    }
    case "attach_document": {
      const docId = need(a, "documentId");
      const id = need(a, "projectId");
      const doc = await prisma.invDocument.findUnique({ where: { id: docId } });
      const mine = await prisma.invAgentMessage.findFirst({
        where: { conversationId: ctx.conversationId, attachments: { array_contains: [{ documentId: docId }] } },
        select: { id: true },
      });
      if (!doc || !mine) throw bad("الملف غير موجود في هذه المحادثة");
      if (!(await prisma.invProject.findUnique({ where: { id }, select: { id: true } }))) throw bad("المشروع غير موجود");
      if (a.expenseId) {
        const e = await prisma.invExpense.findUnique({ where: { id: String(a.expenseId) }, select: { projectId: true } });
        if (!e || e.projectId !== id) throw bad("المصروف ليس في هذا المشروع");
      }
      await prisma.invDocument.update({
        where: { id: docId },
        data: {
          projectId: id,
          expenseId: a.expenseId ? String(a.expenseId) : undefined,
          kind: (a.kind as never) ?? (a.expenseId ? "expense_invoice" : doc.kind),
        },
      });
      return { output: { linked: true }, action: { label: `إرفاق ${doc.name}`, href: projectHref(id) } };
    }
    case "set_partner_cut": {
      const id = need(a, "projectId");
      const inv = need(a, "investorId");
      const percent = a.percent === null || a.percent === "" ? null : a.percent;
      await investors.updateProjectMember(id, inv, { commissionPercent: percent }, actor);
      return {
        output: { saved: true, percent },
        action: { label: `حصة المنسق من الشريك: ${percent == null ? "افتراضي المشروع" : `${percent}%`} — ${await projectName(id)}`, href: `${projectHref(id)}?tab=partners` },
      };
    }
    case "simulate_sale": {
      const r = await projects.simulateProject(need(a, "projectId"), {
        ...(a.salePrice != null && a.salePrice !== "" ? { saleProceeds: a.salePrice } : {}),
        ...(a.closingCosts != null && a.closingCosts !== "" ? { closingCosts: a.closingCosts } : {}),
      });
      return { output: r };
    }
    case "portfolio_overview":
      return { output: await adminDashboard() };
    case "get_investor": {
      const r = (await investors.getInvestor(need(a, "investorId"))) as Record<string, unknown>;
      const { nationalId: _n, nationalIdEncrypted: _e, ...rest } = r;
      return { output: rest };
    }
    case "read_memory_file": {
      await syncKnowledge();
      const format = a.format === "json" ? "json" : "txt";
      const content = a.projectId ? readProjectFile(String(a.projectId), format) : readIndexFile(format);
      if (!content) throw bad("الملف غير موجود");
      return { output: content.slice(0, 30000) };
    }
    case "note_project": {
      const id = need(a, "projectId");
      if (!(await prisma.invProject.findUnique({ where: { id }, select: { id: true } }))) throw bad("المشروع غير موجود");
      await addProjectNote(id, need(a, "note"));
      return { output: { saved: true }, action: { label: `ملاحظة في ملف ${await projectName(id)}` } };
    }
    case "remember": {
      const note = need(a, "note").slice(0, 500);
      const count = await prisma.invAgentMemory.count({ where: { userId: ctx.userId } });
      if (count >= 80) throw bad("الذاكرة ممتلئة — احذف ملاحظة قديمة أولاً (forget)");
      const m = await prisma.invAgentMemory.create({ data: { userId: ctx.userId, content: seal(note) } });
      return { output: { memoryId: m.id }, action: { label: `تذكّرت: ${note.slice(0, 80)}` } };
    }
    case "forget": {
      const r = await prisma.invAgentMemory.deleteMany({ where: { id: need(a, "memoryId"), userId: ctx.userId } });
      return { output: { deleted: r.count } };
    }
    default:
      throw bad(`أداة غير معروفة: ${name}`);
  }
}
