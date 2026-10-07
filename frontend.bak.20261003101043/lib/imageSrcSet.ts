const TIER_WIDTHS = { sm: 480, md: 960, lg: 1920 } as const;

/** Uploaded images are stored as <id>-sm/-md/-lg.webp siblings (see backend
 * uploadSecurity.ts). Derives a srcset from the canonical (-lg) URL so slower
 * clients can load a smaller tier — returns undefined for anything that
 * doesn't match the convention (e.g. legacy pre-migration uploads). */
export function buildSrcSet(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const match = url.match(/^(.*)-lg\.webp$/);
  if (!match) return undefined;
  const stem = match[1];
  return (Object.keys(TIER_WIDTHS) as (keyof typeof TIER_WIDTHS)[])
    .map((tier) => `${stem}-${tier}.webp ${TIER_WIDTHS[tier]}w`)
    .join(", ");
}
