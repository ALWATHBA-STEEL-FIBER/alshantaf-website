import crypto from "crypto";

export const ADMIN_DEVICE_COOKIE = "admin_device";
/** ~10 years — “infinite” for practical admin devices. */
export const ADMIN_DEVICE_MAX_AGE_MS = 10 * 365 * 24 * 60 * 60 * 1000;
export const ADMIN_SESSION_MAX_AGE_MS = ADMIN_DEVICE_MAX_AGE_MS;

function deviceSecret(): string {
  const secret = process.env.ADMIN_GATE_SECRET?.trim() || process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("ADMIN_GATE_SECRET or JWT_SECRET must be set for device trust");
  return secret;
}

/** Signed trust token proving this browser completed unlock + login once. */
export function signAdminDeviceToken(): string {
  const iat = Date.now().toString(36);
  const payload = `v1.${iat}`;
  const sig = crypto.createHmac("sha256", deviceSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAdminDeviceToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const [v, iat, sig] = parts;
  if (!iat || !sig) return false;
  const issuedAt = parseInt(iat, 36);
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return false;
  if (Date.now() - issuedAt > ADMIN_DEVICE_MAX_AGE_MS) return false;
  const payload = `${v}.${iat}`;
  const expected = crypto.createHmac("sha256", deviceSecret()).update(payload).digest("base64url");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function adminDeviceCookieOptions(secure: boolean) {
  return {
    httpOnly: true as const,
    secure,
    sameSite: "lax" as const,
    maxAge: ADMIN_DEVICE_MAX_AGE_MS,
    path: "/",
  };
}
