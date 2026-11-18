"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useAnalyticsAllowed } from "@/components/CookieConsent";

const INTERVAL_MS = 20000;
const NAME_KEY = "alshantaf_visitor_name";

function deviceMeta() {
  if (typeof window === "undefined") return {};
  return {
    platform: navigator.platform || null,
    language: navigator.language || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    screen:
      typeof screen !== "undefined" && screen.width
        ? `${screen.width}x${screen.height}`
        : null,
  };
}

export function PresenceHeartbeat() {
  const pathname = usePathname();
  const allowed = useAnalyticsAllowed();
  const namedRef = useRef(false);

  useEffect(() => {
    if (!allowed) return;
    let ignore = false;

    const send = async (includeName = false) => {
      let name: string | null = null;
      if (includeName && !namedRef.current) {
        try {
          const stored = localStorage.getItem(NAME_KEY)?.trim();
          if (stored) name = stored.slice(0, 80);
        } catch {
          /* ignore */
        }
      }
      const res = await api.heartbeat({
        path: pathname,
        ...deviceMeta(),
        name,
      });
      if (!ignore && res?.named) namedRef.current = true;
    };

    void send(true);
    const id = setInterval(() => void send(false), INTERVAL_MS);
    return () => {
      ignore = true;
      clearInterval(id);
    };
  }, [pathname, allowed]);

  return null;
}
