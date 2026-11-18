"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";

type Metric = { value: string; label: string };

function parseMetric(value: string) {
  const match = value.match(/^(\+)?(\d+(?:\.\d+)?)(\+)?(.*)$/);
  if (!match) return { prefix: "", target: 0, suffix: value, decimals: 0 };
  const [, leadPlus = "", num, trailPlus = "", rest = ""] = match;
  const decimals = num.includes(".") ? num.split(".")[1].length : 0;
  return {
    prefix: leadPlus,
    target: Number(num),
    suffix: `${trailPlus}${rest}`,
    decimals,
  };
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function CountUpValue({ value }: { value: string }) {
  const { prefix, target, suffix, decimals } = parseMetric(value);
  const [display, setDisplay] = useState(prefix + "0" + suffix);
  const ref = useRef<HTMLElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || started.current) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const finish = () => {
      setDisplay(
        `${prefix}${decimals ? target.toFixed(decimals) : String(Math.round(target))}${suffix}`
      );
    };

    if (reduced) {
      finish();
      started.current = true;
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || started.current) return;
        started.current = true;
        io.disconnect();

        const duration = 1400;
        const start = performance.now();

        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const current = target * easeOutCubic(t);
          const formatted = decimals ? current.toFixed(decimals) : String(Math.round(current));
          setDisplay(`${prefix}${formatted}${suffix}`);
          if (t < 1) requestAnimationFrame(tick);
          else finish();
        };

        requestAnimationFrame(tick);
      },
      { threshold: 0.35 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [prefix, target, suffix, decimals]);

  return (
    <b ref={ref} className="block text-2xl md:text-3xl text-green font-bold tracking-tight tabular-nums">
      {display}
    </b>
  );
}

/** Landing metric strip — counts up once when first visible. */
export function CountUpMetrics({ metrics }: { metrics?: readonly Metric[] }) {
  const { t } = useLanguage();
  const items = metrics ?? t.hero.metrics;

  return (
    <section className="relative z-10 -mt-8 md:-mt-10">
      <div className="mx-auto max-w-[1240px] px-4">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-[0_24px_60px_-28px_rgba(17,58,52,0.45)] md:grid-cols-4">
          {items.map((m) => (
            <div key={`${m.value}-${m.label}`} className="bg-white px-3.5 py-4 md:px-6 md:py-6">
              <CountUpValue value={m.value} />
              <span className="mt-1 block text-[11px] leading-snug text-ink-soft md:text-xs">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
