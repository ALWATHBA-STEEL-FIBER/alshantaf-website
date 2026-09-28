"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { api } from "@/lib/api";
import type { PresenceInfo } from "@/lib/types";

const POLL_MS = 10000;

export function LiveVisitors({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const [presence, setPresence] = useState<PresenceInfo | null>(null);

  useEffect(() => {
    let ignore = false;
    const load = () => api.adminPresence().then((p) => !ignore && setPresence(p)).catch(() => undefined);
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      ignore = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className={`flex items-center gap-2 rounded-xl bg-surface-2 px-3 h-10 ${className}`}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green" />
      </span>
      <span className="text-xs font-bold text-ink">
        {presence?.count ?? 0} {t.admin.liveVisitors}
      </span>
    </div>
  );
}
