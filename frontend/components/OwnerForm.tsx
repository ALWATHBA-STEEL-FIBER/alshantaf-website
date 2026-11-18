"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { useSettings } from "@/lib/SettingsProvider";
import { openWhatsapp } from "@/lib/whatsapp";
import { api, ApiError } from "@/lib/api";
import { RegulationGuide } from "@/components/RegulationGuide";
import { SETBACKS } from "@/lib/setbacks";
import { CheckIcon, ImageIcon, VideoIcon, DocumentIcon } from "@/components/icons";
import { LocationCascade } from "@/components/LocationCascade";
import { DlsPricingHint } from "@/components/DlsPricingHint";
import { localizePlaceName, localizeSizeLabel } from "@/lib/localizePlace";
import { normalizeDecimalInput, toWesternDigits } from "@/lib/arabicDigits";
import { LocationInput, type AdjacentRoad } from "@/components/LocationInput";
import { FilePickerButton } from "@/components/FilePickerButton";
import { parseCoords, coordsToString, formatDlsArea } from "@/lib/mapCoords";
import {
  loadDlsLocations,
  codesForSelection,
  selectionForCodes,
  neighborhoodsForBasin,
  DLS_DEFAULT_NEIGHBORHOOD_LABEL,
} from "@/lib/dlsLocations";
import type { IndustryType } from "@/lib/types";
import { isAmmanGovernorate } from "@/lib/ammanZoning";
import {
  areParcelNumbersConsecutive,
  MAX_MULTI_PARCELS,
  parseParcelNumbers,
  sanitizeParcelNumberInput,
} from "@/lib/multiParcel";
import { fetchAndMergeParcelLocations } from "@/lib/multiParcelFetch";
import { BotGuard, type BotGuardHandle } from "@/components/BotGuard";
import { ParcelMapWorkspace } from "@/components/ParcelMapWorkspace";

const ACTIVITY_KEYS = ["food", "pharma", "packaging", "logistics", "plastic", "wood", "metal", "stone", "blocks", "other"] as const;

const inputClass =
  "w-full h-9 rounded-md border border-line bg-white px-2.5 text-[13px] outline-none focus:border-gold";
const labelClass = "text-[11px] font-bold text-ink-soft mb-1 block";

