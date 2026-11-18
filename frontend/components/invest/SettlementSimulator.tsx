"use client";

import { useState } from "react";
import { investApi, type InvestOwnershipSlice, type InvestSimulationResult } from "@/lib/investApi";
import { ApiError } from "@/lib/api";
import { Spinner } from "@/components/admin/EmptyState";
import { Money } from "./Money";
import { OwnershipChart } from "./OwnershipChart";

const inputClass =
  "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";

function normalizeAllocationSlices(
  allocations: InvestSimulationResult["allocations"]
): InvestOwnershipSlice[] | undefined {
  if (!Array.isArray(allocations)) return undefined;
  const out: InvestOwnershipSlice[] = [];
  for (const row of allocations) {
    if (typeof row !== "object" || row === null || !("label" in row)) continue;
    const label = (row as { label: unknown }).label;
    if (typeof label !== "string" || !label) continue;
    out.push(row as InvestOwnershipSlice);
  }
  return out.length ? out : undefined;
}

export function SettlementSimulator({ projectId }: { projectId: string }) {
  const [exitValue, setExitValue] = useState("");
  const [discountRate, setDiscountRate] = useState("");
  const [holdingMonths, setHoldingMonths] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<InvestSimulationResult | null>(null);

  async function runSimulation(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const payload = {
        saleProceeds: exitValue.trim() ? exitValue.trim() : null,
        exitValue: exitValue.trim() ? exitValue.trim() : null,
        closingCosts: null as string | null,
        discountRate: discountRate.trim() ? discountRate.trim() : null,
        unpaidLiabilities: holdingMonths.trim() ? holdingMonths.trim() : null,
        notes: notes.trim() || null,
      };
      const res = await investApi.simulateSettlement(projectId, payload);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Simulation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={runSimulation} className="rounded-xl border border-line bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-green">Settlement simulator · محاكي التوزيع</h3>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
            Hypothetical · افتراضي
          </span>
        </div>
        <p className="text-xs text-ink-soft">
          Inputs are sent to the API only. Results are labeled hypothetical and must not be used as finalized
          financial statements.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-ink-soft block mb-1">
              Sale proceeds · حصيلة البيع
            </label>
            <input
              className={inputClass}
              inputMode="decimal"
              value={exitValue}
              onChange={(e) => setExitValue(e.target.value)}
              placeholder="960000"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-ink-soft block mb-1">
              Closing costs % · تكاليف الإغلاق %
            </label>
            <input
              className={inputClass}
              inputMode="decimal"
              value={discountRate}
              onChange={(e) => setDiscountRate(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-ink-soft block mb-1">
              Extra liabilities · التزامات إضافية
            </label>
            <input
              className={inputClass}
              inputMode="decimal"
              value={holdingMonths}
              onChange={(e) => setHoldingMonths(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-ink-soft block mb-1">Notes</label>
          <textarea
            className={`${inputClass} h-20 py-2 resize-y`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-600 font-medium">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="h-11 px-5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-60 inline-flex items-center gap-2"
        >
          {busy ? <Spinner className="w-4 h-4" /> : null}
          Run simulation · تشغيل
        </button>
      </form>

      {result ? (
        <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-4 space-y-4">
          <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">
            Hypothetical results — not finalized · نتائج افتراضية
          </p>
          {result.summary ? (
            <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(result.summary).map(([key, val]) => (
                <div key={key} className="rounded-lg bg-white border border-line px-3 py-2">
                  <dt className="text-[11px] font-bold text-ink-soft uppercase">{key}</dt>
                  <dd className="mt-1">
                    <Money value={val} showFinalizedBadge />
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-ink-soft">No summary returned by API.</p>
          )}
          {result.warnings?.length ? (
            <ul className="text-xs text-amber-900 list-disc ps-5 space-y-1">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          <OwnershipChart
            slices={normalizeAllocationSlices(result.allocations)}
            emptyLabel="No allocation breakdown from API"
          />
        </div>
      ) : null}
    </div>
  );
}