import { getPublicSettingsServer } from "@/lib/api";
import { HeroCopy } from "@/components/HeroCopy";

/**
 * Server-rendered LCP hero: one native <picture> (mobile OR desktop),
 * no next/image JS, no dual downloads, high fetch priority.
 * Copy is client-side so language toggle updates immediately.
 */
export async function Hero() {
  const settings = await getPublicSettingsServer();
  const phone = (settings?.contactPhone1 || "+962799996668").replace(/\s/g, "");

  return (
    <section id="top" className="relative min-h-[100svh] overflow-hidden flex items-start">
      <div className="absolute inset-0 -z-10">
        <picture>
          <source
            media="(max-width: 767px)"
            srcSet="/hero-industrial-sunset-mobile.avif"
            type="image/avif"
            width={720}
            height={1104}
          />
          <source
            media="(max-width: 767px)"
            srcSet="/hero-industrial-sunset-mobile.webp"
            type="image/webp"
            width={720}
            height={1104}
          />
          <source
            media="(min-width: 768px)"
            srcSet="/hero-industrial-sunset.avif"
            type="image/avif"
            width={1400}
            height={788}
          />
          <img
            src="/hero-industrial-sunset.webp"
            alt=""
            width={1400}
            height={788}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-b from-green/85 via-green/35 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(202,160,100,0.22),transparent_55%)]" />
      </div>

      <HeroCopy phone={phone} />
    </section>
  );
}
