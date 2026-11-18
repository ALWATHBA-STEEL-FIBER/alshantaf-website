import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireSiteEngineer } from "../middleware/siteAuth";
import { asyncHandler } from "../lib/asyncHandler";
import { audit } from "../lib/audit";
import { formatDateOnly, parseDateOnly } from "../lib/siteWorkDates";
import { money } from "../lib/siteWorkPayout";
import { validateAndStore, UploadValidationError, LIMITS } from "../lib/uploadSecurity";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  deleteReceiptFiles,
  expenseInclude,
  expenseWhere,
  isCategory,
  isPaymentMethod,
  laborCostByProject,
  parseRangeQuery,
  receiptAbsolutePath,
  receiptsDir,
  serializeExpense,
  summarizeRows,
  type ExpenseScope,
} from "../lib/siteExpenses";

export const siteExpensesRouter = Router();
siteExpensesRouter.use(requireSiteEngineer);

/** Projects this engineer may log expenses against: assigned + coordinated (admin: all active). */
export async function engineerProjects(req: import("express").Request) {
  const me = req.siteEngineer!;
  const projects = await prisma.siteProject.findMany({
    where: me.isAdmin
      ? { active: true }
      : {
          active: true,
          OR: [{ coordinatorId: me.id }, { engineers: { some: { engineerId: me.id } } }],
        },
    select: {
      id: true,
      name: true,
      code: true,
      budget: true,
      coordinatorId: true,
      coordinator: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });
  return projects;
}

function visibilityWhere(req: import("express").Request, projectIds: string[]) {
  const me = req.siteEngineer!;
  if (me.isAdmin) return {};
  return {
    OR: [{ engineerId: me.id }, { scope: "PROJECT", projectId: { in: projectIds } }],
  };
}

siteExpensesRouter.get(
  "/meta",
  asyncHandler(async (req, res) => {
    const projects = await engineerProjects(req);
    res.json({
      categories: EXPENSE_CATEGORIES,
      paymentMethods: PAYMENT_METHODS,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        coordinator: p.coordinator,
        isCoordinator: p.coordinatorId === req.siteEngineer!.id,
      })),
      me: { id: req.siteEngineer!.id, name: req.siteEngineer!.name, isAdmin: req.siteEngineer!.isAdmin },
    });
  })
);

siteExpensesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projects = await engineerProjects(req);
    const ids = projects.map((p) => p.id);
    const scopeRaw = String(req.query.scope || "").toUpperCase();
    const scope = scopeRaw === "PROJECT" || scopeRaw === "COMPANY" ? (scopeRaw as ExpenseScope) : null;
    const projectId = typeof req.query.projectId === "string" && req.query.projectId ? req.query.projectId : null;
    const mine = String(req.query.mine || "") === "1";
    const filter = expenseWhere({
      scope,
      projectId,
      engineerId: mine ? req.siteEngineer!.id : null,
      category: typeof req.query.category === "string" && req.query.category ? req.query.category : null,
      q: typeof req.query.q === "string" ? req.query.q : null,
      range: parseRangeQuery(req.query as Record<string, unknown>, parseDateOnly),
    });
    const rows = await prisma.siteExpense.findMany({
      where: { AND: [filter, visibilityWhere(req, ids)] },
      include: expenseInclude,
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      take: 1000,
    });
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      items: rows.map((r) => serializeExpense(r, req.siteEngineer!.id, req.siteEngineer!.isAdmin)),
      summary: summarizeRows(rows),
    });
  })
);

