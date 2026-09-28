import type { NextFunction, Request, Response } from "express";
import { verifySession, type SessionPayload } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      session?: SessionPayload;
    }
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.session;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    req.session = verifySession(token);
    next();
  } catch {
    res.status(401).json({ error: "Session expired" });
  }
}
