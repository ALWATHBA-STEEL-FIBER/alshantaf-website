import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import type { OrderBrand } from "@prisma/client";
import { prisma } from "../prisma";
import { verifySession } from "../lib/jwt";
import { hasPermission, type AdminPermission } from "../lib/adminPermissions";

declare global {
  namespace Express {
    interface Request {
      orderBrand?: OrderBrand;
      orderActorEmail?: string;
    }
  }
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Accept either:
 * - Alshantaf admin session with `orders` permission → brand forced to alshantaf
 * - Header `X-Orders-Admin-Key` matching STEELFIBER_ORDERS_ADMIN_KEY → brand steelfiber
 */
export async function requireOrdersAdmin(req: Request, res: Response, next: NextFunction) {
  const steelKey = (process.env.STEELFIBER_ORDERS_ADMIN_KEY || "").trim();
  const provided = String(req.headers["x-orders-admin-key"] || "").trim();

  if (steelKey && provided && safeEqual(provided, steelKey)) {
    req.orderBrand = "steelfiber";
    req.orderActorEmail = "steelfiber-admin@alwathbasteelfiber.com";
    next();
    return;
  }

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
    if (!hasPermission(permissions, "orders")) {
      res.status(403).json({ error: "You do not have permission for this section" });
      return;
    }
    req.session = {
      userId: user.id,
      email: user.email,
      name: user.name,
      permissions,
    };
    req.orderBrand = "alshantaf";
    req.orderActorEmail = user.email;
    next();
  } catch {
    res.status(401).json({ error: "Session expired" });
  }
}