/** Dashboard numbers for the engineer home: month + all-time, per project incl. labor. */
siteExpensesRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const me = req.siteEngineer!;
    const projects = await engineerProjects(req);
    const ids = projects.map((p) => p.id);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const visible = visibilityWhere(req, ids);
    const all = await prisma.siteExpense.findMany({
      where: visible,
      select: { scope: true, category: true, amount: true, projectId: true, engineerId: true, expenseDate: true },
    });
    const labor = await laborCostByProject(ids, {});

    let monthMine = 0;
    let monthCompanyMine = 0;
    let monthProjects = 0;
    let allCompanyMine = 0;
    const perProject = new Map<string, { month: number; total: number; count: number }>();
    for (const e of all) {
      const a = Number(e.amount) || 0;
      const inMonth = e.expenseDate >= monthStart;
      if (e.engineerId === me.id && inMonth) monthMine += a;
      if (e.scope === "COMPANY" && e.engineerId === me.id) {
        allCompanyMine += a;
        if (inMonth) monthCompanyMine += a;
      }
      if (e.scope === "PROJECT" && e.projectId) {
        const slot = perProject.get(e.projectId) || { month: 0, total: 0, count: 0 };
        slot.total += a;
        slot.count += 1;
        if (inMonth) {
          slot.month += a;
          monthProjects += a;
        }
        perProject.set(e.projectId, slot);
      }
    }

    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      month: formatDateOnly(monthStart).slice(0, 7),
      monthMine: money(monthMine),
      monthCompanyMine: money(monthCompanyMine),
      monthProjects: money(monthProjects),
      allCompanyMine: money(allCompanyMine),
      projects: projects.map((p) => {
        const s = perProject.get(p.id) || { month: 0, total: 0, count: 0 };
        const l = labor.get(p.id) || { total: 0, paid: 0, unpaid: 0 };
        const budget = p.budget != null ? Number(p.budget) : null;
        const grand = s.total + l.total;
        return {
          id: p.id,
          name: p.name,
          code: p.code,
          coordinator: p.coordinator,
          isCoordinator: p.coordinatorId === me.id,
          expensesMonth: money(s.month),
          expensesTotal: money(s.total),
          expenseCount: s.count,
          laborTotal: money(l.total),
          laborUnpaid: money(l.unpaid),
          grandTotal: money(grand),
          budget: budget != null ? money(budget) : null,
          budgetUsedPct: budget && budget > 0 ? Math.round((grand / budget) * 1000) / 10 : null,
        };
      }),
    });
  })
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.document },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|heic|heif|gif)$/.test(file.mimetype) || file.mimetype === "application/pdf";
    if (!ok) {
      cb(new Error("نوع الملف غير مدعوم — صورة أو PDF فقط"));
      return;
    }
    cb(null, true);
  },
});

/** Upload a receipt photo/PDF first; the returned token is then sent with the expense. */
siteExpensesRouter.post(
  "/receipt",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "تعذّر رفع الملف" });
        return;
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "لم يتم اختيار ملف" });
      return;
    }
    const kind = req.file.mimetype === "application/pdf" ? "document" : "image";
    try {
      const stored = await validateAndStore(req.file.buffer, kind, receiptsDir());
      res.status(201).json({ file: stored.filename, mime: stored.mime });
    } catch (err) {
      if (err instanceof UploadValidationError) {
        res.status(400).json({ error: "الملف غير صالح — صورة أو PDF فقط" });
        return;
      }
      throw err;
    }
  })
);

const expenseSchema = z.object({
  scope: z.enum(["PROJECT", "COMPANY"]),
  projectId: z.string().uuid().optional().nullable(),
  category: z.string().min(1).max(40),
  description: z.string().trim().min(1, "الوصف مطلوب").max(500),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر").max(10_000_000),
  expenseDate: z.string(),
  vendor: z.string().trim().max(200).optional().nullable(),
  paymentMethod: z.string().max(20).optional().nullable(),
  invoiceNo: z.string().trim().max(100).optional().nullable(),
  receiptFile: z.string().max(80).optional().nullable(),
  receiptMime: z.string().max(80).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

type ExpenseInput = z.infer<typeof expenseSchema>;

async function validateExpense(
  req: import("express").Request,
  input: ExpenseInput,
  currentReceipt: string | null
): Promise<{ error: string } | { data: Record<string, unknown> }> {
  const expenseDate = parseDateOnly(input.expenseDate);
  if (!expenseDate) return { error: "تاريخ غير صالح" };
  if (!isCategory(input.category)) return { error: "تصنيف غير معروف" };
  if (input.paymentMethod && !isPaymentMethod(input.paymentMethod)) return { error: "طريقة دفع غير معروفة" };

  let projectId: string | null = null;
  if (input.scope === "PROJECT") {
    if (!input.projectId) return { error: "اختر المشروع" };
    const allowed = await engineerProjects(req);
    if (!allowed.some((p) => p.id === input.projectId)) return { error: "المشروع غير مخصص لك" };
    projectId = input.projectId;
  }

  let receiptFile: string | null = null;
  let receiptMime: string | null = null;
  if (input.receiptFile === undefined && currentReceipt) {
    // Field omitted on edit → keep the existing receipt.
    const existing = await prisma.siteExpense.findFirst({
      where: { receiptFile: currentReceipt },
      select: { receiptMime: true },
    });
    receiptFile = currentReceipt;
    receiptMime = existing?.receiptMime ?? null;
  } else if (input.receiptFile) {
    if (input.receiptFile !== currentReceipt) {
      if (!receiptAbsolutePath(input.receiptFile)) return { error: "ملف الإيصال غير موجود — أعد الرفع" };
      const taken = await prisma.siteExpense.findFirst({ where: { receiptFile: input.receiptFile } });
      if (taken) return { error: "ملف الإيصال مستخدم مسبقاً" };
    }
    receiptFile = input.receiptFile;
    receiptMime = input.receiptMime || null;
  }

  return {
    data: {
      scope: input.scope,
      projectId,
      category: input.category,
      description: input.description,
      amount: Math.round(input.amount * 1000) / 1000,
      expenseDate,
      vendor: input.vendor || null,
      paymentMethod: input.paymentMethod || null,
      invoiceNo: input.invoiceNo || null,
      receiptFile,
      receiptMime,
      notes: input.notes || null,
    },
  };
}

siteExpensesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = expenseSchema.parse(req.body);
    const v = await validateExpense(req, input, null);
    if ("error" in v) {
      res.status(400).json({ error: v.error });
      return;
    }
    const created = await prisma.siteExpense.create({
      data: { ...(v.data as object), engineerId: req.siteEngineer!.id } as never,
      include: expenseInclude,
    });
    await audit({
      actorEmail: req.siteEngineer!.email,
      action: "site_expense.create",
      targetType: "site_expense",
      targetId: created.id,
      metadata: { amount: String(created.amount), scope: created.scope, projectId: created.projectId },
      ip: req.ip,
    });
    res.status(201).json(serializeExpense(created, req.siteEngineer!.id, req.siteEngineer!.isAdmin));
  })
);

