"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { useToast } from "./Toast";
import { Spinner } from "./EmptyState";
import { LocationInput } from "@/components/LocationInput";
import { LocationCascade } from "@/components/LocationCascade";
import { DlsPricingHint } from "@/components/DlsPricingHint";
import { RegulationGuide } from "@/components/RegulationGuide";
import { FilePickerButton } from "@/components/FilePickerButton";
import { ImageIcon, VideoIcon, DocumentIcon } from "@/components/icons";
import type { Listing } from "@/lib/types";
import { parseCoords, coordsToString, formatDlsArea } from "@/lib/mapCoords";
import {
  industrialLandTitle,
  isAutoIndustrialTitle,
  localizeListingTitle,
  localizePlaceName,
  localizePropertyType,
} from "@/lib/localizePlace";
import { toWesternDigits } from "@/lib/arabicDigits";
import { parseAreaSqm } from "@/lib/adminPricing";
import { loadDlsLocations, codesForSelection } from "@/lib/dlsLocations";
import { fetchMergedParcelLocation } from "@/lib/fetchParcelLocations";
import { parseParcelNumbers } from "@/lib/parcelNumbers";

interface MediaItem {
  url: string;
  kind: "image" | "video" | "document";
  position: number;
}

const inputClass = "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";
const labelClass = "text-xs font-bold text-ink-soft mb-1 block";

