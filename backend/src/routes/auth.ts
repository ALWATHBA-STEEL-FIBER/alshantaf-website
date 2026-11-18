import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma";
import { signSession } from "../lib/jwt";
import {
  ADMIN_DEVICE_COOKIE,
  ADMIN_SESSION_MAX_AGE_MS,
  adminDeviceCookieOptions,
  signAdminDeviceToken,
} from "../lib/adminDevice";
import { requireAdmin } from "../middleware/auth";
import { audit } from "../lib/audit";
import { asyncHandler } from "../lib/asyncHandler";
import { requireBotGuard } from "../middleware/botGuard";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
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

authRouter.post(
  "/login",
  loginLimiter,
  requireBotGuard("login"),
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      await audit({ actorEmail: email, action: "auth.login_failed", ip: req.ip });
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const token = signSession({ userId: user.id, email: user.email });
    const secure = requestIsSecure(req);
    res.cookie("session", token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: ADMIN_SESSION_MAX_AGE_MS,
      path: "/",
    });
    // Trust this browser after a successful unlock+login so future visits
    // can open /admin/login without the unlock query param.
    res.cookie(ADMIN_DEVICE_COOKIE, signAdminDeviceToken(), adminDeviceCookieOptions(secure));
    await audit({ actorEmail: user.email, action: "auth.login", ip: req.ip });
    res.json({ id: user.id, email: user.email, name: user.name });
  })
);

authRouter.post("/logout", (_req, res) => {
  // Keep admin_device so this trusted device can reach login again without unlock.
  res.clearCookie("session", { path: "/" });
  res.status(204).end();
});

authRouter.get("/me", requireAdmin, (req, res) => {
  res.json({
    id: req.session!.userId,
    email: req.session!.email,
    name: req.session!.name,
    permissions: req.session!.permissions,
  });
});
