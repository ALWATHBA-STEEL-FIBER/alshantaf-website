import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma";
import { signSession } from "../lib/jwt";
import { requireAdmin } from "../middleware/auth";
import { audit } from "../lib/audit";
import { asyncHandler } from "../lib/asyncHandler";

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

authRouter.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      await audit({ actorEmail: email, action: "auth.login_failed", ip: req.ip });
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const token = signSession({ userId: user.id, email: user.email });
    // Prefer the actual request scheme (nginx sets X-Forwarded-Proto) so local
    // HTTP docker stacks still receive a usable session cookie.
    const forwardedProto = String(req.get("x-forwarded-proto") || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const secure = forwardedProto === "https" || (!forwardedProto && Boolean(req.secure));
    res.cookie("session", token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 12 * 60 * 60 * 1000,
      path: "/",
    });
    await audit({ actorEmail: user.email, action: "auth.login", ip: req.ip });
    res.json({ id: user.id, email: user.email, name: user.name });
  })
);

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("session", { path: "/" });
  res.status(204).end();
});

authRouter.get("/me", requireAdmin, (req, res) => {
  res.json({ email: req.session!.email });
});