export function OwnerForm() {
  const { t, lang } = useLanguage();
  const settings = useSettings();
  const [source, setSource] = useState<"owner" | "broker">("owner");
  const [fields, setFields] = useState({
    name: "",
    phone: "",
    status: "owner",
    office: "",
    whatsapp: "",
    email: "",
    authExpiry: "",
    governorate: "",
    directorate: "",
    village: "",
    basin: "",
    parcel: "",
    neighborhood: "",
    coordinates: "",
    address: "",
    area: "",
    price: "",
    industryType: "" as IndustryType | "",
    activity: "",
    details: "",
  });
  const [authorized, setAuthorized] = useState(false);
  const [priceConsent, setPriceConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const botRef = useRef<BotGuardHandle>(null);
  const [dlsHint, setDlsHint] = useState<{ value: number; currency: string; source: string; retrievedAt: string } | null>(null);
  const [dlsHintStatus, setDlsHintStatus] = useState<"idle" | "loading" | "missing" | "failed">("idle");
  const [dlsMapStatus, setDlsMapStatus] = useState<"idle" | "loading" | "ready" | "missing" | "failed">("idle");
  const [parcelPolygon, setParcelPolygon] = useState<[number, number][][] | null>(null);
  const [adjacentRoads, setAdjacentRoads] = useState<AdjacentRoad[]>([]);
  const [dlsKey, setDlsKey] = useState<string | null>(null);
  const [areaSqm, setAreaSqm] = useState<number | null>(null);
  const [isMultiParcelOffer, setIsMultiParcelOffer] = useState(false);
  const [parcelEntries, setParcelEntries] = useState<string[]>([""]);
  const [parcelOrderError, setParcelOrderError] = useState("");
  const [result, setResult] = useState<{
    serialNo: string;
    trackingCode: string;
    industryType: IndustryType | "";
    emailProvided: boolean;
    whatsappMessage: string;
  } | null>(null);
  const regulationSectionRef = useRef<HTMLDivElement>(null);
  const regulationHintKeyRef = useRef("");
  const [awaitingRegulationAfterPin, setAwaitingRegulationAfterPin] = useState(false);
  const [ammanAutoIndustryType, setAmmanAutoIndustryType] = useState<IndustryType | null>(null);
  const [ammanLookupStatus, setAmmanLookupStatus] = useState<"idle" | "loading" | "success" | "failed">("idle");
  const [ammanLookupNote, setAmmanLookupNote] = useState("");

  function normalizeParcelId(parcelId: string): string {
    const numeric = Number(parcelId);
    return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : parcelId;
  }

  const update = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  const updateDigits = (key: "phone" | "whatsapp" | "area") => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setFields((f) => ({ ...f, [key]: toWesternDigits(e.target.value) }));

  /** Keep asking price as a clean Western decimal while typing (no HTML pattern fights). */
  function updatePrice(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = normalizeDecimalInput(e.target.value);
    const cleaned = raw.replace(/[^\d.]/g, "");
    const dot = cleaned.indexOf(".");
    const next =
      dot === -1
        ? cleaned
        : `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, "")}`;
    setFields((f) => ({ ...f, price: next }));
  }

  useEffect(() => {
    const cleaned = parcelEntries
      .map((value) => sanitizeParcelNumberInput(value))
      .filter((value) => value.length > 0);
    const canonical = cleaned.join(", ");
    setFields((f) => (f.parcel === canonical ? f : { ...f, parcel: canonical }));
    if (!isMultiParcelOffer) {
      setParcelOrderError("");
      return;
    }
    if (cleaned.length < 2) {
      setParcelOrderError(lang === "ar" ? "أدخل رقمَي قطعتين على الأقل." : "Enter at least two parcel numbers.");
      return;
    }
    if (cleaned.length > MAX_MULTI_PARCELS) {
      setParcelOrderError(
        lang === "ar"
          ? `الحد الأقصى ${MAX_MULTI_PARCELS} قطع ضمن العرض الواحد.`
          : `Maximum ${MAX_MULTI_PARCELS} parcels per offer.`
      );
      return;
    }
    if (!areParcelNumbersConsecutive(cleaned)) {
      setParcelOrderError(
        lang === "ar"
          ? "يجب أن تكون أرقام القطع متتالية بنفس الترتيب (فرق 1 بين كل رقم والذي يليه)."
          : "Parcel numbers must be consecutive in the same order (difference of 1)."
      );
      return;
    }
    setParcelOrderError("");
  }, [parcelEntries, isMultiParcelOffer, lang]);

  // Fetch DLS admin value + parcel outline once zoning + full land identity are set.
  useEffect(() => {
    let cancelled = false;
    const governorate = fields.governorate;
    const directorate = fields.directorate;
    const village = fields.village;
    const basin = fields.basin;
    const neighborhood = fields.neighborhood;
    const parcel = fields.parcel.trim();
    const industryType = fields.industryType;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (!governorate || !directorate || !village || !basin || !parcel) {
        setDlsHint(null);
        setDlsHintStatus("idle");
        setDlsMapStatus("idle");
        setParcelPolygon(null);
        setAdjacentRoads([]);
        setDlsKey(null);
        setAreaSqm(null);
        setFields((f) => ({ ...f, area: "" }));
        return;
      }
      const dlsData = await loadDlsLocations();
      if (cancelled) return;
      const neighborhoodOpts = neighborhoodsForBasin(dlsData, governorate, directorate, village, basin);
      // Wait for the user (or auto-select) when the basin actually has neighborhood rows.
      if (neighborhoodOpts.length > 0 && !neighborhood) {
        setDlsHint(null);
        setDlsHintStatus("idle");
        setDlsMapStatus("idle");
        setParcelPolygon(null);
        setAdjacentRoads([]);
        setDlsKey(null);
        setAreaSqm(null);
        setFields((f) => ({ ...f, area: "" }));
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
      setFields((f) => ({ ...f, area: "" }));

      const valuePromise = (async () => {
        const parcelNos = parseParcelNumbers(parcel);
        const lookupNos = parcelNos.length ? parcelNos : [parcel];
        const valueResults = await Promise.allSettled(
          lookupNos.map((parcelNo) =>
            api.dlsAdministrativeValuePublic({
              governorate,
              directorate,
              village,
              basin,
              neighborhood: neighborhoodForLookup,
              parcelNumber: parcelNo,
            })
          )
        );
        const firstValue = valueResults.find(
          (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof api.dlsAdministrativeValuePublic>>> =>
            r.status === "fulfilled"
        )?.value;
        if (firstValue && !cancelled) {
          setDlsHint({
            value: firstValue.value,
            currency: firstValue.currency,
            source: firstValue.source,
            retrievedAt: firstValue.retrievedAt,
          });
          setDlsHintStatus("idle");
          return;
        }
        if (!cancelled) {
          const firstError = valueResults.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason;
          setDlsHint(null);
          setDlsHintStatus(firstError instanceof ApiError && firstError.status === 404 ? "missing" : "failed");
        }
      })();

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
          const parcelNos = parseParcelNumbers(parcel);
          const lookupNos = parcelNos.length ? parcelNos : [parcel];
          const merged = await fetchAndMergeParcelLocations(
            lookupNos,
            codes,
            (payload) => api.dlsParcelLocationPublic(payload)
          );
          const locations = merged.items;
          const first = locations.find((loc) => loc.rings?.[0]?.length) ?? locations[0];
          if (!first) {
            setParcelPolygon(null);
            setAdjacentRoads([]);
            setDlsMapStatus("missing");
            return;
          }
          const mergedRings = locations.flatMap((loc) => loc.rings ?? []);
          const mergedRoads = locations
            .flatMap((loc) => loc.adjacentRoads ?? [])
            .filter((road, idx, arr) => arr.findIndex((x) => x.id === road.id && x.side === road.side) === idx);
          const totalSqm = locations.reduce((sum, loc) => sum + (loc.areaSqm ?? 0), 0);
          const centroid = {
            lat: locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length,
            lng: locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length,
          };
          if (cancelled) return;
          setParcelPolygon(mergedRings.length ? mergedRings : first.rings);
          setAdjacentRoads(mergedRoads);
          setDlsKey(first.dlsKey);
          setFields((f) => ({
            ...f,
            coordinates: coordsToString(centroid),
            ...(totalSqm > 0
              ? { area: formatDlsArea(totalSqm, lang) }
              : first.areaSqm != null
                ? { area: formatDlsArea(first.areaSqm, lang) }
              : {}),
          }));
          if (totalSqm > 0) {
            setAreaSqm(totalSqm);
          } else if (first.areaSqm != null) {
            setAreaSqm(first.areaSqm);
          } else {
            setAreaSqm(null);
            setFields((f) => ({ ...f, area: "" }));
          }
          setDlsMapStatus("ready");
          if (!industryType) {
            hintRegulation([governorate, directorate, village, basin, neighborhood, parcel].join("|"));
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
    fields.industryType,
    lang,
  ]);

  function hintRegulation(key: string) {
    setAwaitingRegulationAfterPin(true);
    if (regulationHintKeyRef.current === key) return;
    regulationHintKeyRef.current = key;
    window.setTimeout(() => {
      regulationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }

  useEffect(() => {
    if (fields.industryType) {
      setAwaitingRegulationAfterPin(false);
      regulationHintKeyRef.current = "";
    }
  }, [fields.industryType]);

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

  const MAX_IMAGES = 10;
  const MAX_IMAGE_MB = 8;
  const MAX_VIDEO_MB = 110;
  const MAX_DOCUMENT_MB = 15;

  function handleImagesChange(files: File[]) {
    if (files.length > MAX_IMAGES) {
      setFileError(lang === "ar" ? `الحد الأقصى ${MAX_IMAGES} صور.` : `Maximum ${MAX_IMAGES} images.`);
      return;
    }
    const oversized = files.find((f) => f.size > MAX_IMAGE_MB * 1024 * 1024);
    if (oversized) {
      setFileError(lang === "ar" ? `كل صورة يجب ألا تتجاوز ${MAX_IMAGE_MB} ميجابايت.` : `Each image must be under ${MAX_IMAGE_MB}MB.`);
      return;
    }
    setFileError("");
    setImages(files.slice(0, MAX_IMAGES));
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
      setIsMultiParcelOffer(false);
      setParcelEntries([parcel]);
      setFields((f) => ({
        ...f,
        coordinates: coordsToString({ lat: pointParcel.latitude, lng: pointParcel.longitude }),
        governorate: selection.governorate,
        directorate: selection.directorate,
        village: selection.village,
        basin: selection.basin,
        neighborhood: selection.neighborhood,
        parcel,
        ...(pointParcel.areaSqm != null ? { area: formatDlsArea(pointParcel.areaSqm, lang) } : {}),
      }));
      setParcelPolygon(pointParcel.rings?.length ? pointParcel.rings : null);
      setAdjacentRoads(pointParcel.adjacentRoads ?? []);
      setDlsKey(pointParcel.dlsKey || null);
      setAreaSqm(pointParcel.areaSqm ?? null);
      setDlsMapStatus("ready");
      if (!fields.industryType) {
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

  function handleVideoChange(files: File[]) {
    const file = files[0] ?? null;
    if (file && file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setFileError(lang === "ar" ? `الفيديو يجب ألا يتجاوز ${MAX_VIDEO_MB} ميجابايت.` : `Video must be under ${MAX_VIDEO_MB}MB.`);
      return;
    }
    setFileError("");
    setVideo(file);
  }

  function handleDocumentChange(files: File[]) {
    const file = files[0] ?? null;
    if (file && file.size > MAX_DOCUMENT_MB * 1024 * 1024) {
      setFileError(lang === "ar" ? `الملف يجب ألا يتجاوز ${MAX_DOCUMENT_MB} ميجابايت.` : `File must be under ${MAX_DOCUMENT_MB}MB.`);
      return;
    }
    setFileError("");
    setDocumentFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

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
    // Sole neighborhood may still be mid-sync from the cascade — pin it before validate/submit.
    let neighborhood = fields.neighborhood.trim();
    if (!neighborhood && neighborhoodOpts.length === 1) {
      neighborhood = neighborhoodOpts[0].label;
      setFields((f) => ({ ...f, neighborhood }));
    } else if (!neighborhood && neighborhoodOpts.length === 0 && fields.basin) {
      neighborhood = DLS_DEFAULT_NEIGHBORHOOD_LABEL;
      setFields((f) => ({ ...f, neighborhood }));
    }

    const missing: string[] = [];
    if (!fields.name.trim()) missing.push(t.owners.fullName);
    if (!fields.phone.trim()) missing.push(t.owners.phone);
    if (!fields.governorate) missing.push(t.owners.governorate);
    if (!fields.directorate) missing.push(t.owners.directorate);
    if (!fields.village) missing.push(t.owners.village);
    if (!fields.basin) missing.push(t.owners.basin);
    if (neighborhoodOpts.length > 0 && !neighborhood) missing.push(t.owners.neighborhood);
    if (!fields.parcel.trim()) missing.push(t.owners.parcel);
    if (!fields.industryType) missing.push(t.owners.industryType);
    if (!fields.details.trim()) missing.push(t.owners.landDetails);
    const normalizedPrice = normalizeDecimalInput(fields.price).replace(/[^\d.]/g, "");
    const priceOk = /^\d+(\.\d+)?$/.test(normalizedPrice);
    if (!priceOk) missing.push(t.owners.price);
    if (missing.length) {
      setError(`${t.owners.missingFields} ${missing.join(lang === "ar" ? "، " : ", ")}`);
      return;
    }
    const parcelNos = parseParcelNumbers(fields.parcel);
    if (isMultiParcelOffer) {
      if (parcelNos.length < 2) {
        setError(lang === "ar" ? "حدد قطعتين على الأقل ضمن العرض متعدد القطع." : "Select at least two parcels for a multi-land offer.");
        return;
      }
      if (parcelNos.length > MAX_MULTI_PARCELS) {
        setError(
          lang === "ar"
            ? `لا يمكن إضافة أكثر من ${MAX_MULTI_PARCELS} قطع في العرض الواحد.`
            : `You cannot add more than ${MAX_MULTI_PARCELS} parcels in one offer.`
        );
        return;
      }
      if (!areParcelNumbersConsecutive(parcelNos)) {
        setError(
          lang === "ar"
            ? "يجب إدخال أرقام القطع بترتيب متتالٍ (فرق 1). مثال: 706، 707، 708."
            : "Parcel numbers must be entered in consecutive order (difference 1). Example: 706, 707, 708."
        );
        return;
      }
    }
    if (!areaSqm || areaSqm <= 0 || !fields.area) {
      setError(t.owners.areaRequiredError);
      return;
    }
    if (source === "broker" && (!fields.office || !fields.whatsapp || !fields.authExpiry || !authorized)) {
      setError(t.owners.brokerRequiredError);
      return;
    }
    if (!priceConsent || (source === "broker" && !marketingConsent)) {
      setError(t.owners.consentError);
      return;
    }

    const bot = botRef.current?.getPayload();
    if (!bot) {
      setError(t.botGuard.required);
      return;
    }
    setSubmitting(true);
    try {
      const location = parseCoords(fields.coordinates);
      const submission = await api.submitLead(
        {
          source,
          applicant: fields.name,
          phone: fields.phone,
          office: source === "broker" ? fields.office : undefined,
          whatsapp: source === "broker" ? fields.whatsapp : undefined,
          email: fields.email || undefined,
          authExpiry: source === "broker" ? fields.authExpiry : undefined,
          governorate: fields.governorate,
          directorate: fields.directorate,
          village: fields.village,
          basin: fields.basin,
          parcel: fields.parcel,
          neighborhood: neighborhood || fields.neighborhood || DLS_DEFAULT_NEIGHBORHOOD_LABEL,
          coordinates: fields.coordinates,
          latitude: location ? String(location.lat) : undefined,
          longitude: location ? String(location.lng) : undefined,
          address: fields.address || undefined,
          area: fields.area,
          price: normalizedPrice,
          administrativeValue: dlsHint ? String(dlsHint.value) : undefined,
          administrativeValueSource: dlsHint?.source,
          administrativeValueAt: dlsHint?.retrievedAt,
          dlsKey: dlsKey || undefined,
          industryType: fields.industryType || undefined,
          activity: fields.activity,
          details: fields.details,
        },
        { images, video: video ?? undefined, document: documentFile ?? undefined },
        bot
      );

      const statusLabel = submission.duplicate
        ? t.admin.tabsSubmissions.duplicate_review
        : t.admin.tabsSubmissions.pending;
      const intro = source === "broker" ? t.owners.whatsappIntroBroker : t.owners.whatsappIntroOwner;
      const lines = [
        intro,
        "",
        `${t.owners.fullName}: ${fields.name}`,
        `${t.owners.phone}: ${fields.phone}`,
        ...(source === "broker"
          ? [`${t.owners.brokerOffice}: ${fields.office}`, `${t.owners.brokerWhatsapp}: ${fields.whatsapp}`, `${t.owners.brokerAuthExpiry}: ${fields.authExpiry}`]
          : []),
        "",
        `${t.owners.governorate}: ${localizePlaceName(fields.governorate, lang)}`,
        `${t.owners.directorate}: ${localizePlaceName(fields.directorate, lang)}`,
        `${t.owners.village}: ${localizePlaceName(fields.village, lang)}`,
        `${t.owners.basin}: ${localizePlaceName(fields.basin, lang)}`,
        `${t.owners.parcel}: ${fields.parcel}`,
        `${t.owners.area}: ${fields.area ? localizeSizeLabel(fields.area, lang) : t.owners.notProvided}`,
        `${t.owners.price}: ${normalizedPrice || t.owners.notProvided}`,
        `${t.owners.landDetails}: ${fields.details}`,
        `${t.owners.whatsappFiles}: ${submission.images.length}${submission.video ? ` + ${t.admin.approveModal.video}` : ""}${submission.document ? ` + ${t.admin.approveModal.pdf}` : ""}`,
        "",
        `${t.owners.whatsappSerial}: ${submission.serialNo}`,
        `${t.owners.whatsappStatus}: ${statusLabel}`,
        "",
        t.owners.whatsappDisclaimer,
      ];

      setResult({
        serialNo: submission.serialNo,
        trackingCode: submission.trackingCode,
        industryType: fields.industryType,
        emailProvided: Boolean(fields.email),
        whatsappMessage: lines.join("\n"),
      });
      setFields((f) => ({ ...f, details: "" }));
      setImages([]);
      setVideo(null);
      setDocumentFile(null);
    } catch (err) {
      botRef.current?.reset();
      setError(err instanceof ApiError ? err.message : t.owners.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  if (!settings.submissionsEnabled) {
    return (
      <section id="owners" className="py-16">
        <div className="mx-auto max-w-[1240px] px-4">
          <div className="bg-white rounded-2xl border border-line p-10 text-center">
            <span className="text-gold text-xs font-bold uppercase">{t.owners.eyebrow}</span>
            <h2 className="text-2xl font-bold mt-2">{t.owners.title}</h2>
            <p className="text-ink-soft mt-3">
              {lang === "ar"
                ? "استقبال طلبات المالكين والوسطاء متوقف مؤقتًا. يرجى التواصل معنا مباشرة عبر واتساب أو الهاتف."
                : "Owner/broker submissions are temporarily closed. Please contact us directly by WhatsApp or phone."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (result) {
    const setbacks = result.industryType ? SETBACKS[result.industryType] : null;
    return (
      <section id="owners" className="py-16 md:py-20">
        <div className="mx-auto max-w-[640px] px-4">
          <div className="bg-white rounded-[1.75rem] border border-line p-8 md:p-10 shadow-[0_24px_50px_-36px_rgba(15,52,47,0.35)]">
            <div className="w-12 h-12 rounded-full bg-green/10 text-green flex items-center justify-center mx-auto">
              <CheckIcon />
            </div>
            <h2 className="text-2xl font-bold text-center mt-4">{t.owners.resultTitle}</h2>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="bg-surface-2 rounded-xl p-3 text-center">
                <small className="block text-[10px] text-ink-soft">{t.owners.resultSerialLabel}</small>
                <b className="text-sm font-mono" dir="ltr">{result.serialNo}</b>
              </div>
              <div className="bg-surface-2 rounded-xl p-3 text-center">
                <small className="block text-[10px] text-ink-soft">{t.owners.resultTrackingLabel}</small>
                <b className="text-sm font-mono" dir="ltr">{result.trackingCode}</b>
              </div>
            </div>
            <p className="text-xs text-ink-soft text-center mt-3">
              {t.owners.resultTrackingNote}
              {result.emailProvided && <> · {t.owners.resultEmailSentNote}</>}
            </p>
            <Link
              href={`/track/${result.trackingCode}`}
              className="mt-4 h-10 rounded-full border border-line text-sm font-bold flex items-center justify-center hover:bg-surface-2 transition-colors"
            >
              {t.owners.resultTrackNow}
            </Link>

            {setbacks && (
              <div className="mt-6 bg-surface-2 rounded-2xl p-4">
                <p className="text-xs font-bold text-green mb-3">{t.owners.setbacksTitle}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                  <div>
                    <small className="block text-[10px] text-ink-soft">{t.owners.setbacksFrontal}</small>
                    <b className="text-sm">
                      {setbacks.frontal === "on-request" ? t.owners.setbacksOnRequest : `${setbacks.frontal} ${t.owners.setbacksMeters}`}
                    </b>
                  </div>
                  <div>
                    <small className="block text-[10px] text-ink-soft">{t.owners.setbacksSide}</small>
                    <b className="text-sm">
                      {setbacks.side === "on-request" ? t.owners.setbacksOnRequest : `${setbacks.side} ${t.owners.setbacksMeters}`}
                    </b>
                  </div>
                  <div>
                    <small className="block text-[10px] text-ink-soft">{t.owners.setbacksRear}</small>
                    <b className="text-sm">
                      {setbacks.rear === "on-request" ? t.owners.setbacksOnRequest : `${setbacks.rear} ${t.owners.setbacksMeters}`}
                    </b>
                  </div>
                  <div>
                    <small className="block text-[10px] text-ink-soft">{t.owners.setbacksBuildPercentage}</small>
                    <b className="text-sm">
                      {setbacks.buildPercentage === "on-request" ? t.owners.setbacksOnRequest : setbacks.buildPercentage}
                    </b>
                  </div>
                  <div>
                    <small className="block text-[10px] text-ink-soft">{t.owners.setbacksHeight}</small>
                    <b className="text-sm">
                      {setbacks.height === "on-request"
                        ? t.owners.setbacksOnRequest
                        : setbacks.height === "9-ex-roof"
                          ? t.owners.setbacksHeightExRoof
                          : `${setbacks.height} ${t.owners.setbacksMeters}`}
                    </b>
                  </div>
                  <div>
                    <small className="block text-[10px] text-ink-soft">{t.owners.setbacksFloors}</small>
                    <b className="text-sm">
                      {setbacks.floors === "on-request"
                        ? t.owners.setbacksOnRequest
                        : setbacks.floors === "2+roof"
                          ? t.owners.setbacksFloorsRoof
                          : setbacks.floors}
                    </b>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => openWhatsapp(result.whatsappMessage, settings.whatsappNumber)}
                className="h-12 rounded-full bg-green text-white font-bold flex flex-col items-center justify-center gap-0.5 hover:bg-green-2 transition-colors"
              >
                <span>{t.owners.resultWhatsappCta}</span>
              </button>
              <p className="text-[11px] text-ink-soft text-center -mt-2">{t.owners.resultWhatsappNote}</p>

              <button
                type="button"
                onClick={() => setResult(null)}
                className="h-12 rounded-full border border-line font-bold flex flex-col items-center justify-center gap-0.5 hover:bg-surface-2 transition-colors"
              >
                <span>{t.owners.resultReviewCta}</span>
              </button>
              <p className="text-[11px] text-ink-soft text-center -mt-2">{t.owners.resultReviewNote}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const mapStatusLabel =
    dlsMapStatus === "loading"
      ? t.owners.dlsMapLoading
      : dlsMapStatus === "ready"
        ? awaitingRegulationAfterPin && !fields.industryType
          ? t.owners.regulationHint
          : t.owners.dlsMapReady
        : dlsMapStatus === "missing"
          ? t.owners.dlsMapMissing
          : dlsMapStatus === "failed"
            ? t.owners.dlsMapFailed
            : t.owners.dlsMapIdle;

  const searchPanel = (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 rounded-full border border-line bg-white p-1">
        <button
          type="button"
          onClick={() => setSource("owner")}
          className={`h-9 flex-1 rounded-full text-sm font-bold transition-colors ${source === "owner" ? "bg-green text-white" : "text-ink-soft hover:text-ink"}`}
        >
          {t.owners.tabOwner}
        </button>
        <button
          type="button"
          onClick={() => setSource("broker")}
          className={`h-9 flex-1 rounded-full text-sm font-bold transition-colors ${source === "broker" ? "bg-green text-white" : "text-ink-soft hover:text-ink"}`}
        >
          {t.owners.tabBroker}
        </button>
      </div>

      {source === "broker" && (
        <div className="grid gap-3 rounded-xl border border-line bg-white/70 p-3">
          <div>
            <label className={labelClass} htmlFor="owner-office">
              {t.owners.brokerOffice}
            </label>
            <input id="owner-office" className={inputClass} value={fields.office} onChange={update("office")} />
          </div>
          <div>
            <label className={labelClass} htmlFor="owner-whatsapp">
              {t.owners.brokerWhatsapp}
            </label>
            <input
              id="owner-whatsapp"
              type="tel"
              className={inputClass}
              value={fields.whatsapp}
              onChange={updateDigits("whatsapp")}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="owner-authExpiry">
              {t.owners.brokerAuthExpiry}
            </label>
            <input
              id="owner-authExpiry"
              className={inputClass}
              type="date"
              value={fields.authExpiry}
              onChange={update("authExpiry")}
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={authorized}
              onChange={(e) => setAuthorized(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-green"
            />
            {t.owners.brokerAuthorization}
          </label>
        </div>
      )}

      <div className="border-t border-line pt-3">
        <p className="mb-2 text-xs font-bold text-green">{t.owners.landSection}</p>
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
        <div className="mt-3">
          <label className={labelClass} htmlFor="owner-parcel">
            {t.owners.parcel}
          </label>
          <label className="mb-2 flex items-start gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-green"
              checked={isMultiParcelOffer}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsMultiParcelOffer(checked);
                setParcelEntries((prev) => {
                  const cleaned = prev.map((value) => sanitizeParcelNumberInput(value)).filter(Boolean);
                  if (!checked) return [cleaned[0] ?? ""];
                  if (cleaned.length >= 2) return cleaned.slice(0, MAX_MULTI_PARCELS);
                  return [cleaned[0] ?? "", ""];
                });
              }}
            />
            <span>
              {lang === "ar"
                ? "هذا عرض متعدد القطع (الأرقام متتالية بفارق 1)."
                : "This is a multi-land offer (parcel numbers must be consecutive by 1)."}
            </span>
          </label>
          <div className="grid gap-2">
            {parcelEntries.map((value, idx) => (
              <div key={`parcel-entry-${idx}`} className="flex items-center gap-2">
                <input
                  className={inputClass}
                  value={value}
                  onChange={(e) =>
                    setParcelEntries((prev) =>
                      prev.map((item, i) => (i === idx ? sanitizeParcelNumberInput(e.target.value) : item))
                    )
                  }
                  inputMode="numeric"
                  placeholder={
                    isMultiParcelOffer ? `${t.owners.enterParcelN} ${idx + 1}` : t.owners.enterParcel
                  }
                  required={idx === 0}
                />
                {isMultiParcelOffer && parcelEntries.length > 2 && (
                  <button
                    type="button"
                    className="h-11 rounded-xl border border-line bg-white px-3 text-xs font-bold"
                    onClick={() => setParcelEntries((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    {lang === "ar" ? "حذف" : "Remove"}
                  </button>
                )}
              </div>
            ))}
          </div>
          {isMultiParcelOffer && (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="h-9 rounded-full border border-line bg-white px-3 text-xs font-bold disabled:opacity-60"
                disabled={parcelEntries.length >= MAX_MULTI_PARCELS}
                onClick={() =>
                  setParcelEntries((prev) => (prev.length >= MAX_MULTI_PARCELS ? prev : [...prev, ""]))
                }
              >
                {lang === "ar" ? "+ إضافة قطعة أخرى" : "+ Add another parcel"}
              </button>
              <p className="text-[11px] text-ink-soft">
                {lang === "ar"
                  ? `يبدأ بقطعتين — حتى ${MAX_MULTI_PARCELS} قطع.`
                  : `Starts with 2 parcels — up to ${MAX_MULTI_PARCELS}.`}
              </p>
            </div>
          )}
          {parcelOrderError && (
            <p className="mt-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-600">{parcelOrderError}</p>
          )}
        </div>
      </div>

      <div
        ref={regulationSectionRef}
        className={`border-t border-line pt-3 ${
          awaitingRegulationAfterPin && !fields.industryType
            ? "rounded-xl border border-amber-200 bg-amber-50/80 p-3"
            : ""
        }`}
      >
        <p className="mb-2 text-xs font-bold text-green">{t.owners.regulationSection}</p>
        {awaitingRegulationAfterPin && !fields.industryType && (
          <p className="mb-2 rounded-lg border border-amber-300 bg-white px-2.5 py-2 text-[11px] font-bold leading-relaxed text-amber-900">
            {t.owners.regulationHint}
          </p>
        )}
        <RegulationGuide
          scope="all"
          value={fields.industryType}
          onChange={(value) => {
            setFields((f) => ({ ...f, industryType: value }));
            if (value) setAwaitingRegulationAfterPin(false);
          }}
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
      <p className="text-xs font-bold text-green">{t.owners.detailsSection}</p>
      <div>
        <label className={labelClass} htmlFor="owner-area">
          {t.owners.area}
        </label>
        <input
          id="owner-area"
          className={inputClass}
          value={fields.area}
          readOnly
          placeholder={lang === "ar" ? "تُعبأ تلقائيًا من دائرة الأراضي" : "Auto-filled from DLS"}
        />
        {dlsMapStatus === "ready" && fields.area && (
          <p className="mt-1.5 text-[11px] text-ink-soft">{t.owners.areaDlsNote}</p>
        )}
      </div>
      <div>
        <label className={labelClass} htmlFor="owner-price">
          {t.owners.price}
        </label>
        <input
          id="owner-price"
          className={inputClass}
          value={fields.price}
          onChange={updatePrice}
          inputMode="decimal"
          autoComplete="off"
          placeholder={lang === "ar" ? "مثال: 60" : "e.g. 60"}
        />
        <p className="mt-1.5 text-[11px] text-ink-soft">{t.owners.pricePerSqmNote}</p>
        {/* Official DLS $/m² hint — desktop only; mobile unified sheet omits admin pricing */}
        <div className="hidden md:block">
          {dlsHintStatus === "loading" && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-[11px] text-ink-soft">
              <span className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-green/25 border-t-green animate-spin" aria-hidden />
              <span>{t.owners.dlsHintLoading}</span>
            </div>
          )}
          {dlsHintStatus === "missing" && (
            <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] leading-relaxed text-red-700">
              {t.owners.dlsHintMissing}
            </p>
          )}
          {dlsHintStatus === "failed" && <p className="mt-2 text-[11px] text-ink-soft">{t.owners.dlsHintFailed}</p>}
          {dlsHint && (
            <DlsPricingHint
              ratePerSqm={dlsHint.value}
              areaSqm={areaSqm}
              sizeLabel={fields.area}
              source={dlsHint.source}
              retrievedAt={dlsHint.retrievedAt}
            />
          )}
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="owner-activity">
          {t.owners.activity}
        </label>
        <select id="owner-activity" className={inputClass} value={fields.activity} onChange={update("activity")}>
          <option value="">{t.owners.selectActivity}</option>
          {ACTIVITY_KEYS.map((key) => (
            <option key={key} value={key}>
              {t.activities[key]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t.owners.landDetails}</label>
        <textarea
          className={`${inputClass} h-24 min-h-[5rem] resize-y py-2`}
          value={fields.details}
          onChange={update("details")}
          placeholder={t.owners.landDetailsPlaceholder}
          required
        />
      </div>
      <div className="grid gap-3">
        <div>
          <label className={labelClass}>{lang === "ar" ? "الصور (حتى 10)" : "Photos (up to 10)"}</label>
          <FilePickerButton
            label={lang === "ar" ? "اختر الصور" : "Choose photos"}
            icon={<ImageIcon className="w-4 h-4" />}
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onFiles={handleImagesChange}
          />
          {images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {images.map((file, i) => (
                <span key={i} className="rounded-full bg-white px-2 py-1 text-[10px] ring-1 ring-line">
                  {file.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className={labelClass}>
            {lang === "ar" ? "فيديو (اختياري، ملف واحد)" : "Video (optional, one file)"}
          </label>
          <FilePickerButton
            label={lang === "ar" ? "اختر فيديو" : "Choose video"}
            icon={<VideoIcon className="w-4 h-4" />}
            accept="video/*,.mp4,.mov,.movie,.qt,.m4v,.3gp,.3g2,.mkv,.webm,.avi,.mpeg,.mpg,.ogv,.wmv,.flv,.hevc,.vod"
            onFiles={handleVideoChange}
          />
          {video && <p className="mt-1 text-[10px] text-ink-soft">{video.name}</p>}
        </div>
        <div>
          <label className={labelClass}>
            {lang === "ar" ? "مخطط أو PDF (اختياري، ملف واحد)" : "Plan / PDF (optional, one file)"}
          </label>
          <FilePickerButton
            label={lang === "ar" ? "اختر ملف PDF" : "Choose PDF"}
            icon={<DocumentIcon className="w-4 h-4" />}
            accept="application/pdf"
            onFiles={handleDocumentChange}
          />
          {documentFile && <p className="mt-1 text-[10px] text-ink-soft">{documentFile.name}</p>}
        </div>
      </div>
      {fileError && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-600">{fileError}</p>}
      <p className="text-[11px] text-ink-soft">{t.owners.filesNote}</p>

      <div className="border-t border-line pt-3">
        <p className="mb-2 text-xs font-bold text-green">{t.owners.applicantSection}</p>
        <div className="grid gap-3">
          <div>
            <label className={labelClass} htmlFor="owner-name">
              {t.owners.fullName}
            </label>
            <input id="owner-name" className={inputClass} value={fields.name} onChange={update("name")} required />
          </div>
          <div>
            <label className={labelClass} htmlFor="owner-phone">
              {t.owners.phone}
            </label>
            <input
              id="owner-phone"
              type="tel"
              className={inputClass}
              value={fields.phone}
              onChange={updateDigits("phone")}
              placeholder="07XXXXXXXX"
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="owner-email">
              {t.owners.email}
            </label>
            <input
              id="owner-email"
              type="email"
              dir="ltr"
              className={inputClass}
              value={fields.email}
              onChange={update("email")}
              placeholder="name@example.com"
            />
            <p className="mt-1 text-[11px] text-ink-soft">{t.owners.emailNote}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-line pt-3">
        <p className="mb-2 text-xs font-bold text-green">{t.owners.reviewSection}</p>
        <label className="flex items-start gap-2 text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={priceConsent}
            onChange={(e) => setPriceConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-green"
            required
          />
          {t.owners.priceConsent}
        </label>
        {source === "broker" && (
          <label className="mt-2 flex items-start gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-green"
              required
            />
            {t.owners.marketingConsent}
          </label>
        )}
      </div>

      <BotGuard ref={botRef} action="submit" />
      {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}
    </div>
  );

  return (
    <section id="owners">
      <form onSubmit={handleSubmit} className="contents">
        <ParcelMapWorkspace
          title={t.owners.title}
          subtitle={t.owners.subtitle}
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
            { id: "details", label: lang === "ar" ? "العرض" : "Listing", railLabel: lang === "ar" ? "عرض" : "List" },
          ]}
          panels={{ search: searchPanel, details: detailsPanel }}
          map={
            <LocationInput
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
              areaLabel={fields.area}
              areaSqm={areaSqm}
              showDimensions
              showTopo
              dlsKey={dlsKey}
              parcelNumbers={parseParcelNumbers(fields.parcel)}
              blueprint={{
                governorate: fields.governorate,
                directorate: fields.directorate,
                village: fields.village,
                basin: fields.basin,
                neighborhood: fields.neighborhood,
                parcel: fields.parcel,
                notes: fields.details,
                industryLabel: t.regulations.selectLabel,
                industryValue: fields.industryType
                  ? (t.offers.industry as Record<string, string>)[fields.industryType] || fields.industryType
                  : undefined,
              }}
            />
          }
          footer={
            <button
              type="submit"
              disabled={submitting}
              className="h-9 w-full rounded-md bg-white text-[13px] font-extrabold text-green transition-colors hover:bg-gold disabled:opacity-60"
            >
              {t.owners.submit}
            </button>
          }
        />
      </form>
    </section>
  );
}
