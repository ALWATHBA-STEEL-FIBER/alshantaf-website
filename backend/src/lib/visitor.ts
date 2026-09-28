import crypto from "node:crypto";
import type { Request, Response } from "express";

const VISITOR_COOKIE = "visitor_id";
const isProduction = process.env.NODE_ENV === "production";

/** HttpOnly visitor id used for unique view counting + presence (analytics consent enforced on the client). */
export function getOrSetVisitorId(req: Request, res: Response): string {
  const existing = req.cookies?.[VISITOR_COOKIE];
  if (typeof existing === "string" && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const id = crypto.randomUUID();
  res.cookie(VISITOR_COOKIE, id, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: "/",
  });
  return id;
}
