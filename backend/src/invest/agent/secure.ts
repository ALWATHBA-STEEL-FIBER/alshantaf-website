/**
 * Encryption at rest for the admin assistant (chat history, memory notes, project memory files).
 * AES-256-GCM with a key derived from INVEST_AGENT_SECRET (falls back to INVEST_PII_SECRET / JWT_SECRET).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function key(): Buffer {
  const secret =
    process.env.INVEST_AGENT_SECRET || process.env.INVEST_PII_SECRET || process.env.JWT_SECRET || "dev-only-invest-agent-key";
  return createHash("sha256").update(`invest-agent:${secret}`).digest();
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), data]).toString("base64");
}

/** Decrypts sealed text; plain (legacy) text is returned as-is. Tampered data → "". */
export function open(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith(PREFIX)) return value;
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), "base64");
    const d = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return "";
  }
}

/** JSON column helpers: store `{ enc: "<sealed>" }`. */
export function sealJson(v: unknown): { enc: string } | undefined {
  return v == null ? undefined : { enc: seal(JSON.stringify(v)) };
}

export function openJson<T>(v: unknown, fallback: T): T {
  if (v && typeof v === "object" && !Array.isArray(v) && typeof (v as { enc?: unknown }).enc === "string") {
    try {
      return JSON.parse(open((v as { enc: string }).enc)) as T;
    } catch {
      return fallback;
    }
  }
  return (v as T) ?? fallback;
}

export function hashOf(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

/** Binary files (bills, receipts): iv(12) | tag(16) | ciphertext. */
export function sealBuffer(buf: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([Buffer.from("IAE1"), iv, c.getAuthTag(), data]);
}

export function openBuffer(buf: Buffer): Buffer {
  if (buf.subarray(0, 4).toString() !== "IAE1") throw new Error("not an encrypted file");
  const d = createDecipheriv("aes-256-gcm", key(), buf.subarray(4, 16));
  d.setAuthTag(buf.subarray(16, 32));
  return Buffer.concat([d.update(buf.subarray(32)), d.final()]);
}
