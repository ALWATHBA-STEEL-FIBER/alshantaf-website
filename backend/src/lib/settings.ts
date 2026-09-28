import { prisma } from "../prisma";

export const DEFAULT_SETTINGS = {
  whatsappNumber: "962799996668",
  contactPhone1: "+962 79 999 6668",
  contactPhone2: "+962 79 999 6660",
  contactEmail: "ahmed@alshantaf.com",
  facebookUrl: "https://facebook.com/Alshantaf.RealeEstate",
  instagramUrl: "",
  submissionsEnabled: "true",
  maintenanceBanner: "",
};

export type SettingsMap = typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<SettingsMap> {
  const rows = await prisma.setting.findMany();
  const map = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in map) (map as Record<string, string>)[row.key] = row.value;
  }
  return map;
}

export async function setSettings(patch: Partial<SettingsMap>): Promise<SettingsMap> {
  const entries = Object.entries(patch).filter(([key]) => key in DEFAULT_SETTINGS);
  await Promise.all(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      })
    )
  );
  return getSettings();
}
