import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../lib/asyncHandler";
import { createCaptchaChallenge } from "../lib/captcha";
import { turnstileConfigured } from "../lib/turnstile";

export const captchaRouter = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

captchaRouter.get(
  "/challenge",
  limiter,
  asyncHandler(async (req, res) => {
    const lang = req.query.lang === "en" ? "en" : "ar";
    if (turnstileConfigured()) {
      res.json({
        mode: "turnstile",
        siteKey: process.env.TURNSTILE_SITE_KEY || null,
      });
      return;
    }
    const challenge = createCaptchaChallenge(lang);
    res.json({ mode: "local", ...challenge });
  })
);

captchaRouter.get(
  "/mode",
  asyncHandler(async (_req, res) => {
    res.json({
      mode: turnstileConfigured() ? "turnstile" : "local",
      siteKey: turnstileConfigured() ? process.env.TURNSTILE_SITE_KEY || null : null,
    });
  })
);
