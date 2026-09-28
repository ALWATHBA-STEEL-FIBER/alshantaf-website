export function Logo({ light = false, className = "h-12 w-auto" }: { light?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand mark needs CSS invert filter for light mode
    <img
      src="/logo-mark.webp"
      alt="ALSHANTAF INVEST"
      width={96}
      height={96}
      decoding="async"
      loading="eager"
      className={className}
      style={light ? { filter: "brightness(0) invert(1)" } : undefined}
    />
  );
}
