import { z } from "zod";

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

/** Zod string field that normalizes Eastern/Arabic-Indic digits before validation. */
export function westernDigitsString<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (typeof value === "string" ? toWesternDigits(value) : value), schema);
}

/** Coerce a number after converting any Eastern/Arabic-Indic digits in string input. */
export function westernDigitsNumber(schema: z.ZodNumber) {
  return z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return value;
    if (typeof value === "string") return toWesternDigits(value);
    return value;
  }, schema);
}
