/**
 * SMS sender — supports Twilio or a generic HTTP JSON API.
 * If credentials are missing, sends are skipped (same pattern as mailer).
 *
 * Twilio:
 *   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM
 * Generic gateway (POST JSON { to, message, from? }):
 *   SMS_API_URL / SMS_API_KEY / SMS_SENDER
 */

let warnedMissingConfig = false;

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0") && digits.length >= 9) return `+962${digits.slice(1)}`;
  if (digits.startsWith("962")) return `+${digits}`;
  return digits;
}

async function sendViaTwilio(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM?.trim();
  if (!sid || !token || !from) return false;

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[sms] Twilio failed:", res.status, text.slice(0, 300));
    return false;
  }
  return true;
}

async function sendViaHttpApi(to: string, body: string): Promise<boolean> {
  const url = process.env.SMS_API_URL?.trim();
  const key = process.env.SMS_API_KEY?.trim();
  if (!url || !key) return false;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Api-Key": key,
    },
    body: JSON.stringify({
      to,
      message: body,
      text: body,
      from: process.env.SMS_SENDER || "Alshantaf",
      sender: process.env.SMS_SENDER || "Alshantaf",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[sms] HTTP API failed:", res.status, text.slice(0, 300));
    return false;
  }
  return true;
}

export async function sendSms(toRaw: string, message: string): Promise<boolean> {
  const to = normalizePhone(toRaw);
  if (!to || message.trim().length === 0) return false;

  try {
    if (await sendViaTwilio(to, message)) return true;
    if (await sendViaHttpApi(to, message)) return true;
  } catch (err) {
    console.error("[sms] send failed:", err instanceof Error ? err.message : err);
    return false;
  }

  if (!warnedMissingConfig) {
    console.warn("[sms] No SMS provider configured (Twilio or SMS_API_URL/KEY) — messages skipped.");
    warnedMissingConfig = true;
  }
  return false;
}

export function smsConfigured(): boolean {
  return Boolean(
    (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) ||
      (process.env.SMS_API_URL && process.env.SMS_API_KEY)
  );
}