type Owned =
  | { row: NonNullable<Awaited<ReturnType<typeof prisma.siteExpense.findUnique>>> }
  | { status: number; error: string };

async function loadOwned(req: import("express").Request, id: string): Promise<Owned> {
  const row = await prisma.siteExpense.findUnique({ where: { id } });
  if (!row) return { status: 404 as const, error: "المصروف غير موجود" };
  if (!req.siteEngineer!.isAdmin && row.engineerId !== req.siteEngineer!.id) {
    return { status: 403 as const, error: "يمكنك تعديل مصاريفك فقط" };
  }
  return { row };
}

siteExpensesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const found = await loadOwned(req, req.params.id);
    if ("error" in found) {
      res.status(found.status).json({ error: found.error });
      return;
    }
    const input = expenseSchema.parse(req.body);
    const v = await validateExpense(req, input, found.row.receiptFile);
    if ("error" in v) {
      res.status(400).json({ error: v.error });
      return;
    }
    const updated = await prisma.siteExpense.update({
      where: { id: found.row.id },
      data: v.data as never,
      include: expenseInclude,
    });
    if (found.row.receiptFile && found.row.receiptFile !== updated.receiptFile) {
      deleteReceiptFiles(found.row.receiptFile);
    }
    await audit({
      actorEmail: req.siteEngineer!.email,
      action: "site_expense.update",
      targetType: "site_expense",
      targetId: updated.id,
      metadata: { amount: String(updated.amount) },
      ip: req.ip,
    });
    res.json(serializeExpense(updated, req.siteEngineer!.id, req.siteEngineer!.isAdmin));
  })
);

siteExpensesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const found = await loadOwned(req, req.params.id);
    if ("error" in found) {
      res.status(found.status).json({ error: found.error });
      return;
    }
    await prisma.siteExpense.delete({ where: { id: found.row.id } });
    deleteReceiptFiles(found.row.receiptFile);
    await audit({
      actorEmail: req.siteEngineer!.email,
      action: "site_expense.delete",
      targetType: "site_expense",
      targetId: found.row.id,
      metadata: { amount: String(found.row.amount), description: found.row.description },
      ip: req.ip,
    });
    res.status(204).end();
  })
);

siteExpensesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const row = await prisma.siteExpense.findUnique({ where: { id: req.params.id }, include: expenseInclude });
    if (!row) {
      res.status(404).json({ error: "المصروف غير موجود" });
      return;
    }
    const me = req.siteEngineer!;
    if (!me.isAdmin && row.engineerId !== me.id) {
      const ids = (await engineerProjects(req)).map((p) => p.id);
      if (!(row.scope === "PROJECT" && row.projectId && ids.includes(row.projectId))) {
        res.status(403).json({ error: "غير مسموح" });
        return;
      }
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.json(serializeExpense(row, me.id, me.isAdmin));
  })
);

siteExpensesRouter.get(
  "/:id/receipt",
  asyncHandler(async (req, res) => {
    const row = await prisma.siteExpense.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const me = req.siteEngineer!;
    if (!me.isAdmin && row.engineerId !== me.id) {
      const ids = (await engineerProjects(req)).map((p) => p.id);
      if (!(row.scope === "PROJECT" && row.projectId && ids.includes(row.projectId))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    sendReceipt(res, row.receiptFile, row.receiptMime);
  })
);

export function sendReceipt(
  res: import("express").Response,
  file: string | null,
  mime: string | null
) {
  const abs = receiptAbsolutePath(file);
  if (!abs) {
    res.status(404).json({ error: "لا يوجد إيصال" });
    return;
  }
  res.setHeader("Content-Type", mime || (abs.endsWith(".pdf") ? "application/pdf" : "image/webp"));
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  fs.createReadStream(abs).pipe(res);
}
