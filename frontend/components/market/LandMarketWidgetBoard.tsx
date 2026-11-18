"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import DraggableWidgetGrid, {
  type WidgetItem,
  type WidgetSize,
} from "@/components/ui/draggable-widget-grid";
import { AseTradingViewChart } from "@/components/market/AseTradingViewChart";
import { useLanguage } from "@/lib/LanguageProvider";
import {
  chartLabel,
  kpiDisplay,
  kpiHint,
  kpiLabel,
  type LandChartPoint,
  type LandMarketSnapshot,
} from "@/lib/marketIntelligence";

const GREEN = "#0f342f";
const GOLD = "#c89a58";
const TEAL = "#2a6f66";
const LAYOUT_KEY = "alshantaf-land-market-widgets-v5";

type Kind =
  | "lands_5y"
  | "yearly"
  | "industrial"
  | "general"
  | "breakdown"
  | "governorates"
  | "qoq"
  | "dls"
  | "platform"
  | "ase_re"
  | "ase_construction"
  | "ase_levels"
  | "ase_tickers"
  | "ase_chart";

type DailyRange = "5D" | "1W" | "1M" | "3M" | "6M" | "MAX";

const DAILY_RANGES: Array<{ id: DailyRange; days: number | null; label: string; labelAr: string }> = [
  { id: "5D", days: 5, label: "5D", labelAr: "٥ي" },
  { id: "1W", days: 7, label: "1W", labelAr: "١أ" },
  { id: "1M", days: 22, label: "1M", labelAr: "١ش" },
  { id: "3M", days: 66, label: "3M", labelAr: "٣ش" },
  { id: "6M", days: 132, label: "6M", labelAr: "٦ش" },
  { id: "MAX", days: null, label: "Max", labelAr: "الكل" },
];

function sliceDaily(points: LandChartPoint[], range: DailyRange) {
  const def = DAILY_RANGES.find((r) => r.id === range);
  if (!def?.days) return points;
  return points.slice(-def.days);
}

interface MarketWidget extends WidgetItem {
  kind: Kind;
}

