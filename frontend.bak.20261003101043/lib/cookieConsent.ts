export type CookieConsentLevel = "essential" | "all";

export const COOKIE_CONSENT_KEY = "cookie-consent";
export const COOKIE_CONSENT_COOKIE = "cookie_consent";

export function readConsentFromStorage(): CookieConsentLevel | null {
  try {
    const value = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (value === "all" || value === "accepted") return "all";
    if (value === "essential") return "essential";
  } catch {
    // ignore
  }
  return null;
}

export function writeConsent(level: CookieConsentLevel) {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, level);
  } catch {
    // ignore
  }
  const maxAge = 365 * 24 * 60 * 60;
  document.cookie = `${COOKIE_CONSENT_COOKIE}=${level}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function hasAnalyticsConsent(level: CookieConsentLevel | null): boolean {
  return level === "all";
}
