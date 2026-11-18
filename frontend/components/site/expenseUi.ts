export function jod(value: string | number | null | undefined, opts?: { decimals?: boolean }) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: opts?.decimals === false ? 0 : 3,
  });
}

export const AR_MONTH_NAMES = [
  "كانون الثاني",
  "شباط",
  "آذار",
  "نيسان",
  "أيار",
  "حزيران",
  "تموز",
  "آب",
  "أيلول",
  "تشرين الأول",
  "تشرين الثاني",
  "كانون الأول",
];

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${AR_MONTH_NAMES[(m || 1) - 1]} ${y}`;
}

/** First/last day of a YYYY-MM month. */
export function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function dayHeading(iso: string, today: string) {
  if (iso === today) return "اليوم";
  const t = new Date(`${today}T00:00:00Z`).getTime();
  const d = new Date(`${iso}T00:00:00Z`);
  if (t - d.getTime() === 86400000) return "أمس";
  return `${DAY_NAMES[d.getUTCDay()]} ${iso}`;
}

/** Stable accent per category key so chips/bars read consistently. */
export const CATEGORY_COLORS: Record<string, string> = {
  materials: "#0f342f",
  equipment: "#2f6b5f",
  fuel: "#b4561f",
  transport: "#6a5acd",
  subcontractor: "#8b3a62",
  daily_labor: "#c08a1e",
  tools: "#4b7f9c",
  permits: "#7a6a3a",
  maintenance: "#5f7f3f",
  food: "#c0504d",
  utilities: "#3f7fbf",
  rent: "#7f5f9f",
  salaries: "#a0522d",
  office: "#5a6b66",
  vehicles: "#2e5e8c",
  other: "#8a958f",
};

export function categoryColor(key: string) {
  return CATEGORY_COLORS[key] || "#8a958f";
}

export const CATEGORY_ICONS: Record<string, string> = {
  materials: "🧱",
  equipment: "🚜",
  fuel: "⛽",
  transport: "🚚",
  subcontractor: "👷",
  daily_labor: "🧑‍🔧",
  tools: "🔧",
  permits: "📄",
  maintenance: "🛠️",
  food: "🍽️",
  utilities: "💡",
  rent: "🏠",
  salaries: "💵",
  office: "🗂️",
  vehicles: "🚗",
  other: "•",
};

export function categoryIcon(key: string) {
  return CATEGORY_ICONS[key] || "•";
}
