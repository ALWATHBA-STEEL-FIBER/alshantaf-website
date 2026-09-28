import jwt from "jsonwebtoken";

const SECRET: string =
  process.env.JWT_SECRET ??
  (() => {
    throw new Error("JWT_SECRET must be set");
  })();

export interface SessionPayload {
  userId: string;
  email: string;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "12h" });
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, SECRET) as unknown as SessionPayload;
}
