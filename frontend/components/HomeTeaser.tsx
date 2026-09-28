import Link from "next/link";
import { getServerDict } from "@/lib/serverLang";
import { SiteImage } from "@/components/SiteImage";
import { CountUpMetrics } from "@/components/CountUpMetrics";

const CARDS = [
  { key: "offers" as const, href: "/opportunities", image: "/industrial-clean-wide.webp" },
  { key: "owners" as const, href: "/request-publish", image: "/hero-warehouse-wide.webp" },
  { key: "servicesPage" as const, href: "/services" },
  { key: "contact" as const, href: "/contact" },
];

/** Server component — no client hydration cost for the home teaser grid. */
export async function HomeTeaser() {
  const { t } = await getServerDict();
  const [featured, ...rest] = CARDS;

  return (
    <>
      <CountUpMetrics metrics={t.hero.metrics} />

      <section className="py-20 content-visibility-auto">
        <div className="mx-auto max-w-[1240px] px-4">
          <div className="mb-10 max-w-2xl">
            <span className="text-gold text-xs font-bold tracking-wide">{t.homeTeaser.eyebrow}</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-2 text-balance">{t.homeTeaser.title}</h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-12 lg:grid-rows-2 lg:min-h-[520px]">
            <Link
              href={featured.href}
              className="group relative overflow-hidden rounded-3xl lg:col-span-7 lg:row-span-2 min-h-[280px] text-white"
            >
              <SiteImage
                src={featured.image!}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 58vw"
                quality={60}
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-green via-green/55 to-transparent" />
              <div className="relative h-full flex flex-col justify-end p-7 md:p-10">
                <h3 className="text-2xl md:text-3xl font-bold max-w-md">{t[featured.key].title}</h3>
                <p className="mt-3 max-w-md text-sm text-white/80 leading-relaxed line-clamp-3">
                  {t[featured.key].subtitle}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-gold">
                  {t.homeTeaser.exploreCta}
                  <span aria-hidden className="rtl:rotate-180">
                    →
                  </span>
                </span>
              </div>
            </Link>

            <Link
              href={rest[0].href}
              className="group relative overflow-hidden rounded-3xl lg:col-span-5 min-h-[220px] text-white"
            >
              <SiteImage
                src={rest[0].image!}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 42vw"
                quality={60}
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-green/95 via-green/50 to-green/20" />
              <div className="relative h-full flex flex-col justify-end p-6 md:p-7">
                <h3 className="text-xl font-bold">{t[rest[0].key].title}</h3>
                <p className="mt-2 text-sm text-white/80 line-clamp-2">{t[rest[0].key].subtitle}</p>
              </div>
            </Link>

            <div className="lg:col-span-5 grid sm:grid-cols-2 gap-4">
              {rest.slice(1).map(({ key, href }) => (
                <Link
                  key={key}
                  href={href}
                  className="group rounded-3xl border border-line bg-white/80 p-6 flex flex-col justify-between min-h-[180px] transition-colors hover:border-gold/50 hover:bg-white"
                >
                  <div>
                    <span className="block w-10 h-[3px] rounded-full bg-gold mb-4" aria-hidden />
                    <h3 className="font-bold text-lg leading-snug group-hover:text-green transition-colors">
                      {t[key].title}
                    </h3>
                    <p className="text-sm text-ink-soft mt-2 leading-relaxed line-clamp-3">{t[key].subtitle}</p>
                  </div>
                  <span className="mt-5 text-xs font-bold text-green inline-flex items-center gap-1">
                    {t.homeTeaser.exploreCta}
                    <span aria-hidden className="rtl:rotate-180">
                      →
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
