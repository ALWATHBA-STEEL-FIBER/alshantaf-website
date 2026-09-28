import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const GATE_COOKIE = "admin_gate";

/**
 * Hide /admin from directory scanners:
 * - /admin/login is reachable ONLY when ?unlock=<ADMIN_GATE_SECRET> is present
 * - Authenticated session unlocks the rest of /admin/*
 * - Everything else rewrites to an indistinguishable 404
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const secret = process.env.ADMIN_GATE_SECRET?.trim() || "";
  const session = request.cookies.get("session")?.value;
  const unlock = request.nextUrl.searchParams.get("unlock");
  const isLogin = pathname === "/admin/login" || pathname.startsWith("/admin/login/");

  // Login: require the unlock key in the URL every time (no sticky gate cookie).
  if (isLogin) {
    if (secret && unlock === secret) {
      const res = NextResponse.next();
      // Drop any legacy gate cookie from older deployments.
      res.cookies.set(GATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
      return res;
    }
    return hideAsNotFound(request);
  }

  // Signed-in admins can use the rest of /admin/*.
  if (session) {
    const res = NextResponse.next();
    res.cookies.set(GATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  }

  return hideAsNotFound(request);
}

function hideAsNotFound(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/admin-panel-not-found";
  url.search = "";
  const res = NextResponse.rewrite(url, { status: 404 });
  // Clear leftover unlock cookie so bare /admin/login stays 404.
  res.cookies.set(GATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
