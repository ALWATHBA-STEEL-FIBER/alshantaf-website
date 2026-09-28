import { prisma } from "../prisma";

export async function audit(params: {
  actorEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: object;
  ip?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorEmail: params.actorEmail,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata as never,
      ip: params.ip ?? undefined,
    },
  });
}
