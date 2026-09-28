"use client";

import { createContext, useContext } from "react";
import type { PublicSettings } from "./types";

const DEFAULT_SETTINGS: PublicSettings = {
  whatsappNumber: "962799996668",
  contactPhone1: "+962 79 999 6668",
  contactPhone2: "+962 79 999 6660",
  contactEmail: "ahmed@alshantaf.com",
  facebookUrl: "https://facebook.com/Alshantaf.RealeEstate",
  instagramUrl: "",
  submissionsEnabled: true,
  maintenanceBanner: "",
};

const SettingsContext = createContext<PublicSettings>(DEFAULT_SETTINGS);

export function SettingsProvider({ settings, children }: { settings: PublicSettings | null; children: React.ReactNode }) {
  return <SettingsContext.Provider value={settings ?? DEFAULT_SETTINGS}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
