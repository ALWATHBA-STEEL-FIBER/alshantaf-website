import { chromium } from "playwright-core";
import { toWesternDigits } from "./arabicDigits";

/**
 * Looks up the official DLS "Administrative Value" (السعر الإداري) for a
 * parcel via the Department of Lands and Survey's own public tool:
 *   https://apex-dls.dls.gov.jo/ords/f?p=104:2
 * ("app-MANAGEPRCLVALUE104" — confirmed from the page's own HTML class).
 *
 * This is the exact same official, unauthenticated, CAPTCHA-free service
 * whose location dropdowns already back our own governorate/directorate/
 * village/basin/neighborhood cascade — verified live before building this.
 *
 * There is no JSON/REST endpoint: the final "عرض البيانات" search is a real
 * Oracle APEX page form submission whose result renders through an
 * Interactive Grid region that only populates via the page's own client-side
 * JS. Automating it with a real (headless) browser is the only reliable way
 * to consume it — a hand-rolled HTTP replay of the multi-step APEX protocol
 * was tested and works up to the search step, but the grid's own follow-up
 * fetch uses APEX's undocumented, version-specific Interactive Grid wire
 * format, which is too fragile to hand-maintain.
 *
 * The value returned here is a per-zone administrative RATE (confirmed by
 * querying two different parcel numbers in the same neighborhood/basin and
 * getting the identical figure back) — never a parcel-specific total, and
 * never a market price. Callers must label it "Official DLS Administrative
 * Value" and must not call it a market price or asking price.
 */

const DLS_VALUE_URL = "https://apex-dls.dls.gov.jo/ords/f?p=104:2";
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
const LOOKUP_TIMEOUT_MS = 25_000;
/** How long to wait for a post-search "Total N" row before treating the parcel as missing. */
const RESULT_TIMEOUT_MS = 12_000;

export interface DlsAdministrativeValueResult {
  value: number;
  currency: "JOD";
  /** Confirmed empirically to be a per-zone per-m² rate, not a parcel-specific total. */
  unit: "rate";
  source: "DLS Smart Land Plan";
  sourceUrl: string;
  retrievedAt: string;
}

export class DlsLookupError extends Error {}

export async function lookupDlsAdministrativeValue(params: {
  governorate: string;
  directorate: string;
  village: string;
  basin: string;
  neighborhood: string;
  parcelNumber: string;
}): Promise<DlsAdministrativeValueResult | null> {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(LOOKUP_TIMEOUT_MS);
    await page.goto(DLS_VALUE_URL, { waitUntil: "domcontentloaded" });

    await selectByVisibleLabel(page, "#DISTRECT_ANAME", params.governorate);
    await selectByVisibleLabel(page, "#DEPT_ANAME", params.directorate);
    await selectByVisibleLabel(page, "#VILL_ANAME", params.village);
    await selectByVisibleLabel(page, "#HOD_ANAME", params.basin);
    await selectByVisibleLabel(page, "#SECT_ANAME", params.neighborhood);
    await page.fill("#PRCL_NO", toWesternDigits(params.parcelNumber.trim()));

    const hadNoDataBefore = /لا يوجد بيانات/.test(await page.locator("body").innerText());
    await page.click("button:has-text('عرض البيانات')");

    // APEX usually answers within ~1–2s. Prefer a short settle so missing parcels
    // don't burn the full timeout; only keep waiting when neither outcome is clear.
    await page.waitForTimeout(1800);
    let bodyText = await page.locator("body").innerText();
    if (!/Total\s+\d+/.test(bodyText)) {
      // Only trust "no data" when it appeared after the search click — the empty
      // grid can already show that phrase before a search runs.
      if (/لا يوجد بيانات/.test(bodyText) && !hadNoDataBefore) return null;
      const found = await page
        .waitForFunction(
          () => {
            const text =
              (globalThis as { document?: { body?: { innerText?: string } } }).document?.body?.innerText ?? "";
            return /Total\s+\d+/.test(text);
          },
          null,
          { timeout: RESULT_TIMEOUT_MS }
        )
        .then(() => true)
        .catch(() => false);
      if (!found) return null;
      bodyText = await page.locator("body").innerText();
    }

    // Prefer the Interactive Grid cells when present; fall back to the
    // tab-separated body text layout DLS renders under "السعر الاداري".
    const gridCells = await page.locator('[role="gridcell"]').allTextContents().catch(() => [] as string[]);
    if (gridCells.length >= 5) {
      const rawValue = gridCells[gridCells.length - 1]?.trim() ?? "";
      const value = Number(rawValue.replace(/,/g, ""));
      if (rawValue && Number.isFinite(value)) {
        return {
          value,
          currency: "JOD",
          unit: "rate",
          source: "DLS Smart Land Plan",
          sourceUrl: DLS_VALUE_URL,
          retrievedAt: new Date().toISOString(),
        };
      }
    }

    const match = bodyText.match(/السعر الاداري\s*\n([^\n]+)\nTotal/);
    if (!match) return null;
    const cells = match[1].split("\t").map((c) => c.trim());
    const rawValue = cells[cells.length - 1];
    const value = Number(rawValue.replace(/,/g, ""));
    if (!rawValue || !Number.isFinite(value)) return null;

    return {
      value,
      currency: "JOD",
      unit: "rate",
      source: "DLS Smart Land Plan",
      sourceUrl: DLS_VALUE_URL,
      retrievedAt: new Date().toISOString(),
    };
  } catch (err) {
    throw new DlsLookupError(err instanceof Error ? err.message : "DLS lookup failed");
  } finally {
    await browser.close();
  }
}

async function selectByVisibleLabel(page: import("playwright-core").Page, selector: string, label: string) {
  try {
    await page.selectOption(selector, { label });
    // Cascade selects reload via APEX AJAX — give the next dropdown time to fill.
    await page.waitForTimeout(800);
  } catch {
    throw new DlsLookupError(`"${label}" is not an option in ${selector} — the DLS list may have changed`);
  }
}
