"use client";

import { useSettings } from "@/lib/SettingsProvider";

export function MaintenanceBanner() {
  const settings = useSettings();
  if (!settings.maintenanceBanner) return null;

  return (
    <div className="bg-gold text-[#152126] text-sm font-bold text-center py-2 px-4">
      {settings.maintenanceBanner}
    </div>
  );
}
