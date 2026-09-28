"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { api } from "@/lib/api";
import { AuditRow } from "./AuditRow";
import { EmptyState, SkeletonBlock } from "./EmptyState";
import { ShieldIcon } from "@/components/icons";
import type { AuditLogEntry } from "@/lib/types";

const FILTERS = [
  { key: "all" as const, value: "" },
  { key: "auth" as const, value: "auth" },
  { key: "listing" as const, value: "listing" },
  { key: "submission" as const, value: "submission" },
  { key: "contact" as const, value: "contact" },
  { key: "settings" as const, value: "settings" },
  { key: "admin_user" as const, value: "admin_user" },
  { key: "media" as const, value: "media" },
];

export function SecurityLog() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    api.auditLog(filter || undefined).then((data) => {
      if (!ignore) {
        setLogs(data);
        setLoading(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, [filter]);

  const failedLogins = useMemo(() => logs.filter((l) => l.action === "auth.login_failed").length, [logs]);
  const successLogins = useMemo(() => logs.filter((l) => l.action === "auth.login").length, [logs]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-gold text-xs font-bold tracking-wide">{t.admin.sidebar.security}</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-green mt-1 flex items-center gap-2">
          <ShieldIcon className="w-6 h-6" />
          {t.admin.security}
        </h1>
        <p className="text-sm text-ink-soft mt-1 max-w-2xl">{t.admin.securitySubtitle}</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-line p-4">
          <small className="text-[11px] text-ink-soft">{t.admin.securityStatEvents}</small>
          <b className="block mt-1 text-2xl text-green">{loading ? "—" : logs.length}</b>
        </div>
        <div className="bg-white rounded-2xl border border-line p-4">
          <small className="text-[11px] text-ink-soft">{t.admin.securityStatLogins}</small>
          <b className="block mt-1 text-2xl text-green">{loading ? "—" : successLogins}</b>
        </div>
        <div className={`rounded-2xl border p-4 ${failedLogins > 0 ? "bg-red-50 border-red-100" : "bg-white border-line"}`}>
          <small className={`text-[11px] ${failedLogins > 0 ? "text-red-700" : "text-ink-soft"}`}>
            {t.admin.securityStatFailed}
          </small>
          <b className={`block mt-1 text-2xl ${failedLogins > 0 ? "text-red-700" : "text-green"}`}>
            {loading ? "—" : failedLogins}
          </b>
        </div>
      </div>

      {failedLogins > 0 && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl p-3 border border-red-100">
          {failedLogins} {failedLogins > 1 ? t.admin.failedLoginsWarning : t.admin.failedLoginWarning}
        </div>
      )}

      <div>
        <p className="text-[11px] font-bold text-ink-soft mb-2">{t.admin.securityFilterLabel}</p>
        <div className="flex gap-2 flex-wrap overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              type="button"
              className={`h-9 px-3 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                filter === f.value ? "bg-green text-white" : "bg-white border border-line hover:border-gold/40"
              }`}
            >
              {t.admin.securityFilters[f.key]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} className="h-14" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState title={t.admin.noActivity} note={t.admin.noActivityNote} />
      ) : (
        <div className="bg-white rounded-2xl border border-line divide-y divide-line overflow-hidden">
          {logs.map((entry) => (
            <AuditRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
