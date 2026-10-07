/** Detect installed homescreen / standalone display mode (iOS + Android). */
export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  try {
    return window.matchMedia("(display-mode: standalone)").matches
      || window.matchMedia("(display-mode: fullscreen)").matches
      || window.matchMedia("(display-mode: minimal-ui)").matches;
  } catch {
    return false;
  }
}

/** True when href leaves this origin (Maps, WhatsApp, gov sites, etc.). */
export function isExternalHref(href: string | null | undefined): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("?") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("sms:")
  ) {
    return false;
  }
  try {
    const url = new URL(trimmed, typeof window !== "undefined" ? window.location.href : "https://alshantaf.com");
    if (typeof window !== "undefined" && url.origin === window.location.origin) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Open an out-of-app URL. On homescreen PWAs, `target=_blank` is often trapped
 * inside the webview — force a top-level navigation so Maps / WhatsApp / Safari open.
 */
export function openExternalUrl(url: string) {
  if (typeof window === "undefined" || !url) return;
  if (isStandalonePwa()) {
    window.location.assign(url);
    return;
  }
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) window.location.assign(url);
}