function Sparkline({
  points,
  color = GREEN,
  label,
}: {
  points: LandChartPoint[];
  color?: string;
  label: string;
}) {
  if (points.length < 2) return null;
  const w = 320;
  const h = 72;
  const pad = 4;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (p.value - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = `M${coords.join(" L")}`;
  const area = `${d} L${w - pad},${h - pad} L${pad},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-auto w-full h-16 sm:h-20" role="img" aria-label={label}>
      <defs>
        <linearGradient id="mkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.35" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#mkFill)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MiniBars({
  points,
  lang,
  color = GREEN,
}: {
  points: LandChartPoint[];
  lang: "ar" | "en";
  color?: string;
}) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="mt-auto flex items-end gap-1 h-16 sm:h-20">
      {points.map((p) => (
        <div key={p.key} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-0.5">
          <div
            className="w-full max-w-[28px] rounded-t"
            style={{
              height: `${Math.max(8, (p.value / max) * 100)}%`,
              background: color,
            }}
            title={`${chartLabel(p, lang)}: ${p.value}`}
          />
          <span className="text-[8px] text-muted-foreground tabular-nums truncate w-full text-center">
            {p.key.length === 4 ? p.key.slice(2) : p.key.replace(/^\d{4}-/, "")}
          </span>
        </div>
      ))}
    </div>
  );
}

function RankList({
  points,
  lang,
  suffix,
}: {
  points: LandChartPoint[];
  lang: "ar" | "en";
  suffix?: string;
}) {
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  return (
    <ul className="mt-auto space-y-1.5 overflow-hidden">
      {points.slice(0, 6).map((p) => (
        <li key={p.key} className="text-[11px] sm:text-xs">
          <div className="mb-0.5 flex justify-between gap-2">
            <span className="truncate text-muted-foreground">{chartLabel(p, lang)}</span>
            <span className="tabular-nums font-semibold text-foreground shrink-0">
              {p.value.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO", { maximumFractionDigits: 1 })}
              {suffix ?? ""}
            </span>
          </div>
          <div className="h-1 rounded-full bg-foreground/8 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(Math.abs(p.value) / max) * 100}%`,
                background: p.value < 0 ? "#8b3a2a" : `linear-gradient(90deg, ${TEAL}, ${GREEN})`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Shell({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex h-full flex-col gap-2 p-3.5 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h3 className="truncate text-[10px] sm:text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
          {title}
        </h3>
        {meta && <span className="shrink-0 text-[10px] sm:text-[11px] text-muted-foreground">{meta}</span>}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

function Big({ children, unit }: { children: ReactNode; unit?: string }) {
  return (
    <p className="text-2xl sm:text-[28px] leading-none font-bold tracking-tight text-foreground tabular-nums">
      {children}
      {unit && <span className="ms-1 text-xs font-normal text-muted-foreground">{unit}</span>}
    </p>
  );
}

function pctDelta(points: LandChartPoint[]) {
  if (points.length < 2) return null;
  const a = points[0]!.value;
  const b = points[points.length - 1]!.value;
  if (!a) return null;
  return Math.round(((b - a) / a) * 1000) / 10;
}

function TimeframeChips({
  value,
  onChange,
  lang,
  available,
}: {
  value: DailyRange;
  onChange: (r: DailyRange) => void;
  lang: "ar" | "en";
  available: number;
}) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div
      className="flex flex-wrap gap-0.5"
      role="group"
      aria-label={lang === "ar" ? "الإطار الزمني" : "Timeframe"}
      onPointerDown={stop}
    >
      {DAILY_RANGES.filter((r) => r.days == null || available >= Math.min(5, r.days)).map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          onPointerDown={stop}
          className={`rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold tabular-nums transition-colors ${
            value === r.id
              ? "bg-green text-white"
              : "bg-foreground/[0.06] text-muted-foreground hover:bg-green/10 hover:text-green"
          }`}
        >
          {lang === "ar" ? r.labelAr : r.label}
        </button>
      ))}
    </div>
  );
}

/** ASE daily sector series with local timeframe control. */
function AseDailySeriesWidget({
  title,
  meta,
  points,
  color,
  lang,
  disclaimer,
}: {
  title: string;
  meta?: string;
  points: LandChartPoint[];
  color: string;
  lang: "ar" | "en";
  disclaimer?: string;
}) {
  const [range, setRange] = useState<DailyRange>("1M");
  const window = sliceDaily(points, range);
  const last = window.at(-1);
  const delta = pctDelta(window);
  const fmt = (n: number, digits = 1) =>
    n.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO", { maximumFractionDigits: digits });

  return (
    <Shell
      title={title}
      meta={
        <span className="flex flex-col items-end gap-1">
          {meta && <span>{meta}</span>}
          <TimeframeChips value={range} onChange={setRange} lang={lang} available={points.length} />
        </span>
      }
    >
      <Big>{last ? fmt(last.value, 0) : "—"}</Big>
      {delta != null && (
        <p className={`mt-1 text-xs tabular-nums ${delta >= 0 ? "text-green" : "text-[#8b3a2a]"}`}>
          {delta > 0 ? "+" : ""}
          {fmt(delta)}% · {range} · {lang === "ar" ? "يومي رسمي" : "official daily"}
        </p>
      )}
      <Sparkline
        points={window}
        color={color}
        label={`${title} ${range}`}
      />
      <p className="mt-1 text-[9px] text-muted-foreground tabular-nums" dir="ltr">
        {window[0]?.key ?? ""} → {window.at(-1)?.key ?? ""} · {window.length} pts
      </p>
      {disclaimer && (
        <p className="mt-1 text-[9px] text-muted-foreground line-clamp-2">{disclaimer}</p>
      )}
    </Shell>
  );
}

