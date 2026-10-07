export const OPEN_ASSISTANT_EVENT = "alshantaf:open-assistant";

export function openSiteAssistant() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT));
}
