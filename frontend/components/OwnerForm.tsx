"use client";

import { useEffect, useState } from "react";
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
import { toWesternDigits } from "@/lib/arabicDigits";
import { LocationInput } from "@/components/LocationInput";
import { FilePickerButton } from "@/components/FilePickerButton";
import { parseCoords, coordsToString, formatDlsArea } from "@/lib/mapCoords";
import { loadDlsLocations, codesForSelection } from "@/lib/dlsLocations";
import type { IndustryType } from "@/lib/types";

const ACTIVITY_KEYS = ["food", "pharma", "packaging", "logistics", "plastic", "wood", "metal", "stone", "blocks", "other"] as const;

const inputClass =
  "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";
const labelClass = "text-xs font-bold text-ink-soft mb-1 block";

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
  const [dlsHint, setDlsHint] = useState<{ value: number; currency: string; source: string; retrievedAt: string } | null>(null);
  const [dlsHintStatus, setDlsHintStatus] = useState<"idle" | "loading" | "missing" | "failed">("idle");
  const [dlsMapStatus, setDlsMapStatus] = useState<"idle" | "loading" | "ready" | "missing" | "failed">("idle");
  const [parcelPolygon, setParcelPolygon] = useState<[number, number][][] | null>(null);
  const [dlsKey, setDlsKey] = useState<string | null>(null);
  const [areaFromDls, setAreaFromDls] = useState(false);
  const [areaSqm, setAreaSqm] = useState<number | null>(null);
  const [result, setResult] = useState<{
    serialNo: string;
    trackingCode: string;
    industryType: IndustryType | "";
    emailProvided: boolean;
    whatsappMessage: string;
  } | null>(null);

  const update = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  const updateDigits = (key: "phone" | "whatsapp" | "parcel" | "price" | "area") => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setFields((f) => ({ ...f, [key]: toWesternDigits(e.target.value) }));

  // Once the land identity is fully entered (including neighborhood, matching
  // the official DLS cascade), fetch the administrative rate as a pricing
  // reference — shown next to the asking-price field, never written into it.
  // In parallel, place the parcel centroid on the map from the DLS cadastral layer.
  useEffect(() => {
    let cancelled = false;
    const governorate = fields.governorate;
    const directorate = fields.directorate;
    const village = fields.village;
    const basin = fields.basin;
    const neighborhood = fields.neighborhood;
    const parcel = fields.parcel.trim();
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (!governorate || !directorate || !village || !basin || !neighborhood || !parcel) {
        setDlsHint(null);
        setDlsHintStatus("idle");
        setDlsMapStatus("idle");
        setParcelPolygon(null);
        setDlsKey(null);
        setAreaSqm(null);
        return;
      }
      setDlsHint(null);
      setDlsHintStatus("loading");
      setDlsMapStatus("loading");
      setParcelPolygon(null);
      setDlsKey(null);
      setAreaSqm(null);

      const valuePromise = api
        .dlsAdministrativeValuePublic({
          governorate,
          directorate,
          village,
          basin,
          neighborhood,
          parcelNumber: parcel,
        })
        .then((result) => {
          if (!cancelled) {
            setDlsHint({
              value: result.value,
              currency: result.currency,
              source: result.source,
              retrievedAt: result.retrievedAt,
            });
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
          const location = await api.dlsParcelLocationPublic({
            ...codes,
            parcelNumber: parcel,
          });
          if (cancelled) return;
          setParcelPolygon(location.rings);
          setDlsKey(location.dlsKey);
          setFields((f) => ({
            ...f,
            coordinates: coordsToString({ lat: location.latitude, lng: location.longitude }),
            ...(location.areaSqm != null
              ? { area: formatDlsArea(location.areaSqm, lang) }
              : {}),
          }));
          if (location.areaSqm != null) {
            setAreaSqm(location.areaSqm);
            setAreaFromDls(true);
          } else {
            setAreaSqm(null);
          }
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

  const MAX_IMAGES = 10;
  const MAX_IMAGE_MB = 8;
  const MAX_VIDEO_MB = 60;
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

    if (!fields.name || !fields.phone || !fields.governorate || !fields.directorate || !fields.village || !fields.basin || !fields.neighborhood || !fields.parcel || !fields.industryType || !fields.details) {
      setError(t.owners.requiredError);
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
          neighborhood: fields.neighborhood,
          coordinates: fields.coordinates,
          latitude: location ? String(location.lat) : undefined,
          longitude: location ? String(location.lng) : undefined,
          address: fields.address || undefined,
          area: fields.area,
          price: fields.price,
          administrativeValue: dlsHint ? String(dlsHint.value) : undefined,
          administrativeValueSource: dlsHint?.source,
          administrativeValueAt: dlsHint?.retrievedAt,
          dlsKey: dlsKey || undefined,
          industryType: fields.industryType || undefined,
          activity: fields.activity,
          details: fields.details,
        },
        { images, video: video ?? undefined, document: documentFile ?? undefined }
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
        `${t.owners.price}: ${fields.price || t.owners.notProvided}`,
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

  return (
    <section id="owners" className="py-16 md:py-20">
      <div className="mx-auto max-w-[1240px] px-4 grid lg:grid-cols-[1fr_1.3fr] gap-10">
        <div>
          <span className="text-gold text-xs font-bold tracking-wide">{t.owners.eyebrow}</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-2 text-balance">{t.owners.title}</h2>
          <p className="text-ink-soft mt-3 leading-relaxed">{t.owners.subtitle}</p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {t.owners.steps.map((step) => (
              <div key={step.n} className="bg-white/85 rounded-2xl border border-line p-3.5 transition-colors hover:border-gold/40">
                <span className="w-7 h-7 rounded-full bg-green text-white text-xs flex items-center justify-center font-bold">
                  {step.n}
                </span>
                <b className="block mt-2 text-sm">{step.title}</b>
                <small className="text-ink-soft text-xs">{step.note}</small>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs bg-white/70 border border-line rounded-2xl p-4 leading-relaxed text-ink-soft">{t.owners.duplicateNote}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-[1.75rem] border border-line p-6 md:p-8 flex flex-col gap-4 shadow-[0_24px_50px_-36px_rgba(15,52,47,0.35)]">
          <div className="flex gap-2 p-1 rounded-full bg-surface-2 border border-line">
            <button
              type="button"
              onClick={() => setSource("owner")}
              className={`flex-1 h-10 rounded-full text-sm font-bold transition-colors ${source === "owner" ? "bg-green text-white shadow-[0_8px_18px_-10px_rgba(15,52,47,0.8)]" : "text-ink-soft hover:text-ink"}`}
            >
              {t.owners.tabOwner}
            </button>
            <button
              type="button"
              onClick={() => setSource("broker")}
              className={`flex-1 h-10 rounded-full text-sm font-bold transition-colors ${source === "broker" ? "bg-green text-white shadow-[0_8px_18px_-10px_rgba(15,52,47,0.8)]" : "text-ink-soft hover:text-ink"}`}
            >
              {t.owners.tabBroker}
            </button>
          </div>

          <p className="text-xs font-bold text-green">{t.owners.applicantSection}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="owner-name">{t.owners.fullName}</label>
              <input
                id="owner-name" className={inputClass} value={fields.name} onChange={update("name")} required />
            </div>
            <div>
              <label className={labelClass} htmlFor="owner-phone">{t.owners.phone}</label>
              <input
                id="owner-phone" type="tel" className={inputClass} value={fields.phone} onChange={updateDigits("phone")} placeholder="07XXXXXXXX" required />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="owner-email">{t.owners.email}</label>
              <input
                id="owner-email" type="email" dir="ltr" className={inputClass} value={fields.email} onChange={update("email")} placeholder="name@example.com" />
              <p className="text-[11px] text-ink-soft mt-1">{t.owners.emailNote}</p>
            </div>
          </div>

          {source === "broker" && (
            <div className="grid sm:grid-cols-2 gap-3 bg-surface-2 rounded-xl p-3">
              <div>
                <label className={labelClass} htmlFor="owner-office">{t.owners.brokerOffice}</label>
                <input
                  id="owner-office" className={inputClass} value={fields.office} onChange={update("office")} />
              </div>
              <div>
                <label className={labelClass} htmlFor="owner-whatsapp">{t.owners.brokerWhatsapp}</label>
                <input
                  id="owner-whatsapp" type="tel" className={inputClass} value={fields.whatsapp} onChange={updateDigits("whatsapp")} />
              </div>
              <div>
                <label className={labelClass} htmlFor="owner-authExpiry">{t.owners.brokerAuthExpiry}</label>
                <input
                  id="owner-authExpiry" className={inputClass} type="date" value={fields.authExpiry} onChange={update("authExpiry")} />
              </div>
              <label className="sm:col-span-2 flex items-start gap-2 text-xs text-ink-soft">
                <input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} className="mt-0.5 accent-green w-4 h-4" />
                {t.owners.brokerAuthorization}
              </label>
            </div>
          )}

          <p className="text-xs font-bold text-green">{t.owners.landSection}</p>
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
            <label className={labelClass} htmlFor="owner-parcel">{t.owners.parcel}</label>
            <input
              id="owner-parcel" className={inputClass} value={fields.parcel} onChange={updateDigits("parcel")} required />
          </div>

          <div className="rounded-2xl border border-line bg-white/60 p-3 sm:p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-green">{t.owners.dlsMapSection}</p>
                <p className="text-[11px] text-ink-soft mt-0.5 leading-relaxed">
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
              </div>
              {dlsMapStatus === "loading" && (
                <span className="inline-block w-5 h-5 shrink-0 rounded-full border-2 border-green/25 border-t-green animate-spin" aria-hidden />
              )}
            </div>
            <LocationInput
              key={dlsMapStatus === "ready" ? "dls-locked" : "dls-editable"}
              value={fields.coordinates}
              onChange={(v) => setFields((f) => ({ ...f, coordinates: v }))}
              address={fields.address}
              onAddressChange={(address) => setFields((f) => ({ ...f, address }))}
              polygon={parcelPolygon}
              lockEditing={dlsMapStatus === "ready"}
              loading={dlsMapStatus === "loading"}
              loadingLabel={t.owners.dlsMapLoading}
              statusNote={dlsMapStatus === "ready" ? t.owners.dlsMapReady : undefined}
              idleNote={t.owners.dlsMapIdle}
            />
          </div>

          <p className="text-xs font-bold text-green">{t.owners.detailsSection}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="owner-area">{t.owners.area}</label>
              <input
                id="owner-area"
                className={inputClass}
                value={fields.area}
                onChange={(e) => {
                  setAreaFromDls(false);
                  setAreaSqm(null);
                  updateDigits("area")(e);
                }}
                placeholder={lang === "ar" ? "مثال: 2 دونم" : "e.g. 2 dunums"}
              />
              {areaFromDls && dlsMapStatus === "ready" && (
                <p className="text-[11px] text-ink-soft mt-1.5">{t.owners.areaDlsNote}</p>
              )}
              {dlsMapStatus === "loading" && !fields.area && (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-soft">
                  <span className="inline-block w-3.5 h-3.5 shrink-0 rounded-full border-2 border-green/25 border-t-green animate-spin" aria-hidden />
                  <span>{t.owners.dlsMapLoading}</span>
                </div>
              )}
            </div>
            <div>
              <label className={labelClass} htmlFor="owner-price">{t.owners.price}</label>
              <input
                id="owner-price"
                className={inputClass}
                value={fields.price}
                onChange={updateDigits("price")}
                disabled={dlsHintStatus === "loading"}
                aria-busy={dlsHintStatus === "loading"}
              />
              {dlsHintStatus === "loading" && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[11px] text-ink-soft">
                  <span className="inline-block w-4 h-4 shrink-0 rounded-full border-2 border-green/25 border-t-green animate-spin" aria-hidden />
                  <span>{t.owners.dlsHintLoading}</span>
                </div>
              )}
              {dlsHintStatus === "missing" && (
                <p className="text-[11px] text-red-700 mt-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 leading-relaxed">
                  {t.owners.dlsHintMissing}
                </p>
              )}
              {dlsHintStatus === "failed" && (
                <p className="text-[11px] text-ink-soft mt-2">{t.owners.dlsHintFailed}</p>
              )}
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
            <div className="sm:col-span-2">
              <RegulationGuide
                scope="industrial"
                value={fields.industryType}
                onChange={(value) => setFields((f) => ({ ...f, industryType: value }))}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="owner-activity">{t.owners.activity}</label>
              <select
                id="owner-activity" className={inputClass} value={fields.activity} onChange={update("activity")}>
                <option value="">{t.owners.selectActivity}</option>
                {ACTIVITY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t.activities[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>{t.owners.landDetails}</label>
            <textarea
              className={`${inputClass} h-24 py-2`}
              value={fields.details}
              onChange={update("details")}
              placeholder={t.owners.landDetailsPlaceholder}
              required
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
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
                <div className="flex flex-wrap gap-2 mt-2">
                  {images.map((file, i) => (
                    <span key={i} className="text-[10px] bg-surface-2 rounded-full px-2 py-1">
                      {file.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className={labelClass}>{lang === "ar" ? "فيديو (اختياري، ملف واحد)" : "Video (optional, one file)"}</label>
              <FilePickerButton
                label={lang === "ar" ? "اختر فيديو" : "Choose video"}
                icon={<VideoIcon className="w-4 h-4" />}
                accept="video/mp4,video/webm,video/quicktime"
                onFiles={handleVideoChange}
              />
              {video && <p className="text-[10px] text-ink-soft mt-1">{video.name}</p>}
            </div>
            <div>
              <label className={labelClass}>{lang === "ar" ? "مخطط أو PDF (اختياري، ملف واحد)" : "Plan / PDF (optional, one file)"}</label>
              <FilePickerButton
                label={lang === "ar" ? "اختر ملف PDF" : "Choose PDF"}
                icon={<DocumentIcon className="w-4 h-4" />}
                accept="application/pdf"
                onFiles={handleDocumentChange}
              />
              {documentFile && <p className="text-[10px] text-ink-soft mt-1">{documentFile.name}</p>}
            </div>
          </div>
          {fileError && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3">{fileError}</p>}
          <p className="text-[11px] text-ink-soft -mt-2">{t.owners.filesNote}</p>

          <p className="text-xs font-bold text-green">{t.owners.reviewSection}</p>
          <label className="flex items-start gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={priceConsent} onChange={(e) => setPriceConsent(e.target.checked)} className="mt-0.5 accent-green w-4 h-4" required />
            {t.owners.priceConsent}
          </label>
          {source === "broker" && (
            <label className="flex items-start gap-2 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 accent-green w-4 h-4"
                required
              />
              {t.owners.marketingConsent}
            </label>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="h-12 rounded-full bg-green text-white font-bold disabled:opacity-60"
          >
            {t.owners.submit}
          </button>
        </form>
      </div>
    </section>
  );
}
