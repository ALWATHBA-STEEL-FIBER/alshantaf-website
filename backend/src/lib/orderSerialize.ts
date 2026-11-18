import { Prisma } from "@prisma/client";

type DecimalLike = Prisma.Decimal | number | string;

function money(v: DecimalLike): string {
  return new Prisma.Decimal(v).toFixed(3);
}

const orderInclude = {
  lines: { orderBy: { sortOrder: "asc" as const } },
  payments: { orderBy: { paidAt: "desc" as const } },
  installments: { orderBy: { sortOrder: "asc" as const } },
  accessTokens: {
    where: { revokedAt: null },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { id: true, tokenPrefix: true, createdAt: true },
  },
} satisfies Prisma.CustomerOrderInclude;

export type OrderWithRelations = Prisma.CustomerOrderGetPayload<{ include: typeof orderInclude }>;

export { orderInclude };

export function serializeOrderAdmin(order: OrderWithRelations, shareUrl?: string | null) {
  const activeToken = order.accessTokens[0] ?? null;
  return {
    id: order.id,
    serialNo: order.serialNo,
    brand: order.brand,
    kind: order.kind,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    title: order.title,
    notes: order.notes,
    currency: order.currency,
    totalAmount: money(order.totalAmount),
    paidAmount: money(order.paidAmount),
    balanceAmount: money(new Prisma.Decimal(order.totalAmount).minus(order.paidAmount)),
    createdByEmail: order.createdByEmail,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    lines: order.lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: money(l.quantity),
      unitAmount: money(l.unitAmount),
      amount: money(l.amount),
      sortOrder: l.sortOrder,
    })),
    payments: order.payments.map((p) => ({
      id: p.id,
      amount: money(p.amount),
      paidAt: p.paidAt.toISOString(),
      method: p.method,
      note: p.note,
      markedBy: p.markedBy,
    })),
    installments: order.installments.map((i) => ({
      id: i.id,
      dueDate: i.dueDate.toISOString().slice(0, 10),
      amount: money(i.amount),
      status: i.status,
      paidAt: i.paidAt?.toISOString() ?? null,
      note: i.note,
      sortOrder: i.sortOrder,
    })),
    tokenPrefix: activeToken?.tokenPrefix ?? null,
    shareUrl: shareUrl ?? null,
  };
}

export function serializeOrderPublic(order: OrderWithRelations) {
  return {
    serialNo: order.serialNo,
    brand: order.brand,
    kind: order.kind,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    title: order.title,
    notes: order.notes,
    currency: order.currency,
    totalAmount: money(order.totalAmount),
    paidAmount: money(order.paidAmount),
    balanceAmount: money(new Prisma.Decimal(order.totalAmount).minus(order.paidAmount)),
    createdAt: order.createdAt.toISOString(),
    lines: order.lines.map((l) => ({
      description: l.description,
      quantity: money(l.quantity),
      unitAmount: money(l.unitAmount),
      amount: money(l.amount),
    })),
    payments: order.payments.map((p) => ({
      amount: money(p.amount),
      paidAt: p.paidAt.toISOString(),
      method: p.method,
      note: p.note,
    })),
    installments: order.installments.map((i) => ({
      dueDate: i.dueDate.toISOString().slice(0, 10),
      amount: money(i.amount),
      status: i.status,
      paidAt: i.paidAt?.toISOString() ?? null,
      note: i.note,
    })),
  };
}

export function sumDecimals(values: DecimalLike[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.plus(v), new Prisma.Decimal(0));
}
