import type { MetadataRoute } from "next";

/** Admin homescreen PWA — only reachable under /admin (gate/proxy protected). */
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: "/admin",
    name: "ALSHANTAF Admin",
    short_name: "Admin",
    description: "Alshantaf Invest — admin control panel",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    background_color: "#0f342f",
    theme_color: "#0f342f",
    lang: "ar",
    dir: "rtl",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