export function ListingForm({ listing, onClose, onSaved }: { listing: Listing | null; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useLanguage();
  const { showError } = useToast();
  const [fields, setFields] = useState({
    title: listing?.title ?? "",
    area: listing?.area ?? "",
    propertyType: listing?.propertyType ?? "أرض صناعية",
    industryType: listing?.industryType ?? "light",
    dealType: listing?.dealType ?? "sale",
    size: listing?.size ?? "",
    price: listing?.price ?? "",
    governorate: listing?.governorate ?? "",
    directorate: listing?.directorate ?? "",
    village: listing?.village ?? "",
    basin: listing?.basin ?? "",
    neighborhood: listing?.neighborhood ?? "",
    parcel: listing?.parcel ?? "",
    locationUrl: listing?.locationUrl ?? "",
    address: listing?.address ?? "",
    administrativeValue: listing?.administrativeValue ?? null as number | null,
    administrativeValueSource: listing?.administrativeValueSource ?? null as string | null,
    administrativeValueAt: listing?.administrativeValueAt ?? null as string | null,
    phone: listing?.phone ?? "0799996668",
    status: listing?.status ?? "available",
    publishStatus: listing?.publishStatus ?? "published",
    featured: listing?.featured ?? false,
    smsOptIn: listing?.smsOptIn ?? true,
    presenterRole: listing?.presenterRole ?? "",
    presenterName: listing?.presenterName ?? "",
    showPresenter: listing?.showPresenter ?? false,
    showEstimatedValue: listing?.showEstimatedValue ?? true,
    description: listing?.description ?? "",
    internalNotes: listing?.internalNotes ?? "",
  });
  const [images, setImages] = useState<MediaItem[]>(
    (listing?.images ?? []).map((url, i) => ({ url, kind: "image" as const, position: i }))
  );
  const [video, setVideo] = useState<string | null>(listing?.video ?? null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(listing?.document ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingDls, setFetchingDls] = useState(false);
  const [dlsError, setDlsError] = useState("");
  const [parcelPolygon, setParcelPolygon] = useState<[number, number][][] | null>(null);
  const [areaSqm, setAreaSqm] = useState<number | null>(() => parseAreaSqm(listing?.size));

  const update = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setFields((f) => ({ ...f, [key]: value }));
  };

  const updateDigits = (key: "size" | "price" | "parcel" | "phone") => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields((f) => ({ ...f, [key]: toWesternDigits(e.target.value) }));
  };

  function applyLocationPatch(patch: {
    governorate?: string;
    directorate?: string;
    village?: string;
    basin?: string;
    neighborhood?: string;
  }) {
    setFields((f) => {
      const next = { ...f, ...patch };
      const village = patch.village !== undefined ? patch.village : next.village;
      if (village) {
        next.area = village;
        next.propertyType = "أرض صناعية";
        if (isAutoIndustrialTitle(f.title)) {
          // Always store the Arabic canonical title; the public site localizes it.
          next.title = industrialLandTitle(village, "ar");
        }
      }
      return next;
    });
  }

  // When land identity is complete, pull DLS map geometry + calculated area
  // (same path as the public owner form).
  useEffect(() => {
    let cancelled = false;
    const { governorate, directorate, village, basin, neighborhood, parcel } = fields;
    const parcelNo = parcel.trim();
    const timer = setTimeout(async () => {
      if (!governorate || !directorate || !village || !basin || !neighborhood || !parcelNo) {
        setParcelPolygon(null);
        return;
      }
      try {
        const data = await loadDlsLocations();
        const codes = codesForSelection(data, governorate, directorate, village, basin, neighborhood);
        if (!codes || cancelled) return;
        const primaryParcel = parseParcelNumbers(parcelNo)[0] || parcelNo;
        const [location, adminValue] = await Promise.all([
          fetchMergedParcelLocation(codes, parcelNo, (q) => api.dlsParcelLocation(q)),
          api
            .dlsAdministrativeValue({
              governorate,
              directorate,
              village,
              basin,
              neighborhood,
              parcelNumber: primaryParcel,
            })
            .catch(() => null),
        ]);
        if (cancelled) return;
        setParcelPolygon(location.rings);
        setAreaSqm(location.areaSqm);
        setFields((f) => ({
          ...f,
          locationUrl: coordsToString({ lat: location.latitude, lng: location.longitude }),
          size: location.areaSqm != null ? formatDlsArea(location.areaSqm, lang) : f.size,
          area: village || f.area,
          title: isAutoIndustrialTitle(f.title) ? industrialLandTitle(village, "ar") : f.title,
          propertyType: "أرض صناعية",
          ...(adminValue
            ? {
                administrativeValue: adminValue.value,
                administrativeValueSource: adminValue.source,
                administrativeValueAt: adminValue.retrievedAt,
              }
            : {}),
        }));
        setDlsError("");
      } catch (err) {
        if (!cancelled) {
          setParcelPolygon(null);
          setDlsError(err instanceof ApiError ? err.message : t.admin.listingForm.dlsFetchFailed);
        }
      }
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // lf is defined later in render — use dictionary via t in catch instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.governorate, fields.directorate, fields.village, fields.basin, fields.neighborhood, fields.parcel, lang]);

  async function handleImageUpload(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded: MediaItem[] = [];
      for (const file of files.slice(0, 8 - images.length)) {
        const { url } = await api.upload(file);
        uploaded.push({ url, kind: "image", position: images.length + uploaded.length });
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  async function handleSingleUpload(file: File | null, set: (url: string) => void) {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.upload(file);
      set(url);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  async function handleFetchDlsValue() {
    if (!fields.governorate || !fields.directorate || !fields.village || !fields.basin || !fields.neighborhood || !fields.parcel) {
      setDlsError(lf.dlsMissingFields);
      return;
    }
    setFetchingDls(true);
    setDlsError("");
    try {
      const result = await api.dlsAdministrativeValue({
        governorate: fields.governorate,
        directorate: fields.directorate,
        village: fields.village,
        basin: fields.basin,
        neighborhood: fields.neighborhood,
        parcelNumber: fields.parcel,
      });
      setFields((f) => ({
        ...f,
        administrativeValue: result.value,
        administrativeValueSource: result.source,
        administrativeValueAt: result.retrievedAt,
      }));
    } catch (err) {
      setDlsError(err instanceof ApiError ? err.message : lf.dlsFetchFailed);
    } finally {
      setFetchingDls(false);
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index).map((m, i) => ({ ...m, position: i })));
  }

  function setCover(index: number) {
    setImages((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.unshift(item);
      return copy.map((m, i) => ({ ...m, position: i }));
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const media: MediaItem[] = [
      ...images,
      ...(video ? [{ url: video, kind: "video" as const, position: 0 }] : []),
      ...(documentUrl ? [{ url: documentUrl, kind: "document" as const, position: 0 }] : []),
    ];
    const location = parseCoords(fields.locationUrl);
    const payload = { ...fields, latitude: location?.lat, longitude: location?.lng, presenterRole: fields.presenterRole || null, media };
    try {
      if (listing) await api.updateListing(listing.id, payload);
      else await api.createListing(payload);
      onSaved();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const lf = t.admin.listingForm;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{listing ? listing.listingNo : lf.titleNew}</h2>
          <button type="button" onClick={onClose} className="text-sm text-ink-soft">
            {t.admin.cancel}
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={labelClass}>{lf.title}</label>
            <input className={inputClass} value={fields.title} onChange={update("title")} required maxLength={120} />
            {lang === "en" && isAutoIndustrialTitle(fields.title) && fields.title ? (
              <p className="text-[11px] text-ink-soft mt-1.5" dir="ltr">
                {localizeListingTitle(fields.title, "en")}
              </p>
            ) : null}
          </div>
          <div>
            <label className={labelClass}>{lf.area}</label>
            <input className={inputClass} value={fields.area} onChange={update("area")} required />
            {lang === "en" && fields.area && fields.village && fields.area === fields.village ? (
              <p className="text-[11px] text-ink-soft mt-1.5" dir="ltr">
                {localizePlaceName(fields.area, "en")}
              </p>
            ) : null}
          </div>
          <div>
            <label className={labelClass}>{lf.propertyType}</label>
            <input className={inputClass} value={fields.propertyType} onChange={update("propertyType")} />
            {lang === "en" && fields.propertyType ? (
              <p className="text-[11px] text-ink-soft mt-1.5" dir="ltr">
                {localizePropertyType(fields.propertyType, "en", fields.propertyType)}
              </p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <RegulationGuide
              scope="all"
              value={fields.industryType}
              onChange={(value) => {
                if (value) setFields((f) => ({ ...f, industryType: value }));
              }}
            />
          </div>
          <div>
            <label className={labelClass}>{lf.dealType}</label>
            <select className={inputClass} value={fields.dealType} onChange={update("dealType")}>
              <option value="sale">{lf.dealSale}</option>
              <option value="rent">{lf.dealRent}</option>
              <option value="sale_or_rent">{lf.dealSaleOrRent}</option>
              <option value="partnership">{lf.dealPartnership}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{lf.size}</label>
            <input className={inputClass} value={fields.size} onChange={(e) => {
              updateDigits("size")(e);
              setAreaSqm(parseAreaSqm(toWesternDigits(e.target.value)));
            }} />
          </div>
          <div>
            <label className={labelClass}>{lf.price}</label>
            <input className={inputClass} value={fields.price} onChange={updateDigits("price")} />
          </div>
          <div className="sm:col-span-2">
            <LocationCascade
              governorate={fields.governorate}
              directorate={fields.directorate}
              village={fields.village}
              basin={fields.basin}
              neighborhood={fields.neighborhood}
              onChange={applyLocationPatch}
              required={false}
              labels={{
                governorate: t.owners.governorate,
                directorate: t.owners.directorate,
                village: t.owners.village,
                basin: lf.basin,
                neighborhood: t.owners.neighborhood,
                other: t.owners.locationOther,
              }}
            />
          </div>
          <div>
            <label className={labelClass}>{lf.parcel}</label>
            <input className={inputClass} value={fields.parcel} onChange={updateDigits("parcel")} />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleFetchDlsValue}
              disabled={fetchingDls}
              className="self-start h-10 px-4 rounded-full border border-line bg-surface-2 text-xs font-bold disabled:opacity-60 flex items-center gap-2"
            >
              {fetchingDls && <Spinner className="w-3.5 h-3.5" />}
              {lf.dlsFetchCta}
            </button>
            {dlsError && <p className="text-xs text-red-600">{dlsError}</p>}
            {fields.administrativeValue !== null && (
              <DlsPricingHint
                ratePerSqm={fields.administrativeValue}
                areaSqm={areaSqm}
                sizeLabel={fields.size}
                source={fields.administrativeValueSource}
                retrievedAt={fields.administrativeValueAt}
                className="rounded-xl border border-gold/40 bg-gold/10 p-3 text-xs leading-relaxed"
              />
            )}
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>{lf.location}</label>
            <LocationInput
              key={parcelPolygon ? "dls-locked" : "dls-editable"}
              value={fields.locationUrl}
              onChange={(v) => setFields((f) => ({ ...f, locationUrl: v }))}
              address={fields.address}
              onAddressChange={(address) => setFields((f) => ({ ...f, address }))}
              polygon={parcelPolygon}
              lockEditing={Boolean(parcelPolygon)}
            />
          </div>
          <div>
            <label className={labelClass}>{lf.phone}</label>
            <input className={inputClass} value={fields.phone} onChange={updateDigits("phone")} />
          </div>
          <div>
            <label className={labelClass}>{lf.propertyStatus}</label>
            <select className={inputClass} value={fields.status} onChange={update("status")}>
              <option value="available">{t.offers.status.available}</option>
              <option value="reserved">{t.offers.status.reserved}</option>
              <option value="sold">{t.offers.status.sold}</option>
              <option value="rented">{t.offers.status.rented}</option>
              <option value="canceled">{t.offers.status.canceled}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{lf.publishStatus}</label>
            <select className={inputClass} value={fields.publishStatus} onChange={update("publishStatus")}>
              <option value="published">{t.admin.tabsListings.published}</option>
              <option value="draft">{t.admin.tabsListings.draft}</option>
              <option value="archived">{t.admin.tabsListings.archived}</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={fields.featured} onChange={update("featured")} className="accent-green w-4 h-4" />
            {lf.featured}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={fields.smsOptIn} onChange={update("smsOptIn")} className="accent-green w-4 h-4" />
            {t.admin.smsOptIn}
          </label>
          {listing?.ownerAccessCode && (
            <div className="sm:col-span-2 rounded-xl border border-line bg-surface-2/80 p-3 text-xs">
              <p className="font-bold text-ink-soft">{t.admin.ownerCode}</p>
              <p className="font-mono mt-1" dir="ltr">
                {listing.ownerAccessCode}
              </p>
              <p className="mt-1 text-ink-soft" dir="ltr">
                {t.admin.ownerLink}: /my-offer/{listing.ownerAccessCode}
              </p>
            </div>
          )}
          <div>
            <label className={labelClass}>{lf.presenterRole}</label>
            <select className={inputClass} value={fields.presenterRole} onChange={update("presenterRole")}>
              <option value="">{lf.none}</option>
              <option value="owner">{t.offers.presenterRole.owner}</option>
              <option value="presenter">{t.offers.presenterRole.presenter}</option>
              <option value="broker">{t.offers.presenterRole.broker}</option>
              <option value="company">{t.offers.presenterRole.company}</option>
              <option value="other">{t.offers.presenterRole.other}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{lf.presenterName}</label>
            <input className={inputClass} value={fields.presenterName} onChange={update("presenterName")} />
          </div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={fields.showPresenter} onChange={update("showPresenter")} className="accent-green w-4 h-4" />
            {lf.showPresenter}
          </label>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fields.showEstimatedValue}
              onChange={update("showEstimatedValue")}
              className="accent-green w-4 h-4"
            />
            {lf.showEstimatedValue}
          </label>
          <div className="sm:col-span-2">
            <label className={labelClass}>{lf.description}</label>
            <textarea className={`${inputClass} h-24 py-2`} value={fields.description} onChange={update("description")} required maxLength={1800} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>{lf.internalNotes}</label>
            <textarea className={`${inputClass} h-16 py-2`} value={fields.internalNotes} onChange={update("internalNotes")} />
          </div>
        </div>

        <div>
          <label className={labelClass}>{lf.images}</label>
          <FilePickerButton
            label={uploading ? t.admin.standbyUploading : lf.images}
            icon={<ImageIcon className="w-4 h-4" />}
            accept="image/*"
            multiple
            disabled={uploading || images.length >= 8}
            onFiles={handleImageUpload}
          />
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
            {images.map((img, i) => (
              <div key={img.url} className="relative rounded-lg overflow-hidden border border-line">
                <img src={img.url} alt="" className="w-full h-20 object-cover" />
                {i === 0 && <span className="absolute top-1 start-1 bg-green text-white text-[9px] px-1.5 rounded-full">{lf.cover}</span>}
                <div className="flex">
                  {i !== 0 && (
                    <button type="button" onClick={() => setCover(i)} className="flex-1 text-[9px] bg-surface-2 py-1">
                      {lf.cover}
                    </button>
                  )}
                  <button type="button" onClick={() => removeImage(i)} className="flex-1 text-[9px] bg-red-50 text-red-600 py-1">
                    {t.admin.delete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{lf.video}</label>
            <FilePickerButton
              label={lf.video}
              icon={<VideoIcon className="w-4 h-4" />}
              accept="video/*"
              disabled={uploading}
              onFiles={(files) => handleSingleUpload(files[0] ?? null, setVideo)}
            />
            {video && <p className="text-[11px] text-ink-soft mt-1 truncate">{video}</p>}
          </div>
          <div>
            <label className={labelClass}>{lf.document}</label>
            <FilePickerButton
              label={lf.document}
              icon={<DocumentIcon className="w-4 h-4" />}
              accept="application/pdf"
              disabled={uploading}
              onFiles={(files) => handleSingleUpload(files[0] ?? null, setDocumentUrl)}
            />
            {documentUrl && <p className="text-[11px] text-ink-soft mt-1 truncate">{documentUrl}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 px-4 rounded-full border border-line text-sm">
            {t.admin.cancel}
          </button>
          <button type="submit" disabled={saving || uploading} className="h-11 px-6 rounded-full bg-green text-white text-sm font-bold disabled:opacity-60 flex items-center gap-2">
            {saving && <Spinner className="w-4 h-4" />}
            {t.admin.save}
          </button>
        </div>
      </form>
    </div>
  );
}
