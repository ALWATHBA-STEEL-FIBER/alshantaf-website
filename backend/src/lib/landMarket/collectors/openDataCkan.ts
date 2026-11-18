/**
 * Jordan Open Government Data (CKAN) — official datasets from DLS / related orgs.
 * API guide: https://opendata.gov.jo/en/api-guide/
 */

const CKAN = "https://opendata.gov.jo/api/3/action";

export type OpenDataResource = {
  title: string;
  titleAr?: string;
  organization: string;
  format: string;
  url: string;
  lastModified: string | null;
  packageName: string;
};

async function ckanPost<T>(action: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${CKAN}/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AlshantafMarketBot/1.0 (+https://alshantaf.com)",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; result?: T };
    if (!json.success || json.result == null) return null;
    return json.result;
  } catch (err) {
    console.warn(`[land-market] CKAN ${action} failed:`, err);
    return null;
  }
}

/** Discover machine-readable / recent DLS real-estate related resources. */
export async function fetchDlsOpenDataResources(): Promise<OpenDataResource[]> {
  const result = await ckanPost<{
    results: Array<{
      name: string;
      title?: string;
      title_ar?: string;
      organization?: { title?: string; display_name?: string };
      resources?: Array<{
        format?: string;
        url?: string;
        name?: string;
        last_modified?: string;
        metadata_modified?: string;
      }>;
    }>;
  }>("package_search", {
    q: "real estate OR عقاري OR أراضي OR lands",
    rows: 20,
    sort: "metadata_modified desc",
  });

  if (!result?.results?.length) return [];

  const out: OpenDataResource[] = [];
  for (const p of result.results) {
    const org = p.organization?.display_name || p.organization?.title || "";
    for (const r of p.resources ?? []) {
      const fmt = (r.format || "").toUpperCase();
      if (!r.url) continue;
      // Prefer spreadsheets/CSV; keep recent PDF newsletters as source links only if spreadsheet absent.
      if (!["XLS", "XLSX", "CSV", "JSON", "PDF"].includes(fmt)) continue;
      out.push({
        title: r.name || p.title || p.name,
        titleAr: p.title_ar,
        organization: org,
        format: fmt,
        url: r.url,
        lastModified: r.last_modified || r.metadata_modified || null,
        packageName: p.name,
      });
    }
  }

  // Prefer DLS org + spreadsheet formats first.
  return out
    .sort((a, b) => {
      const score = (x: OpenDataResource) =>
        ( /land|مساحة|dls/i.test(x.organization) ? 10 : 0) +
        (["XLSX", "XLS", "CSV"].includes(x.format) ? 5 : 0);
      return score(b) - score(a);
    })
    .slice(0, 12);
}
