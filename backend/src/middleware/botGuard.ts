import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { verifyCaptchaAnswer } from "../lib/captcha";
import { turnstileConfigured, verifyTurnstile } from "../lib/turnstile";

function honeypotFilled(body: Record<string, unknown>) {
  const bait = body.website ?? body.companyUrl ?? body.fax;
  return typeof bait === "string" && bait.trim().length > 0;
}

/**
 * Require bot proof on sensitive public POSTs.
 * - Honeypot must be empty
 * - If Turnstile is configured: require a valid Turnstile token for `action`
 * - Else: require a solved math captcha (id + answer)
 */
export function requireBotGuard(action: string) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (honeypotFilled(body)) {
      res.status(403).json({ error: "Bot check failed" });
      return;
    }

    if (turnstileConfigured()) {
      const token = body.turnstileToken ?? body["cf-turnstile-response"];
      const result = await verifyTurnstile(req, token, action);
      if (!result.ok) {
        res.status(403).json({ error: "Captcha verification failed", code: result.reason });
        return;
      }
      next();
      return;
    }

    const ok = verifyCaptchaAnswer(body.captchaId, body.captchaAnswer);
    if (!ok) {
      res.status(403).json({ error: "Captcha verification failed", code: "captcha_invalid" });
      return;
    }
    next();
  });
}
