"use client";

import dynamic from "next/dynamic";
import { StandaloneExternalLinks } from "@/components/StandaloneExternalLinks";

const CookieConsent = dynamic(() => import("@/components/CookieConsent").then((m) => m.CookieConsent), {
  ssr: false,
  loading: () => null,
});

const PresenceHeartbeat = dynamic(
  () => import("@/components/PresenceHeartbeat").then((m) => m.PresenceHeartbeat),
  { ssr: false, loading: () => null }
);

const AiAssistant = dynamic(() => import("@/components/AiAssistant").then((m) => m.AiAssistant), {
  ssr: false,
  loading: () => null,
});

/** Non-critical site chrome — loaded after hydration so it never blocks LCP. */
export function DeferredSiteChrome() {
  return (
    <>
      <PresenceHeartbeat />
      <CookieConsent />
      <AiAssistant />
      <StandaloneExternalLinks />
    </>
  );
}
