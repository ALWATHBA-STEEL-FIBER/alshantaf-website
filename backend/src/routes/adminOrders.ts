import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { audit } from "../lib/audit";
import { requireOrdersAdmin } from "../middleware/ordersAuth";
import { mintOrderAccessToken, nextOrderSerial, rotateOrderAccessToken } from "../lib/orderAccess";
import { shareUrlForOrder } from "../lib/orderBrand";
import { orderInclude, serializeOrderAdmin, sumDecimals } from "../lib/orderSerialize";

export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireOrdersAdmin);

const moneySchema = z.union([z.number(), z.string()]).transform((v) => new Prisma.Decimal(v));

const lineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: moneySchema.optional(),
  unitAmount: moneySchema.optional(),
  amount: moneySchema.optional(),
});

const installmentSchema = z.object({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: moneySchema,
  note: z.string().max(500).optional().nullable(),
});

const createSchema = z.object({
  kind: z.enum(["payments", "installments", "one_time", "service"]),
  customerName: z.string().trim().min(1).max(200),
  customerPhone: z.string().trim().max(40).optional().nullable(),
  title: z.string().trim().min(1).max(300),
  notes: z.string().max(4000).optional().nullable(),
  currency: z.string().trim().max(8).optional(),
  lines: z.array(lineSchema).max(100).optional(),
  installments: z.array(installmentSchema).max(120).optional(),
  /** Optional initial payment when creating a payments / one_time / service order */
  initialPayment: z
    .object({
      amount: moneySchema,
      method: z.string().max(80).optional().nullable(),
      note: z.string().max(500).optional().nullable(),
      paidAt: z.string().datetime().optional(),
    })
    .optional(),
});

function computeLineAmount(line: z.infer<typeof lineSchema>): Prisma.Decimal {
  if (line.amount !== undefined) return new Prisma.Decimal(line.amount);
  const qty = new Prisma.Decimal(line.quantity ?? 1);
  const unit = new Prisma.Decimal(line.unitAmount ?? 0);
  return qty.mul(unit);
}

adminOrdersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const brand = req.orderBrand!;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const rows = await prisma.customerOrder.findMany({
      where: {
        brand,
        ...(status && ["open", "closed", "void"].includes(status)
          ? { status: status as "open" | "closed" | "void" }
          : {}),
        ...(kind && ["payments", "installments", "one_time", "service"].includes(kind)
          ? { kind: kind as "payments" | "installments" | "one_time" | "service" }
          : {}),
        ...(q
          ? {
              OR: [
                { serialNo: { contains: q, mode: "insensitive" } },
                { customerName: { contains: q, mode: "insensitive" } },
                { customerPhone: { contains: q, mode: "insensitive" } },
                { title: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    res.json(rows.map((o) => serializeOrderAdmin(o)));
  })
);

adminOrdersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = await prisma.customerOrder.findFirst({
      where: { id: req.params.id, brand: req.orderBrand! },
      include: orderInclude,
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(serializeOrderAdmin(order));
  })
);

adminOrdersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const brand = req.orderBrand!;
    const actor = req.orderActorEmail!;

    if (input.kind === "installments") {
      if (!input.installments?.length) {
        res.status(400).json({ error: "Installment schedule is required" });
        return;
      }
    } else if (!input.lines?.length && !input.initialPayment) {
      res.status(400).json({ error: "Add at least one line item or an initial payment" });
      return;
    }

    const linesData =
      input.lines?.map((l, i) => {
        const amount = computeLineAmount(l);
        const quantity = new Prisma.Decimal(l.quantity ?? 1);
        const unitAmount =
          l.unitAmount !== undefined
            ? new Prisma.Decimal(l.unitAmount)
            : quantity.eq(0)
              ? new Prisma.Decimal(0)
              : amount.div(quantity);
        return {
          description: l.description,
          quantity,
          unitAmount,
          amount,
          sortOrder: i,
        };
      }) ?? [];

    const installmentsData =
      input.installments?.map((inst, i) => ({
        dueDate: new Date(inst.dueDate + "T00:00:00.000Z"),
        amount: new Prisma.Decimal(inst.amount),
        note: inst.note ?? null,
        sortOrder: i,
      })) ?? [];

    let totalAmount =
      input.kind === "installments"
        ? sumDecimals(installmentsData.map((i) => i.amount))
        : sumDecimals(linesData.map((l) => l.amount));

    if (input.kind !== "installments" && linesData.length === 0 && input.initialPayment) {
      totalAmount = new Prisma.Decimal(input.initialPayment.amount);
    }

    const paidAmount = input.initialPayment
      ? new Prisma.Decimal(input.initialPayment.amount)
      : new Prisma.Decimal(0);

    const serialNo = await nextOrderSerial(prisma, brand);

    const order = await prisma.customerOrder.create({
      data: {
        serialNo,
        brand,
        kind: input.kind,
        customerName: input.customerName,
        customerPhone: input.customerPhone || null,
        title: input.title,
        notes: input.notes || null,
        currency: input.currency || "JOD",
        totalAmount,
        paidAmount,
        createdByEmail: actor,
        lines: linesData.length ? { create: linesData } : undefined,
        installments: installmentsData.length ? { create: installmentsData } : undefined,
        payments: input.initialPayment
          ? {
              create: {
                amount: new Prisma.Decimal(input.initialPayment.amount),
                method: input.initialPayment.method || null,
                note: input.initialPayment.note || null,
                paidAt: input.initialPayment.paidAt
                  ? new Date(input.initialPayment.paidAt)
                  : new Date(),
                markedBy: actor,
              },
            }
          : undefined,
      },
      include: orderInclude,
    });

    const { raw } = await mintOrderAccessToken(prisma, order.id);
    const shareUrl = shareUrlForOrder(brand, raw);

    const full = await prisma.customerOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude,
    });

    await audit({
      actorEmail: actor,
      action: "order.create",
      targetType: "order",
      targetId: order.id,
      metadata: { serialNo, brand, kind: input.kind },
      ip: req.ip,
    });

    res.status(201).json({
      order: serializeOrderAdmin(full, shareUrl),
      shareUrl,
      token: raw,
    });
  })
);

const patchSchema = z.object({
  status: z.enum(["open", "closed", "void"]).optional(),
  title: z.string().trim().min(1).max(300).optional(),
  notes: z.string().max(4000).optional().nullable(),
  customerName: z.string().trim().min(1).max(200).optional(),
  customerPhone: z.string().trim().max(40).optional().nullable(),
});

adminOrdersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = patchSchema.parse(req.body);
    const existing = await prisma.customerOrder.findFirst({
      where: { id: req.params.id, brand: req.orderBrand! },
    });
    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (existing.status === "void" && input.status && input.status !== "void") {
      res.status(400).json({ error: "Voided orders cannot be reopened" });
      return;
    }

    const updated = await prisma.customerOrder.update({
      where: { id: existing.id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.customerName !== undefined ? { customerName: input.customerName } : {}),
        ...(input.customerPhone !== undefined ? { customerPhone: input.customerPhone } : {}),
      },
      include: orderInclude,
    });

    await audit({
      actorEmail: req.orderActorEmail!,
      action: "order.update",
      targetType: "order",
      targetId: updated.id,
      metadata: { serialNo: updated.serialNo, status: updated.status },
      ip: req.ip,
    });

    res.json(serializeOrderAdmin(updated));
  })
);

const paymentSchema = z.object({
  amount: moneySchema,
  method: z.string().max(80).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  paidAt: z.string().datetime().optional(),
});

