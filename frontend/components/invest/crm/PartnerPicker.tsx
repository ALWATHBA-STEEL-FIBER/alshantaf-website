"use client";

import { useEffect, useRef, useState } from "react";
import { crmApi, type PartnerRow } from "@/lib/investApi";
import { PartnerFormModal } from "./PartnerForm";
import { Avatar, fmt, inputCls, useT } from "./ui";

export type PickedPartner = { id: string; name: string; code: string | null; phone?: string | null };

/**
 * Search the partner register by name, partner no. (P-0007), phone, national ID or its last 4 digits.
 * Already-chosen partners are shown as disabled. "New partner" opens the create form pre-filled.
 */
export function PartnerPicker({
  onPick,
  excludeIds = [],
  placeholder,
  autoFocus,
}: {
  onPick: (p: PickedPartner) => void;
  excludeIds?: string[];
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    const id = setTimeout(() => {
      setLoading(true);
      crmApi
        .partners(q.trim() || undefined, "1")
        .then((r) => !ignore && (setRows(r.slice(0, 30)), setActive(0)))
        .catch(() => !ignore && setRows([]))
        .finally(() => !ignore && setLoading(false));
    }, 180);
    return () => {
      ignore = true;
      clearTimeout(id);
    };
  }, [q, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selectable = rows.filter((r) => !excludeIds.includes(r.id));

  function pick(r: PartnerRow) {
    onPick({ id: r.id, name: r.name, code: r.code, phone: r.phone });
    setQ("");
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <span className="absolute inset-y-0 start-3 flex items-center text-ink-soft pointer-events-none" aria-hidden>
          ⌕
        </span>
        <input
          className={`${inputCls} ps-9`}
          value={q}
          autoFocus={autoFocus}
          placeholder={placeholder ?? t("ابحث بالاسم، رقم الشريك، الهاتف، الرقم الوطني…", "Search name, partner no., phone, national ID…")}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, selectable.length));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (active < selectable.length) pick(selectable[active]);
              else setCreating(true);
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
      </div>
      {open ? (
        <div className="absolute z-40 mt-1 w-full max-h-80 overflow-y-auto rounded-xl border border-line bg-white shadow-xl">
          {loading && !rows.length ? <div className="px-3 py-3 text-sm text-ink-soft">…</div> : null}
          {rows.map((r) => {
            const taken = excludeIds.includes(r.id);
            const idx = selectable.indexOf(r);
            return (
              <button
                key={r.id}
                type="button"
                disabled={taken}
                onMouseEnter={() => idx >= 0 && setActive(idx)}
                onClick={() => pick(r)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-start border-b border-line/60 last:border-0 ${
                  taken ? "opacity-40 cursor-not-allowed" : idx === active ? "bg-gold/10" : "hover:bg-surface-2"
                }`}
              >
                <Avatar name={r.name} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-ink truncate">
                    {r.name}
                    <span className="ms-2 text-[11px] font-bold text-ink-soft">{r.code}</span>
                  </div>
                  <div className="text-[11px] text-ink-soft truncate" dir="ltr">
                    {[r.phone, r.nationalIdLast4 ? `ID …${r.nationalIdLast4}` : null, r.city].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div className="text-[11px] text-ink-soft text-end shrink-0">
                  {taken ? t("مضاف", "Added") : `${r.projectCount} ${t("مشروع", "proj.")}`}
                  <div className="font-bold text-ink tabular-nums">{fmt(r.totals.contributedCapital, { decimals: 0 })}</div>
                </div>
              </button>
            );
          })}
          {!loading && !rows.length ? (
            <div className="px-3 py-3 text-sm text-ink-soft">{t("لا نتائج", "No matches")}</div>
          ) : null}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={`w-full px-3 py-3 text-start text-sm font-bold text-green ${active === selectable.length ? "bg-gold/10" : "hover:bg-surface-2"}`}
          >
            + {q.trim() ? t(`إضافة «${q.trim()}» كشريك جديد`, `Add “${q.trim()}” as a new partner`) : t("شريك جديد", "New partner")}
          </button>
        </div>
      ) : null}
      {creating ? (
        <PartnerFormModal
          open
          initialName={/\d{4,}/.test(q) ? "" : q.trim()}
          onClose={() => setCreating(false)}
          onSaved={(p) => {
            setCreating(false);
            onPick(p);
            setQ("");
            setOpen(false);
          }}
          onPickExisting={(r) => {
            setCreating(false);
            if (!excludeIds.includes(r.id)) pick(r);
          }}
        />
      ) : null}
    </div>
  );
}
