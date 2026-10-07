/**
 * Convert Eastern Arabic-Indic (٠-٩) and Persian (۰-۹) digits to Western (0-9).
 * Also maps Arabic decimal/thousands separators (٫ ٬) to . and ,.
 * Non-digit characters are left unchanged so mixed strings like "٢٢ دونم" work.
 */
export function toWesternDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06F0))
    .replace(/\u066B/g, ".")
    .replace(/\u066C/g, ",");
}

/**
 * Normalizes user numeric text for tolerant parsing:
 * - converts Arabic/Persian digits
 * - removes inner spaces
 * - accepts Arabic comma/Latin comma as decimal separators
 * - preserves dot decimals
 */
export function normalizeDecimalInput(value: string): string {
  const base = toWesternDigits(value).replace(/\s+/g, "").replace(/\u060C/g, ",").trim();
  if (!base) return "";
  if (base.includes(".") && base.includes(",")) return base.replace(/,/g, "");
  if (!base.includes(",") || base.includes(".")) return base;
  const parts = base.split(",");
  if (parts.length === 2 && parts[0] && parts[1] && parts[1].length <= 3) {
    return `${parts[0]}.${parts[1]}`;
  }
  return base.replace(/,/g, "");
}
