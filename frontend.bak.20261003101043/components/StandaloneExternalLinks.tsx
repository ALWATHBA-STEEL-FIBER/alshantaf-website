"use client";

import { useEffect } from "react";
import { isExternalHref, isStandalonePwa, openExternalUrl } from "@/lib/externalNav";

/**
 * In homescreen/standalone mode, force external links (Google Maps, WhatsApp,
 * government sites, etc.) out of the PWA webview into the system browser/app.
 */
export function StandaloneExternalLinks() {
  useEffect(() => {
    if (!isStandalonePwa()) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!isExternalHref(href)) return;

      event.preventDefault();
      event.stopPropagation();
      openExternalUrl(anchor.href || href!);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
