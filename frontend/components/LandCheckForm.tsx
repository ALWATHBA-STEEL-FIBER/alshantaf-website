"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { LocationCascade } from "@/components/LocationCascade";
import { LocationInput, type LocationInputHandle } from "@/components/LocationInput";
import { DlsPricingHint } from "@/components/DlsPricingHint";
import { RegulationGuide } from "@/components/RegulationGuide";
import { toWesternDigits } from "@/lib/arabicDigits";
import { adminMedianEstimate } from "@/lib/adminPricing";
import { parseCoords, coordsToString, formatDlsArea } from "@/lib/mapCoords";
import { loadDlsLocations, codesForSelection } from "@/lib/dlsLocations";
import { CheckIcon } from "@/components/icons";
import { useJourney } from "@/lib/journey/JourneyProvider";
import type { IndustryType } from "@/lib/types";

const inputClass =
  "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";
const labelClass = "text-xs font-bold text-ink-soft mb-1 block";
const DRAFT_KEY = "alshantaf_land_check_client_key";

function getOrCreateClientKey() {
  try {
    const existing = localStorage.getItem(DRAFT_KEY);
    if (existing && existing.length >= 8) return existing;
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `lc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DRAFT_KEY, next);
    return next;
  } catch {
    return `lc-${Date.now()}`;
  }
}

function clearClientKey() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function LandCheckForm() {
  const { t, lang } = useLanguage();
  const { state: journey, patch: patchJourney, hydrated: journeyHydrated } = useJourney();
  const clientKeyRef = useRef<string>("");
  const locationRef = useRef<LocationInputHandle>(null);
  const [blueprintReady, setBlueprintReady] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");
  const [fields, setFields] = useState({
    name: "",
    phone: "",
    email: "",
    governorate: "",
    directorate: "",
    village: "",
    basin: "",
    neighborhood: "",
    parcel: "",
    coordinates: "",
    address: "",
    areaLabel: "",
    notes: "",
  });
  const [industryType, setIndustryType] = useState<IndustryType | "">("");
  const [areaSqm, setAreaSqm] = useState<number | null>(null);
  const [perimeterM, setPerimeterM] = useState<number | null>(null);
  const [dlsKey, setDlsKey] = useState<string | null>(null);
  const [parcelPolygon, setParcelPolygon] = useState<[number, number][][] | null>(null);
  const [dlsHint, setDlsHint] = useState<{
    value: number;
    source: string;
    retrievedAt: string;
  } | null>(null);
  const [dlsHintStatus, setDlsHintStatus] = useState<"idle" | "loading" | "missing" | "failed">("idle");
  const [dlsMapStatus, setDlsMapStatus] = useState<"idle" | "loading" | "ready" | "missing" | "failed">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const [serialNo, setSerialNo] = useState<string | null>(null);

  useEffect(() => {
    clientKeyRef.current = getOrCreateClientKey();
  }, []);

  useEffect(() => {
    if (!journeyHydrated) return;
    if (journey.industryType && !industryType) {
      setIndustryType(journey.industryType);
    }
    if (journey.areaSqm && areaSqm == null) {
      setAreaSqm(journey.areaSqm);
      setFields((f) => (f.areaLabel ? f : { ...f, areaLabel: `${journey.areaSqm} m²` }));
    }
  }, [journeyHydrated, journey.industryType, journey.areaSqm, industryType, areaSqm]);

  const update = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));
  const updateDigits = (key: "phone" | "parcel") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [key]: toWesternDigits(e.target.value) }));

  function buildPayload(finalize: boolean) {
    const location = parseCoords(fields.coordinates);
    const median =
      dlsHint && areaSqm != null && areaSqm > 0 ? adminMedianEstimate(dlsHint.value, areaSqm) : undefined;
    return {
      clientKey: clientKeyRef.current || undefined,
      name: fields.name || undefined,
      phone: fields.phone || undefined,
      email: fields.email || undefined,
      governorate: fields.governorate || undefined,
      directorate: fields.directorate || undefined,
      village: fields.village || undefined,
      basin: fields.basin || undefined,
      neighborhood: fields.neighborhood || undefined,
      parcel: fields.parcel || undefined,
      coordinates: fields.coordinates || undefined,
      latitude: location ? String(location.lat) : undefined,
      longitude: location ? String(location.lng) : undefined,
      address: fields.address || undefined,
      dlsKey: dlsKey || undefined,
      areaSqm: areaSqm ?? undefined,
      areaLabel: fields.areaLabel || undefined,
      perimeterM: perimeterM ?? undefined,
      administrativeValue: dlsHint ? String(dlsHint.value) : undefined,
      administrativeValueSource: dlsHint?.source,
      administrativeValueAt: dlsHint?.retrievedAt,
      estimatedMedian: median != null ? String(median) : undefined,
      industryType: industryType || undefined,
      notes: fields.notes || undefined,
      ...(finalize ? {} : {}),
    };
  }

  // Auto-record all fields even if Save isn't clicked.
  useEffect(() => {
    if (serialNo) return;
    if (!clientKeyRef.current) clientKeyRef.current = getOrCreateClientKey();
    const timer = setTimeout(() => {
      const payload = buildPayload(false);
      const meaningful =
        payload.name ||
        payload.phone ||
        payload.email ||
        payload.governorate ||
        payload.village ||
        payload.parcel ||
        payload.coordinates ||
        payload.notes ||
        payload.industryType ||
        payload.areaSqm != null;
      if (!meaningful) return;
      setDraftStatus("saving");
      api
        .upsertLandCheckDraft(payload)
        .then(() => setDraftStatus("saved"))
        .catch(() => setDraftStatus("idle"));
    }, 1600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fields,
    industryType,
    areaSqm,
    perimeterM,
    dlsKey,
    dlsHint,
    serialNo,
  ]);

  useEffect(() => {
    let cancelled = false;
    const { governorate, directorate, village, basin, neighborhood, parcel } = fields;
    const parcelNo = parcel.trim();
    const timer = setTimeout(async () => {
      if (!governorate || !directorate || !village || !basin || !neighborhood || !parcelNo) {
        setDlsHint(null);
        setDlsHintStatus("idle");
        setDlsMapStatus("idle");
        setParcelPolygon(null);
        setDlsKey(null);
        setAreaSqm(null);
        setPerimeterM(null);
        return;
      }
      setDlsHint(null);
      setDlsHintStatus("loading");
      setDlsMapStatus("loading");
      setParcelPolygon(null);
      setDlsKey(null);
      setAreaSqm(null);
      setPerimeterM(null);

      const valuePromise = api
        .dlsAdministrativeValuePublic({
          governorate,
          directorate,
          village,
          basin,
          neighborhood,
          parcelNumber: parcelNo,
        })
        .then((result) => {
          if (!cancelled) {
            setDlsHint({ value: result.value, source: result.source, retrievedAt: result.retrievedAt });
            setDlsHintStatus("idle");
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setDlsHint(null);
            setDlsHintStatus(err instanceof ApiError && err.status === 404 ? "missing" : "failed");
          }
        });

      const mapPromise = (async () => {
        try {
          const data = await loadDlsLocations();
          const codes = codesForSelection(data, governorate, directorate, village, basin, neighborhood);
          if (!codes) {
            if (!cancelled) {
              setParcelPolygon(null);
              setDlsMapStatus("missing");
            }
            return;
          }
          const location = await api.dlsParcelLocationPublic({ ...codes, parcelNumber: parcelNo });
          if (cancelled) return;
          setParcelPolygon(location.rings);
          setDlsKey(location.dlsKey);
          setAreaSqm(location.areaSqm);
          setPerimeterM(location.perimeterM);
          setFields((f) => ({
            ...f,
            coordinates: coordsToString({ lat: location.latitude, lng: location.longitude }),
            areaLabel: location.areaSqm != null ? formatDlsArea(location.areaSqm, lang) : f.areaLabel,
          }));
          setDlsMapStatus("ready");
        } catch (err) {
          if (!cancelled) {
            setParcelPolygon(null);
            setDlsKey(null);
            setDlsMapStatus(err instanceof ApiError && err.status === 404 ? "missing" : "failed");
          }
        }
      })();

      await Promise.all([valuePromise, mapPromise]);
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fields.governorate, fields.directorate, fields.village, fields.basin, fields.neighborhood, fields.parcel, lang]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!fields.governorate || !fields.directorate || !fields.village || !fields.basin || !fields.neighborhood || !fields.parcel) {
      setError(t.landCheck.requiredError);
      return;
    }
    if (!clientKeyRef.current) clientKeyRef.current = getOrCreateClientKey();
    setSubmitting(true);
    try {
      const result = await api.createLandCheck(buildPayload(true));
      clearClientKey();
      clientKeyRef.current = "";
      setSerialNo(result.serialNo);
      if (industryType) patchJourney({ industryType, landCheckDone: true });
      else patchJourney({ landCheckDone: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.owners.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  if (serialNo) {
    return (
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-[640px] px-4">
          <div className="bg-white rounded-[1.75rem] border border-line p-8 md:p-10 shadow-[0_24px_50px_-36px_rgba(15,52,47,0.35)]">
            <div className="w-12 h-12 rounded-full bg-green/10 text-green flex items-center justify-center mx-auto">
              <CheckIcon />
            </div>
            <h2 className="text-2xl font-bold text-center mt-4">{t.landCheck.resultTitle}</h2>
            <div className="mt-6 bg-surface-2 rounded-xl p-4 text-center">
              <small className="block text-[10px] text-ink-soft">{t.landCheck.resultSerial}</small>
              <b className="text-sm font-mono" dir="ltr">
                {serialNo}
              </b>
            </div>
            <p className="text-sm text-ink-soft text-center mt-4 leading-relaxed">{t.landCheck.resultNote}</p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {journey.intent === "build_hangar" && journey.hasLand && (
                <Link
                  href="/journey"
                  className="h-11 rounded-full bg-green text-white text-sm font-bold flex items-center justify-center hover:bg-green-2 transition-colors"
                >
                  {t.journey.hangarSpecsTitle}
                </Link>
              )}
              <Link
                href="/request-publish"
                className={`h-11 rounded-full text-sm font-bold flex items-center justify-center transition-colors ${
                  journey.intent === "build_hangar" && journey.hasLand
                    ? "border border-line hover:bg-surface-2"
                    : "bg-green text-white hover:bg-green-2"
                }`}
              >
                {t.landCheck.resultListCta}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSerialNo(null);
                  clientKeyRef.current = getOrCreateClientKey();
                  setFields({
                    name: "",
                    phone: "",
                    email: "",
                    governorate: "",
                    directorate: "",
                    village: "",
                    basin: "",
                    neighborhood: "",
                    parcel: "",
                    coordinates: "",
                    address: "",
                    areaLabel: "",
                    notes: "",
                  });
                  setIndustryType(journey.industryType ?? "");
                  setDlsHint(null);
                  setAreaSqm(journey.areaSqm);
                  setPerimeterM(null);
                  setParcelPolygon(null);
                  setDraftStatus("idle");
                }}
                className="h-11 rounded-full border border-line text-sm font-bold hover:bg-surface-2 transition-colors"
              >
                {t.landCheck.resultAgain}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-[800px] px-4">
        <div className="max-w-2xl mb-10">
          <span className="text-gold text-xs font-bold tracking-wide">{t.landCheck.eyebrow}</span>
          <h1 className="text-3xl md:text-4xl font-bold mt-2 text-balance">{t.landCheck.title}</h1>
          <p className="text-ink-soft mt-3 leading-relaxed">{t.landCheck.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-[1.75rem] border border-line p-5 sm:p-8 flex flex-col gap-5 shadow-[0_24px_50px_-36px_rgba(15,52,47,0.35)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-green">{t.landCheck.contactSection}</p>
            {draftStatus === "saving" && (
              <span className="text-[11px] text-ink-soft">{t.landCheck.draftSaving}</span>
            )}
            {draftStatus === "saved" && (
              <span className="text-[11px] font-bold text-green">{t.landCheck.draftSaved}</span>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t.landCheck.name}</label>
              <input className={inputClass} value={fields.name} onChange={update("name")} />
            </div>
            <div>
              <label className={labelClass}>{t.landCheck.phone}</label>
              <input type="tel" className={inputClass} value={fields.phone} onChange={updateDigits("phone")} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{t.landCheck.email}</label>
              <input type="email" dir="ltr" className={inputClass} value={fields.email} onChange={update("email")} />
            </div>
          </div>

          <p className="text-xs font-bold text-green">{t.landCheck.landSection}</p>
          <LocationCascade
            governorate={fields.governorate}
            directorate={fields.directorate}
            village={fields.village}
            basin={fields.basin}
            neighborhood={fields.neighborhood}
            onChange={(patch) => setFields((f) => ({ ...f, ...patch }))}
            labels={{
              governorate: t.owners.governorate,
              directorate: t.owners.directorate,
              village: t.owners.village,
              basin: t.owners.basin,
              neighborhood: t.owners.neighborhood,
            }}
          />
          <div>
            <label className={labelClass}>{t.owners.parcel}</label>
            <input className={inputClass} value={fields.parcel} onChange={updateDigits("parcel")} required />
          </div>

          <div className="rounded-2xl border border-line bg-white/60 p-3 sm:p-4 flex flex-col gap-3">
            <p className="text-xs font-bold text-green">{t.owners.dlsMapSection}</p>
            <p className="text-[11px] text-ink-soft -mt-1">
              {dlsMapStatus === "loading"
                ? t.owners.dlsMapLoading
                : dlsMapStatus === "ready"
                  ? t.owners.dlsMapReady
                  : dlsMapStatus === "missing"
                    ? t.owners.dlsMapMissing
                    : dlsMapStatus === "failed"
                      ? t.owners.dlsMapFailed
                      : t.owners.dlsMapIdle}
            </p>
            <LocationInput
              ref={locationRef}
              key={dlsMapStatus === "ready" ? "dls-locked" : "dls-editable"}
              value={fields.coordinates}
              onChange={(v) => setFields((f) => ({ ...f, coordinates: v }))}
              address={fields.address}
              onAddressChange={(address) => setFields((f) => ({ ...f, address }))}
              polygon={parcelPolygon}
              lockEditing={dlsMapStatus === "ready"}
              loading={dlsMapStatus === "loading"}
              loadingLabel={t.owners.dlsMapLoading}
              areaLabel={fields.areaLabel}
              areaSqm={areaSqm}
              perimeterM={perimeterM}
              showDimensions
              onBlueprintReadyChange={setBlueprintReady}
              blueprint={{
                governorate: fields.governorate,
                directorate: fields.directorate,
                village: fields.village,
                basin: fields.basin,
                neighborhood: fields.neighborhood,
                parcel: fields.parcel,
                notes: fields.notes,
                industryLabel: t.owners.industryType,
                industryValue: industryType
                  ? (t.offers.industry as Record<string, string>)[industryType] || industryType
                  : undefined,
              }}
            />
            {fields.areaLabel && (
              <p className="text-sm">
                <span className="text-ink-soft">{t.owners.area}: </span>
                <b>{fields.areaLabel}</b>
              </p>
            )}
            {dlsHintStatus === "loading" && <p className="text-[11px] text-ink-soft">{t.owners.dlsHintLoading}</p>}
            {dlsHintStatus === "missing" && (
              <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{t.owners.dlsHintMissing}</p>
            )}
            {dlsHintStatus === "failed" && <p className="text-[11px] text-ink-soft">{t.owners.dlsHintFailed}</p>}
            {dlsHint && (
              <DlsPricingHint
                ratePerSqm={dlsHint.value}
                areaSqm={areaSqm}
                sizeLabel={fields.areaLabel}
                source={dlsHint.source}
                retrievedAt={dlsHint.retrievedAt}
                className="rounded-xl bg-gold/10 border border-gold/30 px-3 py-2.5 text-[11px] text-ink-soft leading-relaxed"
              />
            )}
          </div>

          <p className="text-xs font-bold text-green">{t.landCheck.regulationSection}</p>
          <RegulationGuide
            value={industryType}
            onChange={(key) => {
              setIndustryType(key);
              if (key) patchJourney({ industryType: key });
            }}
            scope="all"
          />

          <div>
            <label className={labelClass}>{t.landCheck.notes}</label>
            <textarea
              className={`${inputClass} h-24 py-2`}
              value={fields.notes}
              onChange={update("notes")}
              placeholder={t.landCheck.notesPlaceholder}
              maxLength={2000}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {printError && <p className="text-sm text-red-600">{printError}</p>}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={!blueprintReady || printing || !parcelPolygon?.[0]?.length}
              onClick={() => {
                setPrintError("");
                setPrinting(true);
                const run = locationRef.current?.printBlueprint();
                if (!run) {
                  setPrintError(t.locationPicker.sideViewPrintError);
                  setPrinting(false);
                  return;
                }
                void run
                  .catch((err: unknown) => {
                    const code = err instanceof Error ? err.message : "";
                    if (code === "popup-blocked") {
                      setPrintError(
                        lang === "ar"
                          ? "المتصفح منع النافذة. اسمح بالنوافذ المنبثقة لهذه الصفحة وحاول مجددًا."
                          : "The browser blocked the print window. Allow popups for this site and try again."
                      );
                    } else if (code === "satellite-unavailable" || code.startsWith("sat-")) {
                      setPrintError(
                        lang === "ar"
                          ? "تعذر تحميل صورة القمر الصناعي. تحقق من الاتصال وحاول مرة أخرى."
                          : "Could not load satellite imagery. Check your connection and try again."
                      );
                    } else {
                      setPrintError(t.locationPicker.sideViewPrintError);
                    }
                  })
                  .finally(() => setPrinting(false));
              }}
              className="h-12 px-5 rounded-full bg-gold text-green font-bold hover:bg-gold-2 transition-colors disabled:opacity-50 sm:flex-1"
            >
              {printing ? t.locationPicker.sideViewPrinting : t.locationPicker.sideViewPrint}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-12 px-5 rounded-full bg-green text-white font-bold hover:bg-green-2 transition-colors disabled:opacity-60 sm:flex-1"
            >
              {submitting ? t.landCheck.submitting : t.landCheck.submit}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