adminOrdersRouter.post(
  "/:id/payments",
  asyncHandler(async (req, res) => {
    const input = paymentSchema.parse(req.body);
    const existing = await prisma.customerOrder.findFirst({
      where: { id: req.params.id, brand: req.orderBrand! },
    });
    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (existing.status === "void") {
      res.status(400).json({ error: "Cannot add payments to a voided order" });
      return;
    }

    const amount = new Prisma.Decimal(input.amount);
    await prisma.orderPayment.create({
      data: {
        orderId: existing.id,
        amount,
        method: input.method || null,
        note: input.note || null,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        markedBy: req.orderActorEmail!,
      },
    });

    const payments = await prisma.orderPayment.findMany({ where: { orderId: existing.id } });
    const paidAmount = sumDecimals(payments.map((p) => p.amount));
    let totalAmount = existing.totalAmount;
    if (new Prisma.Decimal(existing.totalAmount).lte(0) && existing.kind === "payments") {
      totalAmount = paidAmount;
    }
    const status =
      paidAmount.gte(totalAmount) && new Prisma.Decimal(totalAmount).gt(0) ? "closed" : "open";

    const updated = await prisma.customerOrder.update({
      where: { id: existing.id },
      data: { paidAmount, totalAmount, status },
      include: orderInclude,
    });

    await audit({
      actorEmail: req.orderActorEmail!,
      action: "order.payment",
      targetType: "order",
      targetId: updated.id,
      metadata: { serialNo: updated.serialNo, amount: amount.toFixed(3) },
      ip: req.ip,
    });

    res.status(201).json(serializeOrderAdmin(updated));
  })
);

adminOrdersRouter.post(
  "/:id/installments/:installmentId/pay",
  asyncHandler(async (req, res) => {
    const existing = await prisma.customerOrder.findFirst({
      where: { id: req.params.id, brand: req.orderBrand! },
      include: { installments: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const inst = existing.installments.find((i) => i.id === req.params.installmentId);
    if (!inst) {
      res.status(404).json({ error: "Installment not found" });
      return;
    }
    if (inst.status === "paid") {
      res.status(400).json({ error: "Installment already paid" });
      return;
    }

    await prisma.orderInstallment.update({
      where: { id: inst.id },
      data: { status: "paid", paidAt: new Date() },
    });

    await prisma.orderPayment.create({
      data: {
        orderId: existing.id,
        amount: inst.amount,
        method: "installment",
        note: `قسط — ${inst.dueDate.toISOString().slice(0, 10)}`,
        markedBy: req.orderActorEmail!,
      },
    });

    const payments = await prisma.orderPayment.findMany({ where: { orderId: existing.id } });
    const paidAmount = sumDecimals(payments.map((p) => p.amount));
    const remaining = await prisma.orderInstallment.count({
      where: { orderId: existing.id, status: "due" },
    });
    const status = remaining === 0 ? "closed" : "open";

    const updated = await prisma.customerOrder.update({
      where: { id: existing.id },
      data: { paidAmount, status },
      include: orderInclude,
    });

    await audit({
      actorEmail: req.orderActorEmail!,
      action: "order.installment_pay",
      targetType: "order",
      targetId: updated.id,
      metadata: { serialNo: updated.serialNo, installmentId: inst.id },
      ip: req.ip,
    });

    res.json(serializeOrderAdmin(updated));
  })
);

adminOrdersRouter.post(
  "/:id/rotate-token",
  asyncHandler(async (req, res) => {
    const existing = await prisma.customerOrder.findFirst({
      where: { id: req.params.id, brand: req.orderBrand! },
    });
    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const { raw } = await rotateOrderAccessToken(prisma, existing.id);
    const shareUrl = shareUrlForOrder(existing.brand, raw);
    const full = await prisma.customerOrder.findUniqueOrThrow({
      where: { id: existing.id },
      include: orderInclude,
    });

    await audit({
      actorEmail: req.orderActorEmail!,
      action: "order.rotate_token",
      targetType: "order",
      targetId: existing.id,
      metadata: { serialNo: existing.serialNo },
      ip: req.ip,
    });

    res.json({
      order: serializeOrderAdmin(full, shareUrl),
      shareUrl,
      token: raw,
    });
  })
);
