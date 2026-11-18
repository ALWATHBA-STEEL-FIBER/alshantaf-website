"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { useToast } from "./Toast";
import { EmptyState, Spinner, SkeletonBlock } from "./EmptyState";
import { ReceiptIcon } from "@/components/icons";
import type { CustomerOrder, OrderKind, OrderStatus } from "@/lib/types";

const KIND_LABEL: Record<OrderKind, { ar: string; en: string }> = {
  payments: { ar: "سجل مدفوعات", en: "Payment history" },
  installments: { ar: "تقسيط مفتوح", en: "Open installments" },
  one_time: { ar: "دفعة واحدة", en: "One-time payment" },
  service: { ar: "خدمة", en: "Service" },
};

type LineDraft = { description: string; quantity: string; unitAmount: string };
type InstDraft = { dueDate: string; amount: string; note: string };

const emptyForm = () => ({
  kind: "one_time" as OrderKind,
  customerName: "",
  customerPhone: "",
  title: "",
  notes: "",
  lines: [{ description: "", quantity: "1", unitAmount: "" }] as LineDraft[],
  installments: [{ dueDate: "", amount: "", note: "" }] as InstDraft[],
  initialAmount: "",
  initialMethod: "",
});

export function OrdersManager() {
  const { t, lang } = useLanguage();
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lastShareUrl, setLastShareUrl] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | OrderStatus>("all");

  const kindLabel = (k: OrderKind) => (lang === "ar" ? KIND_LABEL[k].ar : KIND_LABEL[k].en);
  const statusLabel = (s: OrderStatus | string) => {
    if (lang !== "ar") return s;
    const map: Record<string, string> = {
      open: "مفتوح",
      closed: "مغلق",
      void: "ملغى",
      due: "مستحق",
      paid: "مدفوع",
      skipped: "متجاوز",
    };
    return map[s] || s;
  };

  async function load() {
    setLoading(true);
    try {
      setRows(await api.adminOrders());
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((o) => {
      if (statusTab !== "all" && o.status !== statusTab) return false;
      if (!q) return true;
      return [o.serialNo, o.customerName, o.customerPhone, o.title]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q));
    });
  }, [rows, search, statusTab]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showSuccess(lang === "ar" ? "تم النسخ" : "Copied");
    } catch {
      showError(lang === "ar" ? "تعذر النسخ" : "Copy failed");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLastShareUrl(null);
    try {
      const payload: Record<string, unknown> = {
        kind: form.kind,
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim() || null,
        title: form.title.trim(),
        notes: form.notes.trim() || null,
      };

      if (form.kind === "installments") {
        payload.installments = form.installments
          .filter((i) => i.dueDate && i.amount)
          .map((i) => ({
            dueDate: i.dueDate,
            amount: i.amount,
            note: i.note || null,
          }));
      } else {
        const lines = form.lines
          .filter((l) => l.description.trim())
          .map((l) => ({
            description: l.description.trim(),
            quantity: l.quantity || "1",
            unitAmount: l.unitAmount || "0",
          }));
        if (lines.length) payload.lines = lines;
        if (form.initialAmount) {
          payload.initialPayment = {
            amount: form.initialAmount,
            method: form.initialMethod || null,
          };
        }
      }

      const res = await api.createOrder(payload);
      setRows((prev) => [res.order, ...prev]);
      setSelectedId(res.order.id);
      setLastShareUrl(res.shareUrl);
      setCreating(false);
      setForm(emptyForm());
      showSuccess(lang === "ar" ? "تم إنشاء الطلب والرابط" : "Order & link created");
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function markPayment() {
    if (!selected || !payAmount) return;
    setBusy(true);
    try {
      const updated = await api.addOrderPayment(selected.id, {
        amount: payAmount,
        note: payNote || null,
      });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setPayAmount("");
      setPayNote("");
      showSuccess(t.admin.confirm);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function payInstallment(installmentId: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await api.payOrderInstallment(selected.id, installmentId);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      showSuccess(t.admin.confirm);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function rotateLink() {
    if (!selected) return;
    if (!confirm(lang === "ar" ? "إنشاء رابط جديد وإبطال القديم؟" : "Create a new link and revoke the old one?"))
      return;
    setBusy(true);
    try {
      const res = await api.rotateOrderToken(selected.id);
      setRows((prev) => prev.map((r) => (r.id === res.order.id ? res.order : r)));
      setLastShareUrl(res.shareUrl);
      showSuccess(lang === "ar" ? "تم تدوير الرابط" : "Link rotated");
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function voidOrder() {
    if (!selected) return;
    if (!confirm(lang === "ar" ? "إبطال هذا الطلب؟" : "Void this order?")) return;
    setBusy(true);
    try {
      const updated = await api.updateOrder(selected.id, { status: "void" });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      showSuccess(t.admin.confirm);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-green flex items-center gap-2">
            <ReceiptIcon className="w-5 h-5" />
            {t.admin.ordersTitle}
          </h1>
          <p className="text-sm text-ink-soft mt-1">{t.admin.ordersNote}</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="h-10 px-4 rounded-xl bg-green text-white text-sm font-bold"
        >
          {t.admin.ordersNew}
        </button>
      </div>

      {lastShareUrl && (
        <div className="mb-4 p-3 rounded-xl border border-gold/40 bg-gold/10 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-green">{t.admin.ordersShareUrl}:</span>
          <code className="text-xs break-all flex-1">{lastShareUrl}</code>
          <button
            type="button"
            className="h-9 px-3 rounded-lg bg-green text-white text-xs font-bold"
            onClick={() => copyText(lastShareUrl)}
          >
            {t.admin.ordersCopy}
          </button>
          <a
            href={lastShareUrl}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-3 rounded-lg border border-line text-xs font-bold flex items-center"
          >
            {t.admin.view}
          </a>
        </div>
      )}

      {creating && (
        <form onSubmit={handleCreate} className="mb-6 p-4 rounded-2xl border border-line bg-white space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-green">{t.admin.ordersNew}</h2>
            <button type="button" className="text-sm text-ink-soft" onClick={() => setCreating(false)}>
              {t.admin.close}
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-bold text-ink-soft block">
              {t.admin.ordersKind}
              <select
                className="mt-1 w-full h-10 rounded-xl border border-line px-3 text-sm"
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as OrderKind }))}
              >
                {(Object.keys(KIND_LABEL) as OrderKind[]).map((k) => (
                  <option key={k} value={k}>
                    {kindLabel(k)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-ink-soft block">
              {t.admin.ordersCustomer}
              <input
                required
                className="mt-1 w-full h-10 rounded-xl border border-line px-3 text-sm"
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              />
            </label>
            <label className="text-xs font-bold text-ink-soft block">
              {t.admin.ordersPhone}
              <input
                className="mt-1 w-full h-10 rounded-xl border border-line px-3 text-sm"
                value={form.customerPhone}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
              />
            </label>
            <label className="text-xs font-bold text-ink-soft block">
              {t.admin.ordersOrderTitle}
              <input
                required
                className="mt-1 w-full h-10 rounded-xl border border-line px-3 text-sm"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
          </div>
          <label className="text-xs font-bold text-ink-soft block">
            {t.admin.ordersNotes}
            <textarea
              className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm min-h-20"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>

          {form.kind === "installments" ? (
            <div className="space-y-2">
              <div className="text-xs font-bold text-ink-soft">{t.admin.ordersInstallments}</div>
              {form.installments.map((inst, i) => (
                <div key={i} className="grid sm:grid-cols-3 gap-2">
                  <input
                    type="date"
                    required
                    className="h-10 rounded-xl border border-line px-3 text-sm"
                    value={inst.dueDate}
                    onChange={(e) =>
                      setForm((f) => {
                        const installments = [...f.installments];
                        installments[i] = { ...installments[i], dueDate: e.target.value };
                        return { ...f, installments };
                      })
                    }
                  />
                  <input
                    required
                    placeholder={t.admin.ordersAmount}
                    className="h-10 rounded-xl border border-line px-3 text-sm"
                    value={inst.amount}
                    onChange={(e) =>
                      setForm((f) => {
                        const installments = [...f.installments];
                        installments[i] = { ...installments[i], amount: e.target.value };
                        return { ...f, installments };
                      })
                    }
                  />
                  <input
                    placeholder={t.admin.ordersNotes}
                    className="h-10 rounded-xl border border-line px-3 text-sm"
                    value={inst.note}
                    onChange={(e) =>
                      setForm((f) => {
                        const installments = [...f.installments];
                        installments[i] = { ...installments[i], note: e.target.value };
                        return { ...f, installments };
                      })
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-bold text-green"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    installments: [...f.installments, { dueDate: "", amount: "", note: "" }],
                  }))
                }
              >
                + {t.admin.ordersAddRow}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-bold text-ink-soft">{t.admin.ordersLines}</div>
              {form.lines.map((line, i) => (
                <div key={i} className="grid sm:grid-cols-3 gap-2">
                  <input
                    placeholder={t.admin.ordersDesc}
                    className="h-10 rounded-xl border border-line px-3 text-sm sm:col-span-1"
                    value={line.description}
                    onChange={(e) =>
                      setForm((f) => {
                        const lines = [...f.lines];
                        lines[i] = { ...lines[i], description: e.target.value };
                        return { ...f, lines };
                      })
                    }
                  />
                  <input
                    placeholder={t.admin.ordersQty}
                    className="h-10 rounded-xl border border-line px-3 text-sm"
                    value={line.quantity}
                    onChange={(e) =>
                      setForm((f) => {
                        const lines = [...f.lines];
                        lines[i] = { ...lines[i], quantity: e.target.value };
                        return { ...f, lines };
                      })
                    }
                  />
                  <input
                    placeholder={t.admin.ordersUnit}
                    className="h-10 rounded-xl border border-line px-3 text-sm"
                    value={line.unitAmount}
                    onChange={(e) =>
                      setForm((f) => {
                        const lines = [...f.lines];
                        lines[i] = { ...lines[i], unitAmount: e.target.value };
                        return { ...f, lines };
                      })
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-bold text-green"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    lines: [...f.lines, { description: "", quantity: "1", unitAmount: "" }],
                  }))
                }
              >
                + {t.admin.ordersAddRow}
              </button>
              <div className="grid sm:grid-cols-2 gap-2 pt-2">
                <input
                  placeholder={t.admin.ordersInitialPay}
                  className="h-10 rounded-xl border border-line px-3 text-sm"
                  value={form.initialAmount}
                  onChange={(e) => setForm((f) => ({ ...f, initialAmount: e.target.value }))}
                />
                <input
                  placeholder={t.admin.ordersMethod}
                  className="h-10 rounded-xl border border-line px-3 text-sm"
                  value={form.initialMethod}
                  onChange={(e) => setForm((f) => ({ ...f, initialMethod: e.target.value }))}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="h-11 px-5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-60"
          >
            {busy ? <Spinner className="w-4 h-4 inline-block" /> : t.admin.ordersCreateLink}
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "open", "closed", "void"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusTab(s)}
            className={`h-9 px-3 rounded-full text-xs font-bold ${
              statusTab === s ? "bg-green text-white" : "bg-surface-2 text-ink-soft"
            }`}
          >
            {s === "all" ? t.admin.all : s}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.admin.ordersSearch}
          className="ms-auto h-9 px-3 rounded-xl border border-line text-sm min-w-[180px]"
        />
      </div>

      {loading ? (
        <SkeletonBlock />
      ) : visible.length === 0 ? (
        <EmptyState title={t.admin.ordersEmpty} />
      ) : (
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 space-y-2">
            {visible.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setSelectedId(o.id);
                  setLastShareUrl(null);
                }}
                className={`w-full text-start p-3 rounded-xl border transition-colors ${
                  selectedId === o.id ? "border-green bg-green/5" : "border-line bg-white hover:bg-surface-2"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-sm text-green">{o.serialNo}</span>
                  <span className="text-[11px] font-bold text-ink-soft">{statusLabel(o.status)}</span>
                </div>
                <div className="text-sm font-medium mt-1">{o.title}</div>
                <div className="text-xs text-ink-soft mt-1">
                  {o.customerName} · {kindLabel(o.kind)} · {o.totalAmount} {o.currency}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-3">
            {!selected ? (
              <div className="p-6 rounded-2xl border border-dashed border-line text-sm text-ink-soft">
                {t.admin.ordersSelect}
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-line bg-white space-y-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <div className="text-xs text-ink-soft">{selected.serialNo}</div>
                    <h2 className="text-lg font-bold text-green">{selected.title}</h2>
                    <p className="text-sm text-ink-soft">
                      {selected.customerName}
                      {selected.customerPhone ? ` · ${selected.customerPhone}` : ""}
                    </p>
                  </div>
                  <div className="text-end text-sm">
                    <div>
                      {t.admin.ordersTotal}:{" "}
                      <strong>
                        {selected.totalAmount} {selected.currency}
                      </strong>
                    </div>
                    <div>
                      {t.admin.ordersPaid}: {selected.paidAmount}
                    </div>
                    <div>
                      {t.admin.ordersBalance}: {selected.balanceAmount}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || selected.status === "void"}
                    onClick={rotateLink}
                    className="h-9 px-3 rounded-lg border border-line text-xs font-bold"
                  >
                    {t.admin.ordersRotate}
                  </button>
                  <button
                    type="button"
                    disabled={busy || selected.status === "void"}
                    onClick={voidOrder}
                    className="h-9 px-3 rounded-lg border border-red-200 text-red-700 text-xs font-bold"
                  >
                    {t.admin.ordersVoid}
                  </button>
                  {selected.tokenPrefix && (
                    <span className="h-9 px-3 rounded-lg bg-surface-2 text-xs font-mono flex items-center">
                      {selected.tokenPrefix}…
                    </span>
                  )}
                </div>

                {selected.lines.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-ink-soft text-xs border-b border-line">
                        <th className="py-2 text-start">{t.admin.ordersDesc}</th>
                        <th className="py-2 text-end">{t.admin.ordersQty}</th>
                        <th className="py-2 text-end">{t.admin.ordersAmount}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.lines.map((l) => (
                        <tr key={l.id} className="border-b border-line/60">
                          <td className="py-2">{l.description}</td>
                          <td className="py-2 text-end">{l.quantity}</td>
                          <td className="py-2 text-end">{l.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {selected.installments.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-ink-soft">{t.admin.ordersInstallments}</div>
                    {selected.installments.map((i) => (
                      <div
                        key={i.id}
                        className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-surface-2"
                      >
                        <div className="text-sm">
                          <strong>{i.dueDate}</strong> — {i.amount} {selected.currency}{" "}
                          <span className="text-xs text-ink-soft">({statusLabel(i.status)})</span>
                        </div>
                        {i.status === "due" && selected.status !== "void" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => payInstallment(i.id)}
                            className="h-8 px-3 rounded-lg bg-green text-white text-xs font-bold"
                          >
                            {t.admin.ordersMarkPaid}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selected.payments.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-ink-soft mb-2">{t.admin.ordersPayments}</div>
                    <ul className="space-y-1 text-sm">
                      {selected.payments.map((p) => (
                        <li key={p.id} className="flex justify-between gap-2 border-b border-line/50 py-1">
                          <span>
                            {new Date(p.paidAt).toLocaleString()} {p.method ? `· ${p.method}` : ""}
                            {p.note ? ` · ${p.note}` : ""}
                          </span>
                          <strong>
                            {p.amount} {selected.currency}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selected.kind !== "installments" && selected.status === "open" && (
                  <div className="flex flex-wrap gap-2 items-end border-t border-line pt-3">
                    <input
                      placeholder={t.admin.ordersAmount}
                      className="h-10 rounded-xl border border-line px-3 text-sm"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                    <input
                      placeholder={t.admin.ordersNotes}
                      className="h-10 rounded-xl border border-line px-3 text-sm flex-1 min-w-[140px]"
                      value={payNote}
                      onChange={(e) => setPayNote(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={busy || !payAmount}
                      onClick={markPayment}
                      className="h-10 px-4 rounded-xl bg-green text-white text-xs font-bold"
                    >
                      {t.admin.ordersMarkPaid}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
