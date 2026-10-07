export function normalizeArabicText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAmmanGovernorate(value: string): boolean {
  if (!value) return false;
  const normalized = normalizeArabicText(value);
  if (normalized.includes("العاصمه")) return true;
  if (normalized.includes("عمان")) return true;
  return value.toLowerCase().includes("amman");
}

const AMMAN_GIS_SUPPORTED_DIRECTORATES = [
  "اراضي عمان",
  "اراضي شرق عمان",
  "اراضي غرب عمان",
  "اراضي شمال عمان",
  "اراضي جنوب عمان",
];

export function isAmmanGisSupportedSelection(governorate: string, directorate: string): boolean {
  if (!isAmmanGovernorate(governorate)) return false;
  const normalizedDirectorate = normalizeArabicText(directorate);
  if (!normalizedDirectorate) return false;
  return AMMAN_GIS_SUPPORTED_DIRECTORATES.some(
    (name) => normalizeArabicText(name) === normalizedDirectorate
  );
}
