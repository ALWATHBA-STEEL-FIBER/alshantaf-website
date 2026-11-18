"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { api } from "@/lib/api";
import { EmptyState, SkeletonBlock } from "./EmptyState";
import { MonitorIcon } from "@/components/icons";
import type { MonitorSummary, SiteDevice, SiteDeviceEvent } from "@/lib/types";

function fmtWhen(iso: string, lang: "ar" | "en") {
  try {
    return new Date(iso).toLocaleString(lang === "ar" ? "ar-JO" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function isOnline(lastSeenAt: string) {
  return Date.now() - new Date(lastSeenAt).getTime() < 90_000;
}

export function SiteMonitorManager() {
  const { t, lang } = useLanguage();
  const m = t.admin.monitor;
  const [summary, setSummary] = useState<MonitorSummary | null>(null);
  const [devices, setDevices] = useState<SiteDevice[]>([]);
  const [total, setTotal] = useState(0);
  const [ips, setIps] = useState<Array<{ ip: string; hits: number; devices: number; days: number; lastDay: string }>>([]);
  const [q, setQ] = useState("");
  const [namedOnly, setNamedOnly] = useState(false);
  const [tab, setTab] = useState<"devices" | "ips">("devices");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    device: SiteDevice;
    events: SiteDeviceEvent[];
    siblingDevices: Array<{
      id: string;
      displayName: string | null;
      visitorId: string;
      lastSeenAt: string;
      requestCount: number;
      lastPath: string;
    }>;
  } | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    const [sum, list, ipList] = await Promise.all([
      api.monitorSummary(),
      api.monitorDevices({ q: q.trim() || undefined, named: namedOnly, limit: 80 }),
      api.monitorIps(30),
    ]);
    setSummary(sum);
    setDevices(list.devices);
    setTotal(list.total);
    setIps(ipList.ips);
  }, [q, namedOnly]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    loadList()
      .catch(() => {
        if (!ignore) setError(true);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    const id = setInterval(() => {
      void loadList().catch(() => undefined);
    }, 20000);
    return () => {
      ignore = true;
      clearInterval(id);
    };
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let ignore = false;
    api
      .monitorDevice(selectedId)
      .then((d) => {
        if (!ignore) {
          setDetail(d);
          setEditName(d.device.displayName || "");
        }
      })
      .catch(() => {
        if (!ignore) setDetail(null);
      });
    return () => {
      ignore = true;
    };
  }, [selectedId]);

  async function saveName() {
    if (!selectedId) return;
    const next = editName.trim() || null;
    await api.monitorSetDeviceName(selectedId, next);
    const d = await api.monitorDevice(selectedId);
    setDetail(d);
    await loadList();
  }

  if (error) {
    return <EmptyState title={m.loadErrorTitle} note={m.loadErrorNote} />;
  }

  if (loading && !summary) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonBlock className="h-10 w-56" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-24" />
          ))}
        </div>
        <SkeletonBlock className="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-gold text-xs font-bold tracking-wide">{t.admin.sidebar.monitor}</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-green mt-1 flex items-center gap-2">
          <MonitorIcon className="w-6 h-6" />
          {m.title}
        </h1>
        <p className="text-sm text-ink-soft mt-1">{m.subtitle}</p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label={m.uniqueIps1d} value={summary.uniqueIps.day1} />
          <Stat label={m.uniqueIps7d} value={summary.uniqueIps.day7} />
          <Stat label={m.uniqueIps30d} value={summary.uniqueIps.day30} />
          <Stat label={m.onlineNow} value={summary.onlineDevices} accent />
          <Stat label={m.totalDevices} value={summary.totalDevices} />
          <Stat label={m.namedDevices} value={summary.namedDevices} />
          <Stat label={m.events24h} value={summary.eventsLast24h} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("devices")}
          className={`h-10 px-4 rounded-full text-xs font-bold border ${
            tab === "devices" ? "bg-green text-white border-green" : "border-line bg-white text-ink-soft"
          }`}
        >
          {m.tabDevices}
        </button>
        <button
          type="button"
          onClick={() => setTab("ips")}
          className={`h-10 px-4 rounded-full text-xs font-bold border ${
            tab === "ips" ? "bg-green text-white border-green" : "border-line bg-white text-ink-soft"
          }`}
        >
          {m.tabIps}
        </button>
        {tab === "devices" && (
          <>
            <input
              className="h-10 flex-1 min-w-[12rem] rounded-full border border-line bg-white px-4 text-sm outline-none focus:border-gold"
              placeholder={m.searchPlaceholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <label className="inline-flex items-center gap-2 text-xs font-bold text-ink-soft px-2">
              <input type="checkbox" checked={namedOnly} onChange={(e) => setNamedOnly(e.target.checked)} />
              {m.namedOnly}
            </label>
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div className="bg-white rounded-2xl border border-line overflow-hidden">
          {tab === "devices" ? (
            devices.length === 0 ? (
              <div className="p-6">
                <EmptyState title={m.emptyDevicesTitle} note={m.emptyDevicesNote} />
              </div>
            ) : (
              <ul className="divide-y divide-line max-h-[70vh] overflow-y-auto">
                {devices.map((d) => {
                  const active = selectedId === d.id;
                  const online = isOnline(d.lastSeenAt);
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(d.id)}
                        className={`w-full text-start px-4 py-3 transition-colors ${
                          active ? "bg-green/5" : "hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-ink truncate">
                              {d.displayName || m.unnamedDevice}
                              {online ? (
                                <span className="ms-2 inline-flex items-center gap-1 text-[10px] text-green font-bold">
                                  <span className="h-1.5 w-1.5 rounded-full bg-green" />
                                  {m.online}
                                </span>
                              ) : null}
                            </p>
                            <p className="text-[11px] text-ink-soft mt-0.5 truncate" dir="ltr">
                              {d.ip || "—"} · {d.lastPath}
                            </p>
                          </div>
                          <div className="text-end shrink-0">
                            <p className="text-[11px] font-bold text-green tabular-nums">{d.requestCount}</p>
                            <p className="text-[10px] text-ink-soft">{fmtWhen(d.lastSeenAt, lang)}</p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : ips.length === 0 ? (
            <div className="p-6">
              <EmptyState title={m.emptyIpsTitle} note={m.emptyIpsNote} />
            </div>
          ) : (
            <ul className="divide-y divide-line max-h-[70vh] overflow-y-auto">
              {ips.map((row) => (
                <li key={row.ip}>
                  <button
                    type="button"
                    onClick={() => {
                      setTab("devices");
                      setQ(row.ip);
                      setNamedOnly(false);
                    }}
                    className="w-full text-start px-4 py-3 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-ink" dir="ltr">
                          {row.ip}
                        </p>
                        <p className="text-[11px] text-ink-soft mt-0.5">
                          {m.ipDevices}: {row.devices} · {m.ipDays}: {row.days}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-green tabular-nums">{row.hits}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {tab === "devices" ? (
            <p className="px-4 py-2 text-[11px] text-ink-soft border-t border-line">
              {total} {m.devicesShown}
            </p>
          ) : null}
        </div>

        <div className="bg-white rounded-2xl border border-line p-4 min-h-[20rem]">
          {!detail ? (
            <div className="h-full flex items-center justify-center text-sm text-ink-soft px-4 text-center">
              {m.selectDevice}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-bold text-green">
                  {detail.device.displayName || m.unnamedDevice}
                </h2>
                <p className="text-xs text-ink-soft mt-1" dir="ltr">
                  {detail.device.visitorId}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-2 text-xs">
                <Info label={m.fieldIp} value={detail.device.ip || "—"} ltr />
                <Info label={m.fieldPath} value={detail.device.lastPath} ltr />
                <Info label={m.fieldPlatform} value={detail.device.platform || "—"} />
                <Info label={m.fieldScreen} value={detail.device.screen || "—"} ltr />
                <Info label={m.fieldTimezone} value={detail.device.timezone || "—"} />
                <Info label={m.fieldLanguage} value={detail.device.language || "—"} />
                <Info label={m.fieldRequests} value={String(detail.device.requestCount)} />
                <Info
                  label={m.fieldNameLocked}
                  value={detail.device.nameLocked ? m.yes : m.no}
                />
                <Info label={m.fieldFirstSeen} value={fmtWhen(detail.device.firstSeenAt, lang)} />
                <Info label={m.fieldLastSeen} value={fmtWhen(detail.device.lastSeenAt, lang)} />
              </dl>

              {detail.device.userAgent ? (
                <p className="text-[11px] text-ink-soft break-all leading-relaxed" dir="ltr">
                  {detail.device.userAgent}
                </p>
              ) : null}

              <div className="rounded-xl border border-line p-3">
                <label className="text-[11px] font-bold text-ink-soft block mb-1.5">{m.assignName}</label>
                <div className="flex gap-2">
                  <input
                    className="h-10 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={80}
                    placeholder={m.namePlaceholder}
                  />
                  <button
                    type="button"
                    onClick={() => void saveName()}
                    className="h-10 px-4 rounded-full bg-green text-white text-xs font-bold"
                  >
                    {m.saveName}
                  </button>
                </div>
              </div>

              {detail.siblingDevices.length > 0 ? (
                <div>
                  <h3 className="text-sm font-bold text-green mb-2">{m.sameIpDevices}</h3>
                  <ul className="space-y-1.5">
                    {detail.siblingDevices.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(s.id)}
                          className="w-full text-start rounded-xl border border-line px-3 py-2 text-xs hover:border-gold/40"
                        >
                          <span className="font-bold">{s.displayName || m.unnamedDevice}</span>
                          <span className="text-ink-soft ms-2">{s.requestCount} · {s.lastPath}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <h3 className="text-sm font-bold text-green mb-2">{m.recentRequests}</h3>
                {detail.events.length === 0 ? (
                  <p className="text-xs text-ink-soft">{m.noEvents}</p>
                ) : (
                  <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                    {detail.events.map((ev) => (
                      <li
                        key={ev.id}
                        className="rounded-xl bg-surface-2 px-3 py-2 text-[11px] flex justify-between gap-2"
                      >
                        <span className="font-bold text-ink truncate" dir="ltr">
                          {ev.path}
                        </span>
                        <span className="text-ink-soft shrink-0">{fmtWhen(ev.createdAt, lang)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-line p-4">
      <small className="block text-[11px] text-ink-soft leading-snug">{label}</small>
      <b className={`block mt-2 text-2xl tracking-tight ${accent ? "text-green" : "text-green"}`}>{value}</b>
    </div>
  );
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <dt className="text-[10px] text-ink-soft font-bold">{label}</dt>
      <dd className="text-ink font-bold mt-0.5 break-all" dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}
