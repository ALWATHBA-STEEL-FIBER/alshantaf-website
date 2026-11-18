"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { api } from "@/lib/api";
import { AuditRow } from "./AuditRow";
import { EmptyState, SkeletonBlock } from "./EmptyState";
import { ViewsBarChart } from "@/components/market/MarketCharts";
import {
  FolderIcon,
  HardDriveIcon,
  HomeIcon,
  InboxIcon,
  ListingsIcon,
  MapCheckIcon,
  MessageIcon,
  MonitorIcon,
  SettingsIcon,
  ShieldIcon,
} from "@/components/icons";
import type { DashboardData } from "@/lib/types";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function StatCard({
  label,
  value,
  href,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  href?: string;
  icon?: React.ReactNode;
  accent?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <small className="block text-[11px] text-ink-soft leading-snug">{label}</small>
        {icon && <span className={`shrink-0 ${accent ?? "text-green"}`}>{icon}</span>}
      </div>
      <b className="block mt-2 text-2xl text-green tracking-tight">{value}</b>
    </>
  );
  const className =
    "bg-white rounded-2xl border border-line p-4 transition-all hover:border-gold/40 hover:shadow-[0_16px_36px_-28px_rgba(15,52,47,0.45)]";
  if (href) {
    return (
      <Link href={href} className={`${className} block`}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

const QUICK_LINKS = [
  { href: "/admin/listings", key: "listings" as const, icon: ListingsIcon },
  { href: "/admin/submissions", key: "submissions" as const, icon: InboxIcon },
  { href: "/admin/contact", key: "contact" as const, icon: MessageIcon },
  { href: "/admin/land-checks", key: "landChecks" as const, icon: MapCheckIcon },
  { href: "/admin/media", key: "media" as const, icon: FolderIcon },
  { href: "/admin/monitor", key: "monitor" as const, icon: MonitorIcon },
  { href: "/admin/security", key: "security" as const, icon: ShieldIcon },
  { href: "/admin/settings", key: "settings" as const, icon: SettingsIcon },
];

export function Dashboard() {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let ignore = false;
    api
      .dashboard()
      .then((d) => {
        if (!ignore) setData(d);
      })
      .catch(() => {
        if (!ignore) setError(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (error) {
    return <EmptyState title={t.admin.dashboardLoadErrorTitle} note={t.admin.dashboardLoadErrorNote} />;
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-8">
        <SkeletonBlock className="h-10 w-56" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-24" />
          ))}
        </div>
        <SkeletonBlock className="h-48" />
      </div>
    );
  }

  const pubKeys = ["published", "draft", "archived"] as const;
  const statusKeys = ["available", "reserved", "sold", "rented", "canceled"] as const;
  const hasAnyData =
    data.listings.total > 0 || data.submissions.total > 0 || data.contactRequests.total > 0 || data.landChecks.total > 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-gold text-xs font-bold tracking-wide">{t.admin.sidebar.dashboard}</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-green mt-1 flex items-center gap-2">
            <HomeIcon className="w-6 h-6" />
            {t.admin.dashboard}
          </h1>
          <p className="text-sm text-ink-soft mt-1">{t.admin.dashboardSubtitle}</p>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-bold text-ink-soft mb-3">{t.admin.quickNav}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 h-12 px-3 rounded-xl border border-line bg-white text-sm font-bold hover:border-gold/45 hover:text-green transition-colors"
              >
                <Icon className="w-4 h-4 text-gold shrink-0" />
                {t.admin.sidebar[item.key]}
              </Link>
            );
          })}
        </div>
      </section>

      {!hasAnyData && <EmptyState title={t.admin.emptyDashboardTitle} note={t.admin.emptyDashboardNote} />}

      {data.uniqueIps && (
        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-green flex items-center gap-2">
              <MonitorIcon className="w-4 h-4" />
              {t.admin.uniqueIpsTitle}
            </h2>
            <Link href="/admin/monitor" className="text-xs font-bold text-green hover:text-gold">
              {t.admin.sidebar.monitor} →
            </Link>
          </div>
          <p className="text-xs text-ink-soft mb-3">{t.admin.uniqueIpsNote}</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <StatCard label={t.admin.uniqueIps1d} value={data.uniqueIps.day1.uniqueIps} href="/admin/monitor" icon={<MonitorIcon />} />
            <StatCard label={t.admin.uniqueIps7d} value={data.uniqueIps.day7.uniqueIps} href="/admin/monitor" />
            <StatCard label={t.admin.uniqueIps30d} value={data.uniqueIps.day30.uniqueIps} href="/admin/monitor" />
          </div>
        </section>
      )}

      {data.siteViews && (
        <section>
          <h2 className="text-lg font-bold text-green mb-1">{t.admin.siteViewsTitle}</h2>
          <p className="text-xs text-ink-soft mb-3">{t.admin.siteViewsNote}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <ViewsBarChart
              label={`${t.admin.siteViews1d} · ${data.siteViews.day1.totalViews.toLocaleString()} ${t.admin.siteViewsUnit}`}
              points={data.siteViews.day1.points}
            />
            <ViewsBarChart
              label={`${t.admin.siteViews7d} · ${data.siteViews.day7.totalViews.toLocaleString()} ${t.admin.siteViewsUnit}`}
              points={data.siteViews.day7.points}
            />
            <ViewsBarChart
              label={`${t.admin.siteViews30d} · ${data.siteViews.day30.totalViews.toLocaleString()} ${t.admin.siteViewsUnit}`}
              points={data.siteViews.day30.points}
            />
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-green">{t.admin.totalListings}</h2>
          <Link href="/admin/listings" className="text-xs font-bold text-green hover:text-gold">
            {t.admin.viewAll} →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label={t.admin.totalListings} value={data.listings.total} href="/admin/listings" icon={<ListingsIcon />} />
          {pubKeys.map((key) => (
            <StatCard key={key} label={t.admin[key]} value={data.listings.byPublishStatus[key] ?? 0} href="/admin/listings" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
          {statusKeys.map((key) => (
            <StatCard key={key} label={t.admin[key]} value={data.listings.byStatus[key] ?? 0} href="/admin/listings" />
          ))}
        </div>
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-lg font-bold text-green">{t.admin.inboxOverview}</h2>
          <StatCard
            label={t.admin.pendingReview}
            value={data.submissions.byStatus.pending ?? 0}
            href="/admin/submissions"
            icon={<InboxIcon />}
            accent="text-amber-600"
          />
          <StatCard
            label={t.admin.contactNew}
            value={data.contactRequests.byStatus.new ?? 0}
            href="/admin/contact"
            icon={<MessageIcon />}
            accent="text-gold"
          />
          <StatCard
            label={t.admin.landCheckNew}
            value={data.landChecks.byStatus.new ?? 0}
            href="/admin/land-checks"
            icon={<MapCheckIcon />}
          />
        </div>
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-bold text-green">{t.admin.submissionsTitle}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label={t.admin.totalSubmissions} value={data.submissions.total} href="/admin/submissions" />
            <StatCard label={t.admin.approve} value={data.submissions.byStatus.approved ?? 0} href="/admin/submissions" />
            <StatCard label={t.admin.reject} value={data.submissions.byStatus.rejected ?? 0} href="/admin/submissions" />
            <StatCard label={t.admin.contactRequests} value={data.contactRequests.total} href="/admin/contact" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label={t.admin.storageUsed}
              value={`${formatBytes(data.storage.totalBytes)} · ${data.storage.fileCount} ${t.admin.files}`}
              href="/admin/media"
              icon={<HardDriveIcon />}
            />
            <StatCard label={t.admin.sidebar.landChecks} value={data.landChecks.total} href="/admin/land-checks" icon={<MapCheckIcon />} />
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-green flex items-center gap-2">
            <ShieldIcon className="w-4 h-4" />
            {t.admin.recentActivity}
          </h2>
          <Link href="/admin/security" className="text-xs font-bold text-green hover:text-gold">
            {t.admin.security} →
          </Link>
        </div>
        {data.recentAudit.length === 0 ? (
          <EmptyState title={t.admin.noActivity} note={t.admin.noActivityAdminNote} />
        ) : (
          <div className="bg-white rounded-2xl border border-line divide-y divide-line overflow-hidden">
            {data.recentAudit.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
