import { toWesternDigits } from "./arabicDigits";
import { z } from "zod";

/** Feature keys that can be granted to an admin account. `*` = full access. */
export const ADMIN_FEATURES = [
  "dashboard",
  "listings",
  "submissions",
  "contact",
  "landChecks",
  "media",
  "security",
  "users",
  "settings",
] as const;

export type AdminFeature = (typeof ADMIN_FEATURES)[number];
export type AdminPermission = AdminFeature | "*";

export const FULL_ADMIN_PERMISSIONS: AdminPermission[] = ["*"];

export function isAdminFeature(value: string): value is AdminFeature {
  return (ADMIN_FEATURES as readonly string[]).includes(value);
}

export function normalizePermissions(raw: unknown): AdminPermission[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...FULL_ADMIN_PERMISSIONS];
  const out: AdminPermission[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const v = item.trim();
    if (v === "*") return [...FULL_ADMIN_PERMISSIONS];
    if (isAdminFeature(v) && !out.includes(v)) out.push(v);
  }
  return out.length > 0 ? out : [...FULL_ADMIN_PERMISSIONS];
}

export function hasPermission(
  permissions: readonly string[] | null | undefined,
  feature: AdminFeature
): boolean {
  if (!permissions || permissions.length === 0) return true; // legacy / full
  if (permissions.includes("*")) return true;
  return permissions.includes(feature);
}

export function hasAnyPermission(
  permissions: readonly string[] | null | undefined,
  features: readonly AdminFeature[]
): boolean {
  return features.some((f) => hasPermission(permissions, f));
}

/**
 * Normalize phone for storage. Keeps a leading `+` for international numbers.
 * Returns null for blank input.
 */
export function normalizePhoneInput(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = toWesternDigits(value).trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed;
}

/** Zod field: optional phone that accepts `+962…` international forms. */
export const adminPhoneSchema = z.preprocess(
  (value) => normalizePhoneInput(value),
  z
    .union([
      z.null(),
      z
        .string()
        .min(6, "Phone too short")
        .max(24, "Phone too long")
        .regex(/^\+?[0-9][0-9\s()-]*$/, "Use digits; optional leading +"),
    ])
    .optional()
);

export const permissionsSchema = z.preprocess(
  (value) => normalizePermissions(value),
  z.array(z.union([z.literal("*"), z.enum(ADMIN_FEATURES)])).min(1)
);
