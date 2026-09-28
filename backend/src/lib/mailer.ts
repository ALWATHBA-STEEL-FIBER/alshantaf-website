import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;
let warnedMissingConfig = false;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    if (!warnedMissingConfig) {
      console.warn("[mailer] SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS not fully configured — emails will be skipped.");
      warnedMissingConfig = true;
    }
    return null;
  }

  const port = Number(SMTP_PORT);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST.trim(),
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendMail(options: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "info@alshantaf.com";
  try {
    await t.sendMail({ from: `Alshantaf Invest <${from}>`, to: options.to, subject: options.subject, html: options.html, text: options.text });
    return true;
  } catch (err) {
    console.error("[mailer] send failed:", err instanceof Error ? err.message : err);
    return false;
  }
}
