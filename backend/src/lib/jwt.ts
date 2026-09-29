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

/** Long-lived admin session (~10 years). */
export function signSession(payload: SessionPayload): string {
  const expiresInSec = Math.floor(ADMIN_SESSION_MAX_AGE_MS / 1000);
  return jwt.sign(payload, SECRET, { expiresIn: expiresInSec });
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, SECRET) as unknown as SessionPayload;
}
