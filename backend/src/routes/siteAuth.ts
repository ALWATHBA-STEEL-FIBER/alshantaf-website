import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma";
import {
  SITE_SESSION_COOKIE,
  SITE_SESSION_MAX_AGE_MS,
  signSiteSession,
} from "../lib/jwt";
import { requireSiteEngineer } from "../middleware/siteAuth";
import { requireAdmin, requirePermission } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { audit } from "../lib/audit";
import { ADMIN_SITE_EMAIL, ensureAdminSiteEngineer, isAdminSiteEngineer } from "../lib/siteAdminEngineer";

export const siteAuthRouter = Router();

const loginSchema = z.object({
  /** Name or email */
  identifier: z.string().min(1).max(200),
  /** Passcode / password */
  passcode: z.string().min(1).max(200),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

function requestIsSecure(req: { get: (n: string) => string | undefined; secure?: boolean }) {
  const forwardedProto = String(req.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  return forwardedProto === "https" || (!forwardedProto && Boolean(req.secure));
}

function setSiteCookie(
  res: import("express").Response,
  req: import("express").Request,
  engineer: { id: string; email: string }
) {
  const token = signSiteSession({
    engineerId: engineer.id,
    email: engineer.email,
    isAdmin: isAdminSiteEngineer(engineer.email),
  });
  res.cookie(SITE_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: requestIsSecure(req),
    sameSite: "lax",
    maxAge: SITE_SESSION_MAX_AGE_MS,
    path: "/",
  });
}

siteAuthRouter.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    // Accept legacy { email, password } as well as { identifier, passcode }
    const raw = req.body ?? {};
    const identifier = String(raw.identifier || raw.email || raw.name || "").trim();
    const passcode = String(raw.passcode || raw.password || "");
    const parsed = loginSchema.safeParse({ identifier, passcode });
    if (!parsed.success) {
      res.status(400).json({ error: "الاسم أو البريد ورمز الدخول مطلوبان" });
      return;
    }

    const idLower = parsed.data.identifier.toLowerCase();
    const engineer = await prisma.siteEngineer.findFirst({
      where: {
        active: true,
        OR: [
          { email: { equals: idLower, mode: "insensitive" } },
          { name: { equals: parsed.data.identifier, mode: "insensitive" } },
        ],
      },
    });

    // Block direct password login to the admin-site system account
    if (engineer && isAdminSiteEngineer(engineer.email)) {
      res.status(401).json({ error: "استخدم دخول الإدارة من لوحة التحكم" });
      return;
    }

    if (!engineer || !(await bcrypt.compare(parsed.data.passcode, engineer.passwordHash))) {
      await audit({
        actorEmail: parsed.data.identifier,
        action: "site_auth.login_failed",
        ip: req.ip,
      });
      res.status(401).json({ error: "اسم أو رمز دخول غير صحيح" });
      return;
    }

    setSiteCookie(res, req, engineer);
    await audit({
      actorEmail: engineer.email,
      action: "site_auth.login",
      targetType: "site_engineer",
      targetId: engineer.id,
      ip: req.ip,
    });
    res.json({
      id: engineer.id,
      email: engineer.email,
      name: engineer.name,
      isAdmin: false,
    });
  })
);

/** Admin with siteWork permission opens the field portal with access to every project. */
siteAuthRouter.post(
  "/admin-enter",
  requireAdmin,
  requirePermission("siteWork"),
  asyncHandler(async (req, res) => {
    const eng = await ensureAdminSiteEngineer();
    setSiteCookie(res, req, eng);
    await audit({
      actorEmail: req.session!.email,
      action: "site_auth.admin_enter",
      targetType: "site_engineer",
      targetId: eng.id,
      ip: req.ip,
    });
    res.json({
      id: eng.id,
      email: eng.email,
      name: eng.name,
      isAdmin: true,
      portalUrl: "/site",
    });
  })
);

siteAuthRouter.post("/logout", (_req, res) => {
  res.clearCookie(SITE_SESSION_COOKIE, { path: "/" });
  res.status(204).end();
});

siteAuthRouter.get(
  "/me",
  requireSiteEngineer,
  (req, res) => {
    res.json({
      id: req.siteEngineer!.id,
      email: req.siteEngineer!.email,
      name: req.siteEngineer!.name,
      isAdmin: Boolean(req.siteEngineer!.isAdmin),
    });
  }
);

export { ADMIN_SITE_EMAIL };
