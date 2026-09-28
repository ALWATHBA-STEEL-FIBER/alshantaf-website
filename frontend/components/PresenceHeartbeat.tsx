"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useAnalyticsAllowed } from "@/components/CookieConsent";

const INTERVAL_MS = 20000;

export function PresenceHeartbeat() {
  const pathname = usePathname();
  const allowed = useAnalyticsAllowed();

  useEffect(() => {
    if (!allowed) return;
    api.heartbeat(pathname);
    const id = setInterval(() => api.heartbeat(pathname), INTERVAL_MS);
    return () => clearInterval(id);
  }, [pathname, allowed]);

  return null;
}
