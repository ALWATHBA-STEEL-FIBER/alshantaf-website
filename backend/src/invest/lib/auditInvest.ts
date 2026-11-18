import { prisma } from "../../prisma";

export async function investAudit(input: {
  organizationId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousState?: unknown;
  newState?: unknown;
  reason?: string | null;
  correlationId?: string | null;
  ip?: string | null;
}) {
  await prisma.invAuditEvent.create({
    data: {
      organizationId: input.organizationId ?? null,
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      previousState: (input.previousState as object) ?? undefined,
      newState: (input.newState as object) ?? undefined,
      reason: input.reason ?? null,
      correlationId: input.correlationId ?? null,
      ip: input.ip ?? null,
    },
  });
}