function loadOrder(defaults: MarketWidget[]): MarketWidget[] {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return defaults;
    const ids = JSON.parse(raw) as string[];
    if (!Array.isArray(ids)) return defaults;
    const byId = new Map(defaults.map((w) => [w.id, w]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as MarketWidget[];
    for (const w of defaults) if (!ordered.some((o) => o.id === w.id)) ordered.push(w);
    return ordered;
  } catch {
    return defaults;
  }
}

export function LandMarketWidgetBoard({ snapshot }: { snapshot: LandMarketSnapshot }) {
  const { lang, dir, t } = useLanguage();
  const national = snapshot.national;
  const ase = snapshot.ase;
  const dls = snapshot.dlsRates ?? { kpis: [], byArea: [] };
  const platform = snapshot.platform ?? {
    offerCount: 0,
    updatedAt: "",
    kpis: [],
    charts: { byArea: [], byStatus: [], byDeal: [], listingsByMonth: [] },
  };
  const nCharts = national?.charts;

  const defaults = useMemo(() => {
    const items: MarketWidget[] = [];
    if (nCharts?.landsTrend?.length) {
      items.push({
        id: "lands_5y",
        kind: "lands_5y",
        size: "wide",
        label: lang === "ar" ? "مؤشر الأراضي — ٥ سنوات" : "Land index — 5 years",
      });
    }
    if (nCharts?.landsYearly?.length) {
      items.push({
        id: "yearly",
        kind: "yearly",
        size: "wide",
        label: lang === "ar" ? "متوسط سنوي للأراضي" : "Yearly land average",
      });
    }
    if (nCharts?.industrialTrend?.length) {
      items.push({
        id: "industrial",
        kind: "industrial",
        size: "sm",
        label: lang === "ar" ? "أراضي صناعية" : "Industrial land",
      });
    }
    if (nCharts?.generalTrend?.length) {
      items.push({
        id: "general",
        kind: "general",
        size: "sm",
        label: lang === "ar" ? "المؤشر العام" : "General index",
      });
    }
    if (nCharts?.landsBreakdown?.length) {
      items.push({
        id: "breakdown",
        kind: "breakdown",
        size: "wide",
        label: lang === "ar" ? "تصنيف الأراضي" : "Land categories",
      });
    }
    if (nCharts?.byGovernorate?.length) {
      items.push({
        id: "governorates",
        kind: "governorates",
        size: "wide",
        label: lang === "ar" ? "المحافظات" : "Governorates",
      });
    }
    if (nCharts?.qoqByType?.length) {
      items.push({
        id: "qoq",
        kind: "qoq",
        size: "sm",
        label: lang === "ar" ? "تغيّر ربعي" : "Quarterly change",
      });
    }
    if ((dls.kpis?.length ?? 0) || (dls.byArea?.length ?? 0)) {
      items.push({
        id: "dls",
        kind: "dls",
        size: "sm",
        label: lang === "ar" ? "القيمة الإدارية" : "DLS admin rate",
      });
    }
    if (ase?.charts?.realEstateTrend?.length) {
      items.push({
        id: "ase_re",
        kind: "ase_re",
        size: "wide",
        label: lang === "ar" ? "بورصة عمّان — قطاع العقارات" : "ASE — real-estate sector",
      });
    }
    if (ase?.charts?.constructionTrend?.length) {
      items.push({
        id: "ase_construction",
        kind: "ase_construction",
        size: "sm",
        label: lang === "ar" ? "بورصة — الإنشاءات" : "ASE — construction",
      });
    }
    if (ase?.charts?.latestLevels?.length) {
      items.push({
        id: "ase_levels",
        kind: "ase_levels",
        size: "sm",
        label: lang === "ar" ? "مؤشرات قطاعات البورصة" : "ASE sector levels",
      });
    }
    if (ase?.tickers?.length) {
      items.push({
        id: "ase_tickers",
        kind: "ase_tickers",
        size: "wide",
        label: lang === "ar" ? "أسهم مرتبطة بالعقار" : "RE-linked ASE tickers",
      });
      items.push({
        id: "ase_chart",
        kind: "ase_chart",
        size: "lg",
        label: lang === "ar" ? "أزواج بورصة عمّان — يومي" : "ASE sector pairs — daily",
      });
    }
    if ((platform.offerCount ?? 0) > 0) {
      items.push({
        id: "platform",
        kind: "platform",
        size: "wide",
        label: lang === "ar" ? "نشاط المنصة" : "Platform activity",
      });
    }
    return items;
  }, [nCharts, ase, dls, platform.offerCount, lang]);

  const [items, setItems] = useState<MarketWidget[] | null>(null);
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    setItems(loadOrder(defaults));
    setMountKey((k) => k + 1);
  }, [defaults]);

  const onChange = useCallback((next: WidgetItem[]) => {
    setItems(next as MarketWidget[]);
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(next.map((w) => w.id)));
    } catch {
      /* ignore */
    }
  }, []);

  const fmt = (n: number, digits = 1) =>
    n.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO", { maximumFractionDigits: digits });

  const period = national?.source.period;
  const windowNote =
    lang === "ar"
      ? (national?.window?.labelAr ?? "آخر ٥ سنوات متاحة من المؤشر الربعي")
      : (national?.window?.labelEn ?? "Last 5 years of available quarterly REPI");

  const renderItem = (item: WidgetItem, _size: WidgetSize) => {
    const kind = (item as MarketWidget).kind;
    const charts = national?.charts;

    if (kind === "lands_5y" && charts?.landsTrend?.length) {
      const trend = charts.landsTrend;
      const delta = pctDelta(trend);
      const last = trend[trend.length - 1];
      return (
        <Shell
          title={lang === "ar" ? "مؤشر الأراضي" : "Land price index"}
          meta={period ? `REPI ${period}` : "5y"}
        >
          <Big unit={lang === "ar" ? "أساس ٢٠١٢" : "base 2012"}>
            {last ? fmt(last.value) : "—"}
          </Big>
          {delta != null && (
            <p className={`mt-1 text-xs tabular-nums ${delta >= 0 ? "text-green" : "text-[#8b3a2a]"}`}>
              {delta > 0 ? "+" : ""}
              {fmt(delta)}% · {windowNote}
            </p>
          )}
          <Sparkline
            points={trend}
            color={GREEN}
            label={lang === "ar" ? "اتجاه مؤشر الأراضي لخمس سنوات" : "Five-year land index trend"}
          />
          <p className="mt-1 text-[9px] text-muted-foreground tabular-nums" dir="ltr">
            {trend[0]?.key} → {trend.at(-1)?.key}
          </p>
        </Shell>
      );
    }

    if (kind === "yearly" && charts?.landsYearly?.length) {
      return (
        <Shell title={lang === "ar" ? "متوسط سنوي — أراضي" : "Yearly average — lands"} meta="5y">
          <Big>{charts.landsYearly.at(-1) ? fmt(charts.landsYearly.at(-1)!.value) : "—"}</Big>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {lang === "ar" ? "متوسط فصول كل سنة من نشرة REPI" : "Mean of quarters in each REPI year"}
          </p>
          <MiniBars points={charts.landsYearly} lang={lang} color={GOLD} />
        </Shell>
      );
    }

    if (kind === "industrial" && charts?.industrialTrend?.length) {
      const delta = pctDelta(charts.industrialTrend);
      const last = charts.industrialTrend.at(-1);
      return (
        <Shell title={lang === "ar" ? "أراضي صناعية" : "Industrial land"} meta="5y">
          <Big>{last ? fmt(last.value) : "—"}</Big>
          {delta != null && (
            <p className={`mt-1 text-xs tabular-nums ${delta >= 0 ? "text-green" : "text-[#8b3a2a]"}`}>
              {delta > 0 ? "+" : ""}
              {fmt(delta)}%
            </p>
          )}
          <Sparkline points={charts.industrialTrend} color={GOLD} label="Industrial land 5y" />
        </Shell>
      );
    }

    if (kind === "general" && charts?.generalTrend?.length) {
      const delta = pctDelta(charts.generalTrend);
      const last = charts.generalTrend.at(-1);
      return (
        <Shell title={lang === "ar" ? "المؤشر العام" : "General index"} meta="5y">
          <Big>{last ? fmt(last.value) : "—"}</Big>
          {delta != null && (
            <p className={`mt-1 text-xs tabular-nums ${delta >= 0 ? "text-green" : "text-[#8b3a2a]"}`}>
              {delta > 0 ? "+" : ""}
              {fmt(delta)}%
            </p>
          )}
          <Sparkline points={charts.generalTrend} color={TEAL} label="General REPI 5y" />
        </Shell>
      );
    }

    if (kind === "breakdown" && charts?.landsBreakdown) {
      const breakdown = charts.landsBreakdown.filter((p) => !p.key.includes("residential"));
      return (
        <Shell title={lang === "ar" ? "تصنيف الأراضي" : "Land categories"} meta={period ?? undefined}>
          <RankList points={breakdown} lang={lang} />
        </Shell>
      );
    }

    if (kind === "governorates" && charts?.byGovernorate) {
      return (
        <Shell title={lang === "ar" ? "المؤشر حسب المحافظة" : "Index by governorate"} meta={period ?? undefined}>
          <RankList points={charts.byGovernorate} lang={lang} />
        </Shell>
      );
    }

    if (kind === "qoq" && charts?.qoqByType) {
      return (
        <Shell title={lang === "ar" ? "تغيّر ربعي" : "QoQ change"} meta={period ?? undefined}>
          <RankList points={charts.qoqByType} lang={lang} suffix="%" />
        </Shell>
      );
    }

    if (kind === "dls") {
      const med = (dls.kpis ?? []).find((k) => k.key === "dls_median_rate");
      return (
        <Shell title={lang === "ar" ? "القيمة الإدارية" : "DLS admin rate"}>
          <Big unit={lang === "ar" ? "د/م²" : "JOD/m²"}>
            {med ? kpiDisplay(med, lang).replace(/\s*(د\/م²|JOD\/m²)/, "") : "—"}
          </Big>
          {med && kpiHint(med, lang) && (
            <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{kpiHint(med, lang)}</p>
          )}
          {(dls.byArea?.length ?? 0) > 0 && <RankList points={dls.byArea.slice(0, 4)} lang={lang} />}
        </Shell>
      );
    }

    if (kind === "platform") {
      const top = (platform.kpis ?? []).slice(0, 3);
      return (
        <Shell
          title={lang === "ar" ? "على منصة الشنتف" : "On Alshantaf"}
          meta={`${platform.offerCount ?? 0} ${lang === "ar" ? "عرض" : "offers"}`}
        >
          <div className="grid grid-cols-3 gap-2">
            {top.map((k) => (
              <div key={k.key}>
                <p className="text-[9px] text-muted-foreground line-clamp-2">{kpiLabel(k, lang)}</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{kpiDisplay(k, lang)}</p>
              </div>
            ))}
          </div>
          {(platform.charts?.byArea?.length ?? 0) > 0 && (
            <RankList points={platform.charts.byArea.slice(0, 5)} lang={lang} />
          )}
        </Shell>
      );
    }

    if (kind === "ase_re" && ase?.charts?.realEstateTrend) {
      return (
        <AseDailySeriesWidget
          title={lang === "ar" ? "بورصة عمّان — العقارات" : "ASE — real estate"}
          meta={lang === "ar" ? "أسهم ≠ أراضي" : "equities ≠ land"}
          points={ase.charts.realEstateTrend}
          color={GOLD}
          lang={lang}
          disclaimer={lang === "ar" ? ase.source?.disclaimerAr : ase.source?.disclaimerEn}
        />
      );
    }

    if (kind === "ase_construction" && ase?.charts?.constructionTrend) {
      return (
        <AseDailySeriesWidget
          title={lang === "ar" ? "الإنشاءات (بورصة)" : "Construction (ASE)"}
          meta="equity"
          points={ase.charts.constructionTrend}
          color={TEAL}
          lang={lang}
        />
      );
    }

    if (kind === "ase_chart" && ase?.charts) {
      const pairs = [
        {
          id: "ase_real_estate",
          labelEn: "ASE Real Estate",
          labelAr: "بورصة عمّان — العقارات",
          color: GOLD,
          points: ase.charts.realEstateTrend ?? [],
        },
        {
          id: "ase_construction",
          labelEn: "ASE Engineering & Construction",
          labelAr: "بورصة عمّان — الإنشاءات",
          color: TEAL,
          points: ase.charts.constructionTrend ?? [],
        },
        {
          id: "ase_finance",
          labelEn: "ASE Diversified Financial Services",
          labelAr: "بورصة عمّان — خدمات مالية متنوعة",
          color: "#5a7d74",
          points: ase.charts.financeTrend ?? [],
        },
        {
          id: "ase_general",
          labelEn: "ASE General Index",
          labelAr: "المؤشر العام لبورصة عمّان",
          color: GREEN,
          points: ase.charts.generalTrend ?? [],
        },
      ].filter((p) => p.points.length >= 2);
      return <AseTradingViewChart pairs={pairs} lang={lang} />;
    }

    if (kind === "ase_levels" && ase?.charts?.latestLevels) {
      return (
        <Shell title={lang === "ar" ? "قطاعات البورصة" : "ASE sectors"} meta="index">
          <RankList points={ase.charts.latestLevels} lang={lang} />
        </Shell>
      );
    }

    if (kind === "ase_tickers" && ase?.tickers?.length) {
      return (
        <Shell
          title={lang === "ar" ? "رموز ASE عقارية (رسمية)" : "Official ASE RE tickers"}
          meta={lang === "ar" ? "ليست على TradingView" : "not on TradingView"}
        >
          <p className="text-[10px] text-muted-foreground leading-snug mb-2">
            {lang === "ar"
              ? "رموز مدرجة في بورصة عمّان — TradingView لا يدعمها. المخطط اليومي يستخدم مؤشرات القطاعات الرسمية."
              : "ASE-listed symbols — TradingView does not list them. The daily chart uses official sector indices."}
          </p>
          <ul className="mt-auto space-y-1.5 overflow-hidden text-[11px] sm:text-xs">
            {ase.tickers.slice(0, 8).map((tk) => (
              <li key={tk.symbol} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate">
                  <span className="font-bold tabular-nums text-foreground" dir="ltr">
                    {tk.symbol}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {lang === "ar" ? tk.nameAr : tk.nameEn}
                  </span>
                </span>
                <a
                  href={tk.aseSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-green font-semibold hover:underline"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  ASE
                </a>
              </li>
            ))}
          </ul>
        </Shell>
      );
    }

    return (
      <Shell title={item.label ?? item.id}>
        <p className="text-sm text-muted-foreground">—</p>
      </Shell>
    );
  };

  if (defaults.length === 0 || !items) return null;

  return (
    <div>
      <p className="mb-3 text-xs sm:text-sm text-ink-soft">
        <span className="[@media(pointer:coarse)]:hidden">{t.landMarket.dragHint}</span>
        <span className="hidden [@media(pointer:coarse)]:inline">{t.landMarket.dragHintTouch}</span>
        {period && (
          <span className="ms-1 text-ink-soft/70" dir="ltr">
            · REPI → {period}
          </span>
        )}
      </p>
      <DraggableWidgetGrid
        key={mountKey}
        items={items}
        onChange={onChange}
        renderItem={renderItem}
        editable
        maxColumns={4}
        cellSize={200}
        gap={12}
        radius={20}
        contentDir={dir}
      />
    </div>
  );
}
