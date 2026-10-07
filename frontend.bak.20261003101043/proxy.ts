import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const GATE_COOKIE = "admin_gate";
const DEVICE_COOKIE = "admin_device";
const DEVICE_MAX_AGE_MS = 10 * 365 * 24 * 60 * 60 * 1000;

/**
 * Hide /admin from directory scanners:
 * - First visit: /admin/login needs ?unlock=<ADMIN_GATE_SECRET>
 * - Unlock (or login) sets a long-lived trusted-device cookie so the
 *   homescreen PWA can reopen /admin/login forever without the unlock key
 * - Session cookie unlocks the signed-in panel
 * - Everyone else gets an indistinguishable 404
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const secret = process.env.ADMIN_GATE_SECRET?.trim() || "";
  const session = request.cookies.get("session")?.value;
  const unlock = request.nextUrl.searchParams.get("unlock");
  const deviceToken = request.cookies.get(DEVICE_COOKIE)?.value;
  const deviceTrusted = secret ? await verifyAdminDeviceToken(deviceToken, secret) : false;
  const isLogin = pathname === "/admin/login" || pathname.startsWith("/admin/login/");
  const unlockOk = Boolean(secret && unlock === secret);
  const secure = request.nextUrl.protocol === "https:";

  // One-time unlock: mint device trust and land on clean /admin/login (no secret in URL).
  if (isLogin && unlockOk) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("unlock");
    const res = NextResponse.redirect(url);
    await attachAdminDeviceCookie(res, secret, secure);
    res.cookies.set(GATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  }

  if (isLogin) {
    if (deviceTrusted || session) {
      const res = NextResponse.next();
      if (secret) await attachAdminDeviceCookie(res, secret, secure);
      res.cookies.set(GATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
      return res;
    }
    return hideAsNotFound(request);
  }

  // Homescreen start_url may be /admin — signed-out trusted devices go to login, not 404.
  if (deviceTrusted && !session && (pathname === "/admin" || pathname === "/admin/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    const res = NextResponse.redirect(url);
    if (secret) await attachAdminDeviceCookie(res, secret, secure);
    res.cookies.set(GATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  }

  // Signed-in admins, or trusted devices (AuthGate will send them to login).
  if (session || deviceTrusted) {
    const res = NextResponse.next();
    if (secret) await attachAdminDeviceCookie(res, secret, secure);
    res.cookies.set(GATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  }

  return hideAsNotFound(request);
}

async function attachAdminDeviceCookie(res: NextResponse, secret: string, secure: boolean) {
  const token = await signAdminDeviceToken(secret);
  res.cookies.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(DEVICE_MAX_AGE_MS / 1000),
  });
}

async function signAdminDeviceToken(secret: string): Promise<string> {
  const iat = Date.now().toString(36);
  const payload = `v1.${iat}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${bufferToBase64Url(mac)}`;
}

function hideAsNotFound(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/admin-panel-not-found";
  url.search = "";
  const res = NextResponse.rewrite(url, { status: 404 });
  res.cookies.set(GATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

async function verifyAdminDeviceToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const [, iat, sig] = parts;
  if (!iat || !sig) return false;
  const issuedAt = parseInt(iat, 36);
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return false;
  if (Date.now() - issuedAt > DEVICE_MAX_AGE_MS) return false;

  const payload = `v1.${iat}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = bufferToBase64Url(mac);
  return timingSafeEqual(sig, expected);
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i)! ^ b.charCodeAt(i)!;
  return out === 0;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
