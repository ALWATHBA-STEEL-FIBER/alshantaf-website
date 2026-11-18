import { clientIp } from "./siteMonitor";
import type { Request } from "express";

export type TurnstileResult =
  | { ok: true; hostname: string; action: string | null }
  | { ok: false; reason: string };

function expectedHostnames() {
  return new Set(
    (process.env.TURNSTILE_HOSTNAMES || "alshantaf.com,www.alshantaf.com")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function turnstileConfigured() {
  return Boolean(process.env.TURNSTILE_SECRET?.trim());
}

export async function verifyTurnstile(
  req: Request,
  token: unknown,
  expectedAction: string
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET?.trim();
  if (!secret) return { ok: false, reason: "turnstile_not_configured" };

  if (typeof token !== "string" || !token || token.length > 2048) {
    return { ok: false, reason: "missing_token" };
  }

  const hosts = expectedHostnames();
  if (hosts.size === 0) return { ok: false, reason: "hostnames_not_configured" };

  type SiteVerifyBody = {
    success?: boolean;
    action?: string;
    hostname?: string;
    "error-codes"?: string[];
  };
  let result: SiteVerifyBody;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: clientIp(req),
      }),
    });
    if (!r.ok) return { ok: false, reason: `siteverify_${r.status}` };
    result = (await r.json()) as SiteVerifyBody;
  } catch {
    return { ok: false, reason: "siteverify_network" };
  }

  if (!result.success) {
    return { ok: false, reason: (result["error-codes"] || ["failed"]).join(",") };
  }
  if (result.action && result.action !== expectedAction) {
    return { ok: false, reason: "action_mismatch" };
  }
  const hostname = (result.hostname || "").toLowerCase();
  if (!hosts.has(hostname)) {
    return { ok: false, reason: "hostname_mismatch" };
  }
  return { ok: true, hostname, action: result.action ?? null };
}
