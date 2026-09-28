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
