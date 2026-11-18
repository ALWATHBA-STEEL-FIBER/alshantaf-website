import crypto from "node:crypto";
import { toWesternDigits } from "./arabicDigits";

type Challenge = {
  answer: number;
  expiresAt: number;
};

const challenges = new Map<string, Challenge>();
const TTL_MS = 10 * 60 * 1000;

function purge() {
  const now = Date.now();
  for (const [id, c] of challenges) {
    if (c.expiresAt <= now) challenges.delete(id);
  }
  if (challenges.size > 20_000) challenges.clear();
}

/** Create a short arithmetic challenge (bots fail; humans pass). */
export function createCaptchaChallenge(lang: "ar" | "en" = "ar") {
  purge();
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 1 + Math.floor(Math.random() * 9);
  const id = crypto.randomUUID();
  challenges.set(id, { answer: a + b, expiresAt: Date.now() + TTL_MS });

  // Always show Western digits (1234) — Arabic-Indic numerals confuse phone keyboards.
  const question =
    lang === "ar" ? `ما ناتج ${a} + ${b}؟` : `What is ${a} + ${b}?`;

  return { id, question, expiresInSec: TTL_MS / 1000 };
}

export function verifyCaptchaAnswer(id: unknown, answer: unknown): boolean {
  purge();
  if (typeof id !== "string" || !id) return false;
  const row = challenges.get(id);
  if (!row) return false;
  challenges.delete(id);

  let n: number | null = null;
  if (typeof answer === "number" && Number.isFinite(answer)) n = answer;
  else if (typeof answer === "string") {
    // Accept Western (123), Arabic-Indic (١٢٣), and Persian (۱۲۳) digits.
    const western = toWesternDigits(answer.trim()).replace(/[^\d.-]/g, "");
    if (western) n = Number(western);
  }
  return n != null && n === row.answer;
}
