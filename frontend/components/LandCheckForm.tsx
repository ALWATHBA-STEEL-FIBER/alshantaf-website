"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { LocationCascade } from "@/components/LocationCascade";
import { LocationInput, type AdjacentRoad, type LocationInputHandle } from "@/components/LocationInput";
import { DlsPricingHint } from "@/components/DlsPricingHint";
import { RegulationGuide } from "@/components/RegulationGuide";
import { toWesternDigits } from "@/lib/arabicDigits";
import { adminMedianEstimate } from "@/lib/adminPricing";
import { parseCoords, coordsToString, formatDlsArea } from "@/lib/mapCoords";
import {
  loadDlsLocations,
  codesForSelection,
  selectionForCodes,
  neighborhoodsForBasin,
  DLS_DEFAULT_NEIGHBORHOOD_LABEL,
} from "@/lib/dlsLocations";
import { CheckIcon } from "@/components/icons";
import { useJourney } from "@/lib/journey/JourneyProvider";
import type { IndustryType } from "@/lib/types";
import { isAmmanGovernorate } from "@/lib/ammanZoning";
import { BotGuard, type BotGuardHandle } from "@/components/BotGuard";
import { ParcelMapWorkspace } from "@/components/ParcelMapWorkspace";

const inputClass =
  "w-full h-9 rounded-md border border-line bg-white px-2.5 text-[13px] outline-none focus:border-gold";
const labelClass = "text-[11px] font-bold text-ink-soft mb-1 block";
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

function normalizeParcelId(parcelId: string): string {
  const numeric = Number(parcelId);
  return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : parcelId;
}

