"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { PublicOrderPayload } from "@/lib/types";

type Lang = "ar" | "en";

const COPY = {
  ar: {
    loading: "جاري التحميل…",
    unavailable: "الإيصال غير متاح",
    unavailableHint: "تحقق من الرابط أو تواصل مع المُصدر.",
    orderNo: "رقم الإيصال",
    date: "التاريخ",
    status: "الحالة",
    customer: "العميل",
    phone: "الهاتف",
    title: "الموضوع",
    notes: "ملاحظات",
    description: "البيان",
    qty: "الكمية",
    unit: "السعر",
    amount: "المبلغ",
    installments: "جدول الأقساط",
    due: "الاستحقاق",
    payments: "المدفوعات",
    total: "الإجمالي",
    paid: "المدفوع",
    balance: "المتبقي",
    print: "طباعة / PDF",
    footer: "وثيقة رسمية — يُرجى الاحتفاظ بها للرجوع",
    kinds: {
      payments: "سجل المدفوعات",
      installments: "جدول التقسيط",
      one_time: "فاتورة دفعة واحدة",
      service: "إيصال خدمة",
    } as Record<string, string>,
    statuses: {
      open: "مفتوح",
      closed: "مغلق",
      void: "ملغى",
      due: "مستحق",
      paid: "مدفوع",
      skipped: "متجاوز",
      installment: "قسط",
    } as Record<string, string>,
    currency: "دينار",
  },
  en: {
    loading: "Loading…",
    unavailable: "Receipt unavailable",
    unavailableHint: "Check the link or contact the issuer.",
    orderNo: "Receipt no.",
    date: "Date",
    status: "Status",
    customer: "Customer",
    phone: "Phone",
    title: "Subject",
    notes: "Notes",
    description: "Description",
    qty: "Qty",
    unit: "Unit",
    amount: "Amount",
    installments: "Installment schedule",
    due: "Due",
    payments: "Payments",
    total: "Total",
    paid: "Paid",
    balance: "Balance",
    print: "Print / PDF",
    footer: "Official document — please keep for your records",
    kinds: {
      payments: "Payment history",
      installments: "Installments",
      one_time: "One-time invoice",
      service: "Service receipt",
    } as Record<string, string>,
    statuses: {
      open: "Open",
      closed: "Closed",
      void: "Void",
      due: "Due",
      paid: "Paid",
      skipped: "Skipped",
      installment: "Installment",
    } as Record<string, string>,
    currency: "JOD",
  },
};

const FALLBACK_THEME = {
  primary: "#0f342f",
  accent: "#c89a58",
  accentSoft: "#d9b57a",
  bg: "#f3efe6",
  surface: "#ffffff",
  ink: "#142028",
  muted: "#5d6b74",
  line: "rgba(20, 32, 40, 0.12)",
  soft: "#f8f5ef",
  headerBg: "#0f342f",
  headerFg: "#ffffff",
  fontDisplay: "Cairo",
  fontBody: "IBM Plex Sans Arabic",
  radius: "14px",
};

function translateMethod(method: string | null, lang: Lang): string {
  if (!method) return "";
  if (lang === "ar" && method === "installment") return COPY.ar.statuses.installment;
  return method;
}

function money(value: string, currencyLabel: string) {
  return (
    <span className="op-num" dir="ltr">
      {value} <span className="op-cur">{currencyLabel}</span>
    </span>
  );
}

