import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

function keyBytes(): Buffer {
  const secret = process.env.INVEST_PII_SECRET || process.env.JWT_SECRET || "dev-only-invest-pii-key";
  return createHash("sha256").update(secret).digest();
}

/** AES-256-GCM encrypt → `iv:tag:ciphertext` hex. */
export function encryptPii(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptPii(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Invalid encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return dec.toString("utf8");
}

export function maybeEncrypt(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return encryptPii(value);
}

/** Normalize a national ID / passport number for matching (digits + letters, upper-case). */
export function normalizeNationalId(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

/** Deterministic HMAC blind index so national IDs can be searched without decrypting. */
export function nationalIdHash(value: string | null | undefined): string | null {
  if (!value) return null;
  const norm = normalizeNationalId(value);
  if (!norm) return null;
  return createHmac("sha256", keyBytes()).update(`nid:${norm}`).digest("hex");
}

export function safeDecrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    return decryptPii(payload);
  } catch {
    return null;
  }
}