export function LandCheckForm() {
  const { t, lang } = useLanguage();
  const { state: journey, patch: patchJourney } = useJourney();
  const clientKeyRef = useRef<string>("");
  const locationRef = useRef<LocationInputHandle>(null);
  const regulationSectionRef = useRef<HTMLDivElement>(null);
  const regulationHintKeyRef = useRef("");
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
  const [adjacentRoads, setAdjacentRoads] = useState<AdjacentRoad[]>([]);
  const [dlsHint, setDlsHint] = useState<{
    value: number;
    source: string;
    retrievedAt: string;
  } | null>(null);
  const [dlsHintStatus, setDlsHintStatus] = useState<"idle" | "loading" | "missing" | "failed">("idle");
  const [dlsMapStatus, setDlsMapStatus] = useState<"idle" | "loading" | "ready" | "missing" | "failed">("idle");
  const [awaitingRegulationAfterPin, setAwaitingRegulationAfterPin] = useState(false);
  const [ammanAutoIndustryType, setAmmanAutoIndustryType] = useState<IndustryType | null>(null);
  const [ammanLookupStatus, setAmmanLookupStatus] = useState<"idle" | "loading" | "success" | "failed">("idle");
  const [ammanLookupNote, setAmmanLookupNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const botRef = useRef<BotGuardHandle>(null);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const [serialNo, setSerialNo] = useState<string | null>(null);

  useEffect(() => {
    clientKeyRef.current = getOrCreateClientKey();
  }, []);

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
  }, [fields, industryType, areaSqm, perimeterM, dlsKey, dlsHint, serialNo]);

  function hintRegulation(key: string) {
    setAwaitingRegulationAfterPin(true);
    if (regulationHintKeyRef.current === key) return;
    regulationHintKeyRef.current = key;
    window.setTimeout(() => {
      regulationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }

  useEffect(() => {
    let cancelled = false;
    const { governorate, directorate, village, basin, neighborhood, parcel } = fields;
    const parcelNo = parcel.trim();
    const timer = setTimeout(async () => {
      if (!governorate || !directorate || !village || !basin || !parcelNo) {
        setDlsHint(null);
        setDlsHintStatus("idle");
        setDlsMapStatus("idle");
        setParcelPolygon(null);
        setAdjacentRoads([]);
        setDlsKey(null);
        setAreaSqm(null);
        setPerimeterM(null);
        return;
      }
      const dlsData = await loadDlsLocations();
      if (cancelled) return;
      const neighborhoodOpts = neighborhoodsForBasin(dlsData, governorate, directorate, village, basin);
      if (neighborhoodOpts.length > 0 && !neighborhood) {
        setDlsHint(null);
        setDlsHintStatus("idle");
        setDlsMapStatus("idle");
        setParcelPolygon(null);
        setAdjacentRoads([]);
        setDlsKey(null);
        setAreaSqm(null);
        setPerimeterM(null);
        return;
      }
      const neighborhoodForLookup =
        neighborhood ||
        (neighborhoodOpts.length === 1 ? neighborhoodOpts[0].label : DLS_DEFAULT_NEIGHBORHOOD_LABEL);
      setDlsHint(null);
      setDlsHintStatus("loading");
      setDlsMapStatus("loading");
      setParcelPolygon(null);
      setAdjacentRoads([]);
      setDlsKey(null);
      setAreaSqm(null);
      setPerimeterM(null);

      const valuePromise = api
        .dlsAdministrativeValuePublic({
          governorate,
          directorate,
          village,
          basin,
          neighborhood: neighborhoodForLookup,
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
          const codes = codesForSelection(
            dlsData,
            governorate,
            directorate,
            village,
            basin,
            neighborhoodForLookup
          );
          if (!codes) {
            if (!cancelled) {
              setParcelPolygon(null);
              setAdjacentRoads([]);
              setDlsMapStatus("missing");
            }
            return;
          }
          const location = await api.dlsParcelLocationPublic({ ...codes, parcelNumber: parcelNo });
          if (cancelled) return;
          setParcelPolygon(location.rings);
          setAdjacentRoads(location.adjacentRoads ?? []);
          setDlsKey(location.dlsKey);
          setAreaSqm(location.areaSqm);
          setPerimeterM(location.perimeterM);
          setFields((f) => ({
            ...f,
            coordinates: coordsToString({ lat: location.latitude, lng: location.longitude }),
            areaLabel: location.areaSqm != null ? formatDlsArea(location.areaSqm, lang) : f.areaLabel,
          }));
          setDlsMapStatus("ready");
          if (!industryType) {
            hintRegulation([governorate, directorate, village, basin, neighborhood, parcelNo].join("|"));
          }
        } catch (err) {
          if (!cancelled) {
            setParcelPolygon(null);
            setAdjacentRoads([]);
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
  }, [
    fields.governorate,
    fields.directorate,
    fields.village,
    fields.basin,
    fields.neighborhood,
    fields.parcel,
    industryType,
    lang,
  ]);

  useEffect(() => {
    if (industryType) {
      setAwaitingRegulationAfterPin(false);
      regulationHintKeyRef.current = "";
    }
  }, [industryType]);

  useEffect(() => {
    setAmmanAutoIndustryType(null);
    if (!isAmmanGovernorate(fields.governorate)) {
      setAmmanLookupStatus("idle");
      setAmmanLookupNote("");
      return;
    }
    setAmmanLookupStatus("idle");
    setAmmanLookupNote(
      lang === "ar"
        ? "تصنيف التنظيم يُختار يدويًا. مستكشف عمان للمعاينة فقط، والشهادة الرسمية عبر خدمات أمانة عمان (ومنها خدمات GIS المدفوعة)."
        : "Select zoning manually. Amman Explorer is a viewer only; official certificates come from Greater Amman Municipality services (including paid GIS)."
    );
  }, [fields.governorate, lang]);

  function handlePrint() {
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
  }

  async function handlePinDrop(coords: { lat: number; lng: number }) {
    setError("");
    setDlsMapStatus("loading");
    try {
      const [pointParcel, dlsData] = await Promise.all([
        api.dlsParcelByPointPublic({ latitude: coords.lat, longitude: coords.lng }),
        loadDlsLocations(),
      ]);
      const selection = selectionForCodes(dlsData, {
        villageCode: pointParcel.villageCode,
        basinCode: pointParcel.basinCode,
        sectorCode: pointParcel.sectorCode,
      });
      if (!selection) {
        setDlsMapStatus(parcelPolygon ? "ready" : "failed");
        setError(lang === "ar" ? "تعذر مطابقة موقع الدبوس مع بيانات المناطق." : "Could not map the pin point to DLS location labels.");
        return;
      }
      const parcel = normalizeParcelId(pointParcel.parcelId);
      setFields((f) => ({
        ...f,
        coordinates: coordsToString({ lat: pointParcel.latitude, lng: pointParcel.longitude }),
        governorate: selection.governorate,
        directorate: selection.directorate,
        village: selection.village,
        basin: selection.basin,
        neighborhood: selection.neighborhood,
        parcel,
        areaLabel: pointParcel.areaSqm != null ? formatDlsArea(pointParcel.areaSqm, lang) : f.areaLabel,
      }));
      setParcelPolygon(pointParcel.rings?.length ? pointParcel.rings : null);
      setAdjacentRoads(pointParcel.adjacentRoads ?? []);
      setDlsKey(pointParcel.dlsKey || null);
      setAreaSqm(pointParcel.areaSqm ?? null);
      setPerimeterM(pointParcel.perimeterM ?? null);
      setDlsMapStatus("ready");
      if (!industryType) {
        hintRegulation(
          [selection.governorate, selection.directorate, selection.village, selection.basin, selection.neighborhood, parcel].join("|")
        );
      } else {
        setAwaitingRegulationAfterPin(false);
      }
    } catch (err) {
      setDlsMapStatus(parcelPolygon ? "ready" : "failed");
      setError(
        err instanceof ApiError
          ? err.message
          : lang === "ar"
            ? "تعذر جلب بيانات الأرض من دائرة الأراضي من موقع الدبوس."
            : "Could not fetch DLS parcel data from the selected map point."
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!industryType) {
      setError(t.landCheck.regulationRequired);
      return;
    }
    const dlsData = await loadDlsLocations();
    const neighborhoodOpts =
      fields.governorate && fields.directorate && fields.village && fields.basin
        ? neighborhoodsForBasin(
            dlsData,
            fields.governorate,
            fields.directorate,
            fields.village,
            fields.basin
          )
        : [];
    let neighborhood = fields.neighborhood.trim();
    if (!neighborhood && neighborhoodOpts.length === 1) {
      neighborhood = neighborhoodOpts[0].label;
      setFields((f) => ({ ...f, neighborhood }));
    } else if (!neighborhood && neighborhoodOpts.length === 0 && fields.basin) {
      neighborhood = DLS_DEFAULT_NEIGHBORHOOD_LABEL;
      setFields((f) => ({ ...f, neighborhood }));
    }
    const missing: string[] = [];
    if (!fields.governorate) missing.push(t.owners.governorate);
    if (!fields.directorate) missing.push(t.owners.directorate);
    if (!fields.village) missing.push(t.owners.village);
    if (!fields.basin) missing.push(t.owners.basin);
    if (neighborhoodOpts.length > 0 && !neighborhood) missing.push(t.owners.neighborhood);
    if (!fields.parcel.trim()) missing.push(t.owners.parcel);
    if (missing.length) {
      setError(`${t.owners.missingFields} ${missing.join(lang === "ar" ? "، " : ", ")}`);
      return;
    }
    if (!clientKeyRef.current) clientKeyRef.current = getOrCreateClientKey();
    const bot = botRef.current?.getPayload();
    if (!bot) {
      setError(t.botGuard.required);
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.createLandCheck({
        ...buildPayload(true),
        neighborhood: neighborhood || DLS_DEFAULT_NEIGHBORHOOD_LABEL,
        ...bot,
      });
      clearClientKey();
      clientKeyRef.current = "";
      setSerialNo(result.serialNo);
      if (industryType) patchJourney({ industryType, landCheckDone: true });
      else patchJourney({ landCheckDone: true });
    } catch (err) {
      botRef.current?.reset();
      setError(err instanceof ApiError ? err.message : t.owners.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
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
    setIndustryType("");
    setDlsHint(null);
    setAreaSqm(null);
    setPerimeterM(null);
    setParcelPolygon(null);
    setAdjacentRoads([]);
    setAmmanAutoIndustryType(null);
    setDraftStatus("idle");
    setBlueprintReady(false);
    setPrintError("");
    setError("");
  }

  const mapStatusLabel =
    dlsMapStatus === "loading"
      ? t.owners.dlsMapLoading
      : dlsMapStatus === "ready"
        ? awaitingRegulationAfterPin && !industryType
          ? t.owners.regulationHint
          : t.owners.dlsMapReady
        : dlsMapStatus === "missing"
          ? t.owners.dlsMapMissing
          : dlsMapStatus === "failed"
            ? t.owners.dlsMapFailed
            : t.owners.dlsMapIdle;

  const searchPanel = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-green">{t.landCheck.landSection}</p>
        {draftStatus === "saving" && <span className="text-[11px] text-ink-soft">{t.landCheck.draftSaving}</span>}
        {draftStatus === "saved" && <span className="text-[11px] font-bold text-green">{t.landCheck.draftSaved}</span>}
      </div>
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
          other: t.owners.locationOther,
        }}
      />
      <div>
        <label className={labelClass} htmlFor="lc-parcel">
          {t.owners.parcel}
        </label>
        <input
          id="lc-parcel"
          className={inputClass}
          value={fields.parcel}
          onChange={updateDigits("parcel")}
          placeholder={t.owners.enterParcel}
          required
        />
      </div>
      <div
        ref={regulationSectionRef}
        className={`border-t border-line pt-3 ${
          awaitingRegulationAfterPin && !industryType ? "rounded-xl border border-amber-200 bg-amber-50/80 p-3" : ""
        }`}
      >
        <p className="mb-2 text-xs font-bold text-green">{t.landCheck.regulationSection}</p>
        {awaitingRegulationAfterPin && !industryType && (
          <p className="mb-2 rounded-lg border border-amber-300 bg-white px-2.5 py-2 text-[11px] font-bold leading-relaxed text-amber-900">
            {t.owners.regulationHint}
          </p>
        )}
        <RegulationGuide
          value={industryType}
          onChange={(key) => {
            setIndustryType(key);
            if (key) setAwaitingRegulationAfterPin(false);
          }}
          scope="all"
          required
          selectDisabled={Boolean(ammanAutoIndustryType)}
        />
        {isAmmanGovernorate(fields.governorate) && (
          <p
            className={`mt-2 text-[11px] leading-relaxed ${
              ammanLookupStatus === "failed"
                ? "text-red-700"
                : ammanLookupStatus === "success"
                  ? "text-green"
                  : "text-ink-soft"
            }`}
          >
            {ammanLookupStatus === "loading" ? (lang === "ar" ? "جارٍ التحميل..." : "Loading...") : ammanLookupNote}
          </p>
        )}
      </div>
    </div>
  );

  const detailsPanel = (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-bold text-green">{t.landCheck.detailsSection}</p>
      <div>
        <label className={labelClass}>{t.owners.area}</label>
        <input
          className={inputClass}
          value={fields.areaLabel}
          readOnly
          placeholder={lang === "ar" ? "تُملأ تلقائيًا من دائرة الأراضي" : "Filled automatically from DLS"}
        />
        {dlsMapStatus === "ready" && fields.areaLabel && (
          <p className="mt-1.5 text-[11px] text-ink-soft">{t.owners.areaDlsNote}</p>
        )}
      </div>
      {/* DLS admin rate / m² — desktop only; mobile unified sheet mirrors DLS parcel info without pricing */}
      <div className="hidden md:block">
        <label className={labelClass}>{lang === "ar" ? "القيمة الاسترشادية" : "Guide value"}</label>
        {dlsHintStatus === "loading" && (
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-[11px] text-ink-soft">
            <span className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-green/25 border-t-green animate-spin" aria-hidden />
            <span>{t.owners.dlsHintLoading}</span>
          </div>
        )}
        {dlsHintStatus === "missing" && (
          <p className="mt-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] leading-relaxed text-red-700">
            {t.owners.dlsHintMissing}
          </p>
        )}
        {dlsHintStatus === "failed" && <p className="mt-1 text-[11px] text-ink-soft">{t.owners.dlsHintFailed}</p>}
        {dlsHint && (
          <DlsPricingHint
            ratePerSqm={dlsHint.value}
            areaSqm={areaSqm}
            sizeLabel={fields.areaLabel}
            source={dlsHint.source}
            retrievedAt={dlsHint.retrievedAt}
          />
        )}
        {!dlsHint && dlsHintStatus === "idle" && (
          <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
            {awaitingRegulationAfterPin && !industryType ? t.owners.regulationHint : t.owners.dlsMapIdle}
          </p>
        )}
      </div>
      <div>
        <label className={labelClass} htmlFor="lc-notes">
          {t.landCheck.notes}
        </label>
        <textarea
          id="lc-notes"
          className={`${inputClass} h-24 min-h-[5rem] resize-y py-2`}
          value={fields.notes}
          onChange={update("notes")}
          placeholder={t.landCheck.notesPlaceholder}
          maxLength={2000}
        />
      </div>
      <div className="border-t border-line pt-3">
        <p className="mb-2 text-xs font-bold text-green">{t.landCheck.contactSection}</p>
        <div className="grid gap-3">
          <div>
            <label className={labelClass} htmlFor="lc-name">
              {t.landCheck.name}
            </label>
            <input id="lc-name" className={inputClass} value={fields.name} onChange={update("name")} />
          </div>
          <div>
            <label className={labelClass} htmlFor="lc-phone">
              {t.landCheck.phone}
            </label>
            <input
              id="lc-phone"
              type="tel"
              className={inputClass}
              value={fields.phone}
              onChange={updateDigits("phone")}
              placeholder="07XXXXXXXX"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="lc-email">
              {t.landCheck.email}
            </label>
            <input
              id="lc-email"
              type="email"
              dir="ltr"
              className={inputClass}
              value={fields.email}
              onChange={update("email")}
              placeholder="name@example.com"
            />
            <p className="mt-1 text-[11px] text-ink-soft">{t.landCheck.emailNote}</p>
          </div>
        </div>
      </div>
      <BotGuard ref={botRef} action="land_check" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {printError && <p className="text-sm text-red-600">{printError}</p>}
    </div>
  );

  const footerActions = (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={!blueprintReady || printing || !parcelPolygon?.[0]?.length}
        onClick={handlePrint}
        className="h-9 rounded-md bg-gold px-3 text-[13px] font-extrabold text-green transition-colors hover:bg-gold-2 disabled:opacity-50"
      >
        {printing ? t.locationPicker.sideViewPrinting : t.locationPicker.sideViewPrint}
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="h-9 rounded-md bg-white px-3 text-[13px] font-extrabold text-green transition-colors hover:bg-gold disabled:opacity-60"
      >
        {submitting ? t.landCheck.submitting : t.landCheck.submit}
      </button>
    </div>
  );

  return (
    <section className={serialNo ? "bg-bg py-16 md:py-20" : ""}>
      {serialNo && (
        <div className="mx-auto mb-10 max-w-[640px] px-4">
          <div className="rounded-[1.75rem] border border-line bg-white p-8 shadow-[0_24px_50px_-36px_rgba(15,52,47,0.35)] md:p-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green/10 text-green">
              <CheckIcon />
            </div>
            <h2 className="mt-4 text-center text-2xl font-bold">{t.landCheck.resultTitle}</h2>
            <div className="mt-6 rounded-xl bg-surface-2 p-4 text-center">
              <small className="block text-[10px] text-ink-soft">{t.landCheck.resultSerial}</small>
              <b className="font-mono text-sm" dir="ltr">
                {serialNo}
              </b>
            </div>
            <p className="mt-4 text-center text-sm leading-relaxed text-ink-soft">{t.landCheck.resultNote}</p>
            {printError && <p className="mt-3 text-center text-sm text-red-600">{printError}</p>}
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                disabled={!blueprintReady || printing || !parcelPolygon?.[0]?.length}
                onClick={handlePrint}
                className="h-11 rounded-full bg-gold text-sm font-bold text-green transition-colors hover:bg-gold-2 disabled:opacity-50"
              >
                {printing ? t.locationPicker.sideViewPrinting : t.locationPicker.sideViewPrint}
              </button>
              <div className="flex flex-col gap-3 sm:flex-row">
                {journey.intent === "build_hangar" && journey.hasLand && (
                  <Link
                    href="/journey"
                    className="flex h-11 items-center justify-center rounded-full bg-green text-sm font-bold text-white transition-colors hover:bg-green-2 sm:flex-1"
                  >
                    {t.journey.hangarSpecsTitle}
                  </Link>
                )}
                <Link
                  href="/request-publish"
                  className={`flex h-11 items-center justify-center rounded-full text-sm font-bold transition-colors sm:flex-1 ${
                    journey.intent === "build_hangar" && journey.hasLand
                      ? "border border-line hover:bg-surface-2"
                      : "bg-green text-white hover:bg-green-2"
                  }`}
                >
                  {t.landCheck.resultListCta}
                </Link>
                <button
                  type="button"
                  onClick={resetAll}
                  className="h-11 rounded-full border border-line text-sm font-bold transition-colors hover:bg-surface-2 sm:flex-1"
                >
                  {t.landCheck.resultAgain}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={serialNo ? "fixed left-[-200vw] top-0 w-[1100px] opacity-0 pointer-events-none" : "contents"}
        aria-hidden={serialNo ? true : undefined}
      >
        <ParcelMapWorkspace
          title={t.landCheck.title}
          subtitle={t.landCheck.subtitle}
          status={
            <span className="inline-flex max-w-[12rem] items-center gap-1.5 truncate rounded-md bg-white/10 px-2 py-0.5">
              {dlsMapStatus === "loading" ? (
                <span className="inline-block h-3 w-3 shrink-0 rounded-full border-2 border-white/30 border-t-gold animate-spin" aria-hidden />
              ) : null}
              <span className="truncate">{mapStatusLabel}</span>
            </span>
          }
          tabs={[
            { id: "search", label: lang === "ar" ? "بحث القطعة" : "Find parcel", railLabel: lang === "ar" ? "بحث" : "Find" },
            { id: "details", label: lang === "ar" ? "التفاصيل" : "Details", railLabel: lang === "ar" ? "تفاصيل" : "Info" },
          ]}
          panels={{ search: searchPanel, details: detailsPanel }}
          map={
            <LocationInput
              ref={locationRef}
              variant="workspace"
              value={fields.coordinates}
              onChange={(v) => setFields((f) => ({ ...f, coordinates: v }))}
              onPinDrop={handlePinDrop}
              address={fields.address}
              onAddressChange={(address) => setFields((f) => ({ ...f, address }))}
              polygon={parcelPolygon}
              adjacentRoads={adjacentRoads}
              lockEditing={dlsMapStatus === "loading"}
              loading={dlsMapStatus === "loading"}
              loadingLabel={t.owners.dlsMapLoading}
              statusNote={dlsMapStatus === "ready" ? t.owners.dlsMapReadyRepick : undefined}
              idleNote={t.owners.dlsMapIdle}
              areaLabel={fields.areaLabel}
              areaSqm={areaSqm}
              perimeterM={perimeterM}
              showDimensions
              showTopo
              onBlueprintReadyChange={setBlueprintReady}
              dlsKey={dlsKey}
              blueprint={{
                governorate: fields.governorate,
                directorate: fields.directorate,
                village: fields.village,
                basin: fields.basin,
                neighborhood: fields.neighborhood,
                parcel: fields.parcel,
                notes: fields.notes,
                industryLabel: t.regulations.selectLabel,
                industryValue: industryType
                  ? (t.offers.industry as Record<string, string>)[industryType] || industryType
                  : undefined,
              }}
            />
          }
          footer={footerActions}
        />
      </form>
    </section>
  );
}
