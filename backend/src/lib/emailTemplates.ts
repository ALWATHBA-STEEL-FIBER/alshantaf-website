export function siteUrl(): string {
  return (process.env.PUBLIC_SITE_URL || "https://alshantaf.com").replace(/\/+$/, "");
}

export function trackingUrl(trackingCode: string): string {
  return `${siteUrl()}/track/${trackingCode}`;
}

export function trackingEmail(opts: { lang: "ar" | "en"; applicant: string; serialNo: string; trackingCode: string }) {
  const url = trackingUrl(opts.trackingCode);

  if (opts.lang === "en") {
    return {
      subject: `Your request ${opts.serialNo} was received — Alshantaf Invest`,
      text: `Hello ${opts.applicant},\n\nWe received your listing request.\n\nReference number: ${opts.serialNo}\nTracking code: ${opts.trackingCode}\n\nTrack your request at any time:\n${url}\n\nOur team reviews every request before publishing. We'll be in touch if we need anything else.\n\n— Alshantaf Invest`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#182228">
          <h2 style="color:#113a34;margin-bottom:4px">Request received</h2>
          <p>Hello ${escapeHtml(opts.applicant)},</p>
          <p>We received your listing request. Our team reviews every request before it's published.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px 0;color:#61707a;font-size:13px">Reference number</td><td style="padding:8px 0;font-weight:bold">${opts.serialNo}</td></tr>
            <tr><td style="padding:8px 0;color:#61707a;font-size:13px">Tracking code</td><td style="padding:8px 0;font-weight:bold;font-family:monospace">${opts.trackingCode}</td></tr>
          </table>
          <a href="${url}" style="display:inline-block;background:#113a34;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold">Track your request</a>
          <p style="color:#61707a;font-size:12px;margin-top:24px">Alshantaf Real Estate &amp; Investment</p>
        </div>`,
    };
  }

  return {
    subject: `تم استلام طلبك ${opts.serialNo} — الشنتف للعقار والاستثمار`,
    text: `مرحبًا ${opts.applicant}،\n\nتم استلام طلبك بنجاح.\n\nرقم الطلب: ${opts.serialNo}\nرمز التتبع: ${opts.trackingCode}\n\nيمكنك متابعة حالة طلبك في أي وقت عبر الرابط:\n${url}\n\nيقوم فريقنا بمراجعة كل طلب قبل نشره، وسنتواصل معك إذا احتجنا لمعلومات إضافية.\n\n— الشنتف للعقار والاستثمار`,
    html: `
      <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:480px;margin:0 auto;color:#182228">
        <h2 style="color:#113a34;margin-bottom:4px">تم استلام طلبك</h2>
        <p>مرحبًا ${escapeHtml(opts.applicant)}،</p>
        <p>تم استلام طلبك بنجاح. يقوم فريقنا بمراجعة كل طلب قبل نشره على الموقع.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#61707a;font-size:13px">رقم الطلب</td><td style="padding:8px 0;font-weight:bold">${opts.serialNo}</td></tr>
          <tr><td style="padding:8px 0;color:#61707a;font-size:13px">رمز التتبع</td><td style="padding:8px 0;font-weight:bold;font-family:monospace">${opts.trackingCode}</td></tr>
        </table>
        <a href="${url}" style="display:inline-block;background:#113a34;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold">متابعة حالة الطلب</a>
        <p style="color:#61707a;font-size:12px;margin-top:24px">الشنتف للعقار والاستثمار</p>
      </div>`,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
