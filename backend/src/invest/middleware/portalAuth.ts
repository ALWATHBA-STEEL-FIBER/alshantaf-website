import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../prisma";
import { INVEST_SESSION_COOKIE, verifyInvestSession } from "../../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      investPortal?: {
        portalUserId: string;
        investorId: string;
        email: string;
        name: string;
      };
    }
  }
}

export async function requireInvestPortal(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[INVEST_SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const payload = verifyInvestSession(token);
    const user = await prisma.invPortalUser.findUnique({
      where: { id: payload.portalUserId },
      include: { investor: true },
    });
    if (!user || !user.active || !user.investor.active) {
      res.status(401).json({ error: "Session expired" });
      return;
    }
    req.investPortal = {
      portalUserId: user.id,
      investorId: user.investorId,
      email: user.email,
      name: user.investor.displayName || user.investor.legalName,
    };
    next();
  } catch {
    res.status(401).json({ error: "Session expired" });
  }
}
