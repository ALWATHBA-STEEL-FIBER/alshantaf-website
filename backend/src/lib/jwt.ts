import jwt from "jsonwebtoken";
import { ADMIN_SESSION_MAX_AGE_MS } from "./adminDevice";

const SECRET: string =
  process.env.JWT_SECRET ??
  (() => {
    throw new Error("JWT_SECRET must be set");
  })();

export interface SessionPayload {
  userId: string;
  email: string;
}

export interface SiteSessionPayload {
  engineerId: string;
  email: string;
  kind: "site";
  /** When true, portal sees every active project (admin enter). */
  isAdmin?: boolean;
}

/** Long-lived admin session (~10 years). */
export function signSession(payload: SessionPayload): string {
  const expiresInSec = Math.floor(ADMIN_SESSION_MAX_AGE_MS / 1000);
  return jwt.sign(payload, SECRET, { expiresIn: expiresInSec });
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, SECRET) as unknown as SessionPayload;
}

/** Site engineer session (~1 year). */
export const SITE_SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
export const SITE_SESSION_COOKIE = "site_session";

export function signSiteSession(payload: Omit<SiteSessionPayload, "kind">): string {
  const expiresInSec = Math.floor(SITE_SESSION_MAX_AGE_MS / 1000);
  return jwt.sign(
    { ...payload, kind: "site", isAdmin: Boolean(payload.isAdmin) } satisfies SiteSessionPayload,
    SECRET,
    { expiresIn: expiresInSec }
  );
}

export function verifySiteSession(token: string): SiteSessionPayload {
  const payload = jwt.verify(token, SECRET) as unknown as SiteSessionPayload;
  if (payload.kind !== "site" || !payload.engineerId) {
    throw new Error("Invalid site session");
  }
  return payload;
}

/** Investor portal session (~1 year). */
export const INVEST_SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
export const INVEST_SESSION_COOKIE = "invest_session";

export interface InvestSessionPayload {
  portalUserId: string;
  investorId: string;
  email: string;
  kind: "invest";
}

export function signInvestSession(payload: Omit<InvestSessionPayload, "kind">): string {
  const expiresInSec = Math.floor(INVEST_SESSION_MAX_AGE_MS / 1000);
  return jwt.sign({ ...payload, kind: "invest" } satisfies InvestSessionPayload, SECRET, {
    expiresIn: expiresInSec,
  });
}

export function verifyInvestSession(token: string): InvestSessionPayload {
  const payload = jwt.verify(token, SECRET) as unknown as InvestSessionPayload;
  if (payload.kind !== "invest" || !payload.investorId || !payload.portalUserId) {
    throw new Error("Invalid invest session");
  }
  return payload;
}
