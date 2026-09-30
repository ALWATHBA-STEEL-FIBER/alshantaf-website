import type { NextFunction, Request, Response } from "express";
import { prisma } from "../prisma";
import { verifySession, type SessionPayload } from "../lib/jwt";
import {
  hasPermission,
  type AdminFeature,
  type AdminPermission,
} from "../lib/adminPermissions";

declare global {
  namespace Express {
    interface Request {
      session?: SessionPayload & {
        name: string;
        permissions: AdminPermission[];
      };
    }
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.session;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const payload = verifySession(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, permissions: true },
    });
    if (!user) {
      res.status(401).json({ error: "Session expired" });
      return;
    }
    const permissions = (user.permissions?.length ? user.permissions : ["*"]) as AdminPermission[];
    req.session = {
      userId: user.id,
      email: user.email,
      name: user.name,
      permissions,
    };
    next();
  } catch {
    res.status(401).json({ error: "Session expired" });
  }
}

/** Require one of the listed features (or full `*` access). */
export function requirePermission(...features: AdminFeature[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const perms = req.session?.permissions;
    if (features.some((f) => hasPermission(perms, f))) {
      next();
      return;
    }
    res.status(403).json({ error: "You do not have permission for this section" });
  };
}
