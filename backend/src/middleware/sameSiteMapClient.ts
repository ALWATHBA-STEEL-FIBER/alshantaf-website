import type { NextFunction, Request, Response } from "express";

const EXTRA_HOSTS = (process.env.DLS_MAP_ALLOWED_HOSTS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function allowedHostsFor(req: Request): Set<string> {
  const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0]?.trim().toLowerCase();
  const set = new Set<string>(EXTRA_HOSTS);
  if (host) {
    set.add(host);
    if (host.startsWith("www.")) set.add(host.slice(4));
    else set.add(`www.${host}`);
  }
  set.add("alshantaf.com");
  set.add("www.alshantaf.com");
  set.add("localhost");
  set.add("127.0.0.1");
  return set;
}

/**
 * Reject cross-site callers for public DLS map helpers (token + proxy).
 * Same-origin browser fetches send Origin/Referer we can check.
 */
export function requireSameSiteMapClient(req: Request, res: Response, next: NextFunction) {
  const allowed = allowedHostsFor(req);
  const origin = req.get("origin");
  if (origin) {
    try {
      const host = new URL(origin).host.toLowerCase();
      if (!allowed.has(host)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      next();
      return;
    } catch {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const referer = req.get("referer");
  if (referer) {
    try {
      const host = new URL(referer).host.toLowerCase();
      if (!allowed.has(host)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      next();
      return;
    } catch {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  // Non-browser / missing headers — allow only when Sec-Fetch-Site is same-origin
  // or absent (server-side health checks). Block clear cross-site.
  const site = (req.get("sec-fetch-site") || "").toLowerCase();
  if (site === "cross-site") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

/** Reject absurd bbox spans that would scrape half the kingdom via our proxy. */
export function assertReasonableBbox(input: {
  layer: string;
  west: number;
  south: number;
  east: number;
  north: number;
}): string | null {
  if (input.east <= input.west || input.north <= input.south) return "Invalid bbox";
  const spanX = input.east - input.west;
  const spanY = input.north - input.south;
  const max =
    input.layer === "governorates" ? 12 : input.layer === "directorates" ? 6 : 3;
  if (spanX > max || spanY > max) return "Map area too large";
  return null;
}
