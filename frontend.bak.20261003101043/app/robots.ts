import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Private / non-indexable paths shared by all crawlers. */
const DISALLOW = [
  "/admin",
  "/admin/",
  "/api/",
  "/my-offer",
  "/my-offer/",
  "/track/",
  "/admin-panel-not-found",
];

/** Paths we especially want discovered (including LLM entry points). */
const ALLOW = ["/", "/llms.txt", "/llms-full.txt", "/sitemap.xml"];

/**
 * Explicit allow-lists for major search + AI crawlers.
 * Named agents remove ambiguity some bots have with User-agent: * alone.
 */
const SEARCH_AND_AI_AGENTS = [
  // Search
  "Googlebot",
  "Googlebot-Image",
  "Googlebot-News",
  "Bingbot",
  "DuckDuckBot",
  "Slurp",
  "Yandex",
  "Baiduspider",
  "Applebot",
  // AI / answer engines (GEO)
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "Anthropic-AI",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "GoogleOther",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "meta-externalagent",
  "FacebookBot",
  "cohere-ai",
  "Diffbot",
  "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ALLOW,
        disallow: DISALLOW,
      },
      {
        userAgent: SEARCH_AND_AI_AGENTS,
        allow: ALLOW,
        disallow: DISALLOW,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