export function OrderPortal({ token }: { token: string }) {
  const [data, setData] = useState<PublicOrderPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Lang>("ar");
  const c = COPY[lang];

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    api
      .publicOrder(token)
      .then((payload) => {
        if (!ignore) setData(payload);
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof ApiError ? err.message : COPY.ar.unavailableHint);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [token]);

  const theme = useMemo(() => data?.brand.theme || FALLBACK_THEME, [data]);
  const brandId = data?.brand.id || data?.order.brand || "alshantaf";
  const isSteel = brandId === "steelfiber";

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm" dir="rtl" style={{ color: "#5d6b74" }}>
        {COPY.ar.loading}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center" dir="rtl">
        <h1 className="text-xl font-bold mb-2" style={{ color: "#0f342f" }}>
          {COPY.ar.unavailable}
        </h1>
        <p className="text-sm" style={{ color: "#5d6b74" }}>
          {error || COPY.ar.unavailableHint}
        </p>
      </div>
    );
  }

  const { order, brand } = data;
  const currencyLabel = order.currency === "JOD" ? c.currency : order.currency;
  const dir = lang === "ar" ? "rtl" : "ltr";
  const logoHeader = brand.logoUrl || brand.logoPrintUrl || "";
  const logoPrint = brand.logoPrintUrl || brand.logoUrl || "";
  const dateStr = new Date(order.createdAt).toLocaleDateString(lang === "ar" ? "ar-JO" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const cssVars = {
    ["--op-primary" as string]: theme.primary,
    ["--op-accent" as string]: theme.accent,
    ["--op-accent-soft" as string]: theme.accentSoft,
    ["--op-bg" as string]: theme.bg,
    ["--op-surface" as string]: theme.surface,
    ["--op-ink" as string]: theme.ink,
    ["--op-muted" as string]: theme.muted,
    ["--op-line" as string]: theme.line,
    ["--op-soft" as string]: theme.soft,
    ["--op-header-bg" as string]: theme.headerBg,
    ["--op-header-fg" as string]: theme.headerFg,
    ["--op-radius" as string]: theme.radius,
    ["--op-font-display" as string]: `"${theme.fontDisplay}", "Cairo", system-ui, sans-serif`,
    ["--op-font-body" as string]: `"${theme.fontBody}", "Cairo", system-ui, sans-serif`,
  };

  return (
    <div className={`order-portal${isSteel ? " op-steel" : " op-ash"}`} dir={dir} lang={lang} style={cssVars}>
      <link
        href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .order-portal {
          min-height: 100vh;
          background: var(--op-bg);
          color: var(--op-ink);
          font-family: var(--op-font-body);
          padding: 28px 16px 48px;
        }
        .order-portal h1, .order-portal h2, .order-portal .op-brand-name {
          font-family: var(--op-font-display);
        }
        .op-sheet {
          width: min(760px, 100%);
          margin: 0 auto;
          background: var(--op-surface);
          border: 1px solid var(--op-line);
          border-radius: var(--op-radius);
          overflow: hidden;
          box-shadow: 0 18px 40px -28px color-mix(in srgb, var(--op-primary) 45%, transparent);
        }
        .op-steel .op-sheet {
          box-shadow: 0 16px 36px -28px rgba(0,0,0,.35);
        }
        .op-head {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px 24px;
          align-items: center;
          padding: 22px 28px;
          background: var(--op-header-bg);
          color: var(--op-header-fg);
          border-bottom: 3px solid var(--op-accent);
        }
        .op-logo-wrap {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }
        .op-logo {
          height: 56px;
          width: auto;
          max-width: 160px;
          object-fit: contain;
          flex: none;
        }
        .op-ash .op-logo {
          background: #fff;
          border-radius: 8px;
          padding: 6px 8px;
        }
        .op-brand-name {
          font-size: clamp(15px, 2.4vw, 20px);
          font-weight: 800;
          line-height: 1.25;
          margin: 0;
        }
        .op-brand-en {
          margin-top: 2px;
          font-size: 12px;
          opacity: .78;
          letter-spacing: .02em;
        }
        .op-head-meta {
          text-align: end;
          min-width: 0;
        }
        .op-doc-label {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: var(--op-accent-soft);
          margin-bottom: 6px;
        }
        .op-domain {
          font-size: 12px;
          opacity: .72;
          direction: ltr;
          unicode-bidi: isolate;
        }
        .op-body { padding: 24px 28px 28px; }
        .op-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px 20px;
        }
        .op-block {
          background: var(--op-soft);
          border: 1px solid var(--op-line);
          border-radius: calc(var(--op-radius) - 4px);
          padding: 14px 16px;
          min-width: 0;
        }
        .op-k {
          font-size: 11px;
          font-weight: 700;
          color: var(--op-muted);
          margin-bottom: 4px;
        }
        .op-v {
          font-size: 15px;
          font-weight: 700;
          color: var(--op-ink);
          word-break: break-word;
        }
        .op-v.accent { color: var(--op-primary); }
        .op-steel .op-v.accent { color: var(--op-accent); }
        .op-rule {
          height: 1px;
          background: var(--op-line);
          margin: 20px 0;
        }
        .op-rule.accent {
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--op-accent), transparent);
        }
        .op-section-title {
          font-size: 13px;
          font-weight: 800;
          color: var(--op-primary);
          margin: 0 0 10px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .op-steel .op-section-title { color: var(--op-ink); }
        .op-section-title::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--op-line);
        }
        .op-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13.5px;
        }
        .op-table th {
          font-size: 11px;
          font-weight: 700;
          color: var(--op-muted);
          padding: 10px 8px;
          border-bottom: 2px solid var(--op-line);
          white-space: nowrap;
        }
        .op-table td {
          padding: 11px 8px;
          border-bottom: 1px solid var(--op-line);
          vertical-align: top;
        }
        .op-table tr:last-child td { border-bottom: 0; }
        .op-table .num { text-align: end; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .op-table th:first-child, .op-table td:first-child { text-align: start; padding-inline-start: 0; }
        .op-table th:last-child, .op-table td:last-child { padding-inline-end: 0; }
        .op-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 6px;
        }
        .op-sum-cell {
          text-align: center;
          padding: 14px 10px;
          border: 1px solid var(--op-line);
          border-radius: calc(var(--op-radius) - 4px);
          background: var(--op-soft);
        }
        .op-sum-cell.balance {
          background: color-mix(in srgb, var(--op-accent) 14%, var(--op-surface));
          border-color: color-mix(in srgb, var(--op-accent) 45%, var(--op-line));
        }
        .op-sum-cell .op-k { margin-bottom: 6px; }
        .op-sum-cell .op-v { font-size: 16px; }
        .op-num { font-variant-numeric: tabular-nums; white-space: nowrap; }
        .op-cur { font-size: .85em; font-weight: 600; opacity: .85; }
        .op-notes {
          margin-top: 14px;
          font-size: 13px;
          color: var(--op-muted);
          white-space: pre-wrap;
          line-height: 1.65;
        }
        .op-foot {
          margin-top: 22px;
          padding-top: 14px;
          border-top: 1px solid var(--op-line);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          align-items: end;
          font-size: 11px;
          color: var(--op-muted);
        }
        .op-foot-mark {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .op-foot-logo {
          height: 28px;
          width: auto;
          object-fit: contain;
          opacity: .9;
        }
        .op-foot-end { text-align: end; }
        .op-actions {
          width: min(760px, 100%);
          margin: 16px auto 0;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .op-btn {
          height: 44px;
          padding: 0 20px;
          border-radius: 12px;
          border: 0;
          font: inherit;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          color: #fff;
          background: var(--op-primary);
        }
        .op-steel .op-btn {
          background: var(--op-accent);
          color: #111;
        }
        .op-lang {
          margin-inline-start: auto;
          display: flex;
          gap: 6px;
        }
        .op-lang button {
          height: 36px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid var(--op-line);
          background: var(--op-surface);
          color: var(--op-ink);
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .op-lang button[aria-pressed="true"] {
          border-color: var(--op-accent);
          background: color-mix(in srgb, var(--op-accent) 16%, var(--op-surface));
        }
        @media (max-width: 640px) {
          .op-head, .op-grid-2, .op-summary, .op-foot { grid-template-columns: 1fr; }
          .op-head-meta, .op-foot-end { text-align: start; }
          .op-body, .op-head { padding-inline: 18px; }
        }
        @page {
          size: A4;
          margin: 12mm;
        }
        @media print {
          html, body { background: #fff !important; }
          .order-portal {
            background: #fff !important;
            padding: 0 !important;
            min-height: 0 !important;
          }
          .no-print { display: none !important; }
          .op-sheet {
            width: 100% !important;
            max-width: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          .op-head {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .op-block, .op-sum-cell, .op-sum-cell.balance {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .op-table tr { break-inside: avoid; }
          .op-logo-screen { display: none !important; }
          .op-logo-print { display: block !important; }
          .op-ash .op-logo, .op-steel .op-logo {
            background: transparent !important;
            padding: 0 !important;
          }
        }
        .op-logo-print { display: none; }
      `}</style>

      <article className="op-sheet print-sheet" aria-label={c.kinds[order.kind] || "Receipt"}>
        <header className="op-head">
          <div className="op-logo-wrap">
            {logoHeader ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="op-logo op-logo-screen" src={logoHeader} alt={brand.nameEn} />
            ) : null}
            {logoPrint ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="op-logo op-logo-print" src={logoPrint} alt={brand.nameEn} />
            ) : null}
            <div>
              <p className="op-brand-name">{lang === "ar" ? brand.nameAr : brand.nameEn}</p>
              <div className="op-brand-en">{lang === "ar" ? brand.nameEn : brand.nameAr}</div>
            </div>
          </div>
          <div className="op-head-meta">
            <div className="op-doc-label">{c.kinds[order.kind] || order.kind}</div>
            <div className="op-domain">{brand.domain}</div>
          </div>
        </header>

        <div className="op-body">
          <div className="op-grid-2">
            <div className="op-block">
              <div className="op-k">{c.orderNo}</div>
              <div className="op-v accent" dir="ltr">
                {order.serialNo}
              </div>
            </div>
            <div className="op-block">
              <div className="op-k">{c.date}</div>
              <div className="op-v">{dateStr}</div>
            </div>
            <div className="op-block">
              <div className="op-k">{c.status}</div>
              <div className="op-v">{c.statuses[order.status] || order.status}</div>
            </div>
            <div className="op-block">
              <div className="op-k">{c.customer}</div>
              <div className="op-v">{order.customerName}</div>
              {order.customerPhone ? (
                <div className="op-notes" style={{ marginTop: 6 }} dir="ltr">
                  {c.phone}: {order.customerPhone}
                </div>
              ) : null}
            </div>
          </div>

          {(order.title || order.notes) && (
            <>
              <div className="op-rule accent" />
              <div className="op-block" style={{ marginTop: 0 }}>
                {order.title ? (
                  <>
                    <div className="op-k">{c.title}</div>
                    <div className="op-v">{order.title}</div>
                  </>
                ) : null}
                {order.notes ? <p className="op-notes">{order.notes}</p> : null}
              </div>
            </>
          )}

          {order.lines.length > 0 && (
            <>
              <div className="op-rule" />
              <h2 className="op-section-title">{c.description}</h2>
              <table className="op-table">
                <thead>
                  <tr>
                    <th style={{ width: "46%" }}>{c.description}</th>
                    <th className="num">{c.qty}</th>
                    <th className="num">{c.unit}</th>
                    <th className="num">{c.amount}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.description}</td>
                      <td className="num" dir="ltr">
                        {l.quantity}
                      </td>
                      <td className="num">{money(l.unitAmount, currencyLabel)}</td>
                      <td className="num">
                        <strong>{money(l.amount, currencyLabel)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {order.installments.length > 0 && (
            <>
              <div className="op-rule" />
              <h2 className="op-section-title">{c.installments}</h2>
              <table className="op-table">
                <thead>
                  <tr>
                    <th>{c.due}</th>
                    <th className="num">{c.amount}</th>
                    <th className="num">{c.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.installments.map((i, idx) => (
                    <tr key={idx}>
                      <td dir="ltr">{i.dueDate}</td>
                      <td className="num">{money(i.amount, currencyLabel)}</td>
                      <td className="num">
                        <strong>{c.statuses[i.status] || i.status}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {order.payments.length > 0 && (
            <>
              <div className="op-rule" />
              <h2 className="op-section-title">{c.payments}</h2>
              <table className="op-table">
                <thead>
                  <tr>
                    <th>{c.date}</th>
                    <th>{c.description}</th>
                    <th className="num">{c.amount}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.payments.map((p, i) => (
                    <tr key={i}>
                      <td dir="ltr">
                        {new Date(p.paidAt).toLocaleDateString(lang === "ar" ? "ar-JO" : "en-GB")}
                      </td>
                      <td>
                        {[translateMethod(p.method, lang), p.note].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="num">
                        <strong>{money(p.amount, currencyLabel)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="op-rule accent" />
          <div className="op-summary">
            <div className="op-sum-cell">
              <div className="op-k">{c.total}</div>
              <div className="op-v">{money(order.totalAmount, currencyLabel)}</div>
            </div>
            <div className="op-sum-cell">
              <div className="op-k">{c.paid}</div>
              <div className="op-v">{money(order.paidAmount, currencyLabel)}</div>
            </div>
            <div className="op-sum-cell balance">
              <div className="op-k">{c.balance}</div>
              <div className="op-v accent">{money(order.balanceAmount, currencyLabel)}</div>
            </div>
          </div>

          <footer className="op-foot">
            <div className="op-foot-mark">
              {logoPrint ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="op-foot-logo" src={logoPrint} alt="" />
              ) : null}
              <span dir="ltr">{brand.domain}</span>
            </div>
            <div className="op-foot-end">{c.footer}</div>
          </footer>
        </div>
      </article>

      <div className="op-actions no-print">
        <button type="button" className="op-btn" onClick={() => window.print()}>
          {c.print}
        </button>
        <div className="op-lang">
          <button type="button" aria-pressed={lang === "ar"} onClick={() => setLang("ar")}>
            العربية
          </button>
          <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
            English
          </button>
        </div>
      </div>
    </div>
  );
}
