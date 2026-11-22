"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { crmApi, type CommissionRule, type DistributionResult } from "@/lib/investApi";
import { CommissionEditor } from "./CommissionEditor";
import { DistributionTable, WaterfallSummary } from "./DistributionTable";
import { PartnerPicker } from "./PartnerPicker";
import { Avatar, Card, ErrorNote, Field, MoneyInput, btnPrimary, fmt, fmtPct, inputCls, todayISO, toNum, useT } from "./ui";

type Row = { id: string; name: string; code: string | null; capital: string; cut: string };

export function NewProjectWizard() {
  const { t } = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [landLocation, setLandLocation] = useState("");
  const [plot, setPlot] = useState("");
  const [area, setArea] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [target, setTarget] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [coordId, setCoordId] = useState<string>("");
  const [rule, setRule] = useState<CommissionRule>({ basis: "investor_net_profit", percent: "10", fixedAmount: "" });
  const [shareLosses, setShareLosses] = useState(true);
  const [coordParticipates, setCoordParticipates] = useState(true);
  const [previewSale, setPreviewSale] = useState("");
  const [previewExpenses, setPreviewExpenses] = useState("");
  const [preview, setPreview] = useState<DistributionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [meId, setMeId] = useState("");

  // The admin coordinates by default: start with their own partner profile as coordinator.
  useEffect(() => {
    let ignore = false;
    crmApi
      .mePartner()
      .then((me) => {
        if (ignore) return;
        setMeId(me.id);
        setRows((rs) => (rs.some((r) => r.id === me.id) ? rs : [{ id: me.id, name: me.name, code: me.code, capital: "", cut: "" }, ...rs]));
        setCoordId((c) => c || me.id);
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  const totalCapital = rows.reduce((a, r) => a + (toNum(r.capital) ?? 0), 0);
  const price = toNum(purchasePrice);
  const fundedPct = price ? (totalCapital / price) * 100 : null;
  const sale = previewSale || target;

  const previewBody = useMemo(
    () => ({
      saleProceeds: sale,
      commissionRule: rule,
      shareLossesByOwnership: shareLosses,
      partners: rows.map((r) => ({
        id: r.id,
        label: r.name,
        capital: r.capital || 0,
        isCoordinator: r.id === coordId,
        commissionPercent: r.cut,
        expenses: r.id === coordId ? previewExpenses || 0 : 0,
      })),
    }),
    [sale, rule, shareLosses, rows, coordId, previewExpenses]
  );

  useEffect(() => {
    if (!rows.length || !(toNum(sale) ?? 0) || totalCapital <= 0) {
      setPreview(null);
      return;
    }
    let ignore = false;
    const id = setTimeout(() => {
      crmApi
        .preview(previewBody)
        .then((r) => !ignore && setPreview(r))
        .catch(() => !ignore && setPreview(null));
    }, 250);
    return () => {
      ignore = true;
      clearTimeout(id);
    };
  }, [previewBody, rows.length, sale, totalCapital]);

  function update(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function submit() {
    setError("");
    if (!name.trim()) return setError(t("اكتب اسم المشروع", "Enter a project name"));
    if (!rows.length) return setError(t("أضف شريكاً واحداً على الأقل", "Add at least one partner"));
    setBusy(true);
    try {
      const p = await crmApi.createProject({
        name,
        code: code || undefined,
        landLocation,
        plotParcelNo: plot,
        landAreaSqm: area || undefined,
        purchasePrice: purchasePrice || undefined,
        purchaseDate,
        targetSalePrice: target || undefined,
        description,
        commissionRule: rule,
        shareLossesByOwnership: shareLosses,
        coordinatorParticipatesInProfit: coordParticipates,
        partners: rows.map((r) => ({
          investorId: r.id,
          capital: r.capital || 0,
          isCoordinator: r.id === coordId,
          commissionPercent: r.cut === "" ? undefined : r.cut,
        })),
      });
      router.push(`/admin/invest/projects/${p.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("تعذّر إنشاء المشروع", "Could not create project"));
      setBusy(false);
    }
  }

  const perPartnerCut = rule.basis === "investor_net_profit";

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <Link href="/admin/invest/projects" className="text-xs font-bold text-ink-soft hover:text-green">
          ← {t("المشاريع", "Projects")}
        </Link>
        <h1 className="text-2xl font-extrabold text-green mt-1">{t("مشروع شراكة جديد", "New partnership project")}</h1>
        <p className="text-sm text-ink-soft mt-1">
          {t(
            "أدخل الأرض، اختر الشركاء ومبلغ كل واحد، وحدد نسبتك كمنسق — وشاهد التوزيع المتوقع مباشرة.",
            "Enter the land, pick partners and their amounts, set your coordinator cut — and see the expected split live."
          )}
        </p>
      </div>

      <Card title={`1 · ${t("الأرض والمشروع", "Land & project")}`}>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label={t("اسم المشروع *", "Project name *")} className="sm:col-span-2">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("مثال: أرض ناعور حوض 3", "e.g. Naour land basin 3")} />
          </Field>
          <Field label={t("رمز المشروع", "Code")} hint={t("يُولَّد تلقائياً إذا تُرك فارغاً", "Auto if empty")}>
            <input className={inputCls} dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </Field>
          <Field label={t("الموقع", "Location")}>
            <input className={inputCls} value={landLocation} onChange={(e) => setLandLocation(e.target.value)} />
          </Field>
          <Field label={t("رقم القطعة / الحوض", "Plot / basin")}>
            <input className={inputCls} value={plot} onChange={(e) => setPlot(e.target.value)} />
          </Field>
          <Field label={t("المساحة (م²)", "Area (m²)")}>
            <input className={inputCls} dir="ltr" inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value.replace(/[^0-9.]/g, ""))} />
          </Field>
          <Field label={t("سعر الشراء", "Purchase price")}>
            <MoneyInput value={purchasePrice} onChange={setPurchasePrice} />
          </Field>
          <Field label={t("تاريخ الشراء", "Purchase date")}>
            <input type="date" className={inputCls} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </Field>
          <Field label={t("سعر البيع المستهدف", "Target sale price")}>
            <MoneyInput value={target} onChange={setTarget} />
          </Field>
          <Field label={t("ملاحظات / اتفاق الشراكة", "Notes / agreement")} className="sm:col-span-3">
            <textarea className={`${inputCls} h-16 py-2`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card
        title={`2 · ${t("الشركاء ورأس المال", "Partners & capital")} (${rows.length})`}
        action={
          price ? (
            <div className="text-xs font-bold text-ink-soft">
              {fmt(totalCapital)} / {fmt(price)} JOD
              <span className={`ms-2 ${fundedPct! >= 100 ? "text-green" : "text-amber-700"}`}>{fmtPct(fundedPct, 1)}</span>
            </div>
          ) : null
        }
      >
        <PartnerPicker
          excludeIds={rows.map((r) => r.id)}
          onPick={(p) => {
            setRows((rs) => [...rs, { id: p.id, name: p.name, code: p.code, capital: "", cut: "" }]);
            if (!coordId) setCoordId(p.id);
          }}
        />
        {price ? (
          <div className="mt-3 h-2 rounded-full bg-surface-2 overflow-hidden">
            <div className={`h-full ${fundedPct! > 100 ? "bg-amber-500" : "bg-green"}`} style={{ width: `${Math.min(100, fundedPct ?? 0)}%` }} />
          </div>
        ) : null}
        {rows.length ? (
          <div className="mt-4 divide-y divide-line rounded-xl border border-line">
            {rows.map((r) => {
              const pct = totalCapital > 0 ? ((toNum(r.capital) ?? 0) / totalCapital) * 100 : 0;
              const isCoord = r.id === coordId;
              return (
                <div key={r.id} className={`flex flex-wrap items-center gap-3 p-3 ${isCoord ? "bg-gold/5" : ""}`}>
                  <div className="flex items-center gap-2 min-w-[180px] flex-1">
                    <Avatar name={r.name} coordinator={isCoord} />
                    <div className="min-w-0">
                      <div className="font-bold truncate">
                        {r.name}
                        {r.id === meId ? <span className="ms-1.5 text-[10px] font-bold text-gold bg-gold/10 rounded px-1.5 py-0.5">{t("أنت", "You")}</span> : null}
                      </div>
                      <div className="text-[11px] text-ink-soft">{r.code}</div>
                    </div>
                  </div>
                  <div className="w-40">
                    <MoneyInput value={r.capital} onChange={(v) => update(r.id, { capital: v })} placeholder={t("الدفعة الأولى", "Initial payment")} />
                  </div>
                  <div className="w-16 text-center">
                    <div className="text-[10px] text-ink-soft">{t("الحصة", "Share")}</div>
                    <div className="font-extrabold text-green tabular-nums">{fmtPct(pct, 1)}</div>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                    <input type="radio" name="coord" checked={isCoord} onChange={() => setCoordId(r.id)} className="accent-[var(--color-green)]" />
                    {t("المنسق", "Coordinator")}
                  </label>
                  {perPartnerCut ? (
                    <div className="w-28" title={t("اتركه فارغاً لاستخدام النسبة العامة", "Leave empty to use the default")}>
                      <div className="relative">
                        <input
                          className={`${inputCls} h-9 !pr-7 text-xs text-left`}
                          dir="ltr"
                          inputMode="decimal"
                          disabled={isCoord}
                          placeholder={isCoord ? "—" : `${rule.percent || 0}`}
                          value={isCoord ? "" : r.cut}
                          onChange={(e) => update(r.id, { cut: e.target.value.replace(/[^0-9.]/g, "") })}
                        />
                        <span className="absolute inset-y-0 right-2 flex items-center text-[11px] text-ink-soft pointer-events-none">%</span>
                      </div>
                      <div className="text-[10px] text-ink-soft mt-0.5">{t("خصم المنسق", "Coord. cut")}</div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="h-9 w-9 rounded-lg text-ink-soft hover:bg-red-50 hover:text-red-700"
                    onClick={() => {
                      setRows((rs) => rs.filter((x) => x.id !== r.id));
                      if (isCoord) setCoordId(rows.find((x) => x.id !== r.id)?.id ?? "");
                    }}
                    aria-label={t("إزالة", "Remove")}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">
            {t("ابحث عن الشركاء المسجّلين أو أضف شريكاً جديداً من نفس الخانة. الحصص تُحسب من المبالغ تلقائياً.", "Search registered partners or add a new one from the same box. Shares are calculated from amounts.")}
          </p>
        )}
      </Card>

      <Card title={`3 · ${t("حصة المنسق", "Coordinator cut")}`}>
        <CommissionEditor
          rule={rule}
          onChange={setRule}
          shareLosses={shareLosses}
          onShareLosses={setShareLosses}
          coordinatorParticipates={coordParticipates}
          onCoordinatorParticipates={setCoordParticipates}
        />
      </Card>

      <Card title={`4 · ${t("معاينة التوزيع عند البيع", "Payout preview at sale")}`}>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <Field label={t("سعر البيع المتوقع", "Expected sale price")}>
            <MoneyInput value={previewSale} onChange={setPreviewSale} placeholder={target || "0"} />
          </Field>
          <Field label={t("مصاريف متوقعة يدفعها المنسق (اختياري)", "Expected expenses paid by coordinator (optional)")} hint={t("للمعاينة فقط", "Preview only")}>
            <MoneyInput value={previewExpenses} onChange={setPreviewExpenses} />
          </Field>
        </div>
        {preview ? (
          <div className="space-y-4">
            <WaterfallSummary r={preview} />
            <DistributionTable lines={preview.lines} />
          </div>
        ) : (
          <p className="text-sm text-ink-soft">{t("أدخل الشركاء ومبالغهم وسعر البيع لرؤية التوزيع.", "Enter partners, amounts and a sale price to see the split.")}</p>
        )}
      </Card>

      <div className="sticky bottom-3 z-30 rounded-2xl border border-line bg-white/95 backdrop-blur px-4 py-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0 text-sm">
            <span className="font-extrabold text-green">{name || t("مشروع بدون اسم", "Untitled project")}</span>
            <span className="text-ink-soft">
              {" · "}
              {rows.length} {t("شركاء", "partners")} · {fmt(totalCapital)} JOD
            </span>
          </div>
          <ErrorNote message={error} />
          <button type="button" className={btnPrimary} disabled={busy} onClick={submit}>
            {busy ? "…" : t("إنشاء المشروع", "Create project")}
          </button>
        </div>
      </div>
    </div>
  );
}
