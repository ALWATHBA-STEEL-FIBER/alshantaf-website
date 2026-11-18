import type { NextFunction, Request, Response } from "express";
import { prisma } from "../prisma";
import { SITE_SESSION_COOKIE, verifySiteSession } from "../lib/jwt";
import { isAdminSiteEngineer } from "../lib/siteAdminEngineer";

declare global {
  namespace Express {
    interface Request {
      siteEngineer?: {
        id: string;
        email: string;
        name: string;
        isAdmin: boolean;
      };
    }
  }
}

export async function requireSiteEngineer(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SITE_SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const payload = verifySiteSession(token);
    const engineer = await prisma.siteEngineer.findUnique({
      where: { id: payload.engineerId },
      select: { id: true, email: true, name: true, active: true },
    });
    if (!engineer || !engineer.active) {
      res.status(401).json({ error: "Session expired" });
      return;
    }
    const isAdmin = Boolean(payload.isAdmin) || isAdminSiteEngineer(engineer.email);
    req.siteEngineer = {
      id: engineer.id,
      email: engineer.email,
      name: engineer.name,
      isAdmin,
    };
    next();
  } catch {
    res.status(401).json({ error: "Session expired" });
  }
}
