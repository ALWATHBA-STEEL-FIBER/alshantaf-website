type Props = {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  quality?: number;
};

/**
 * Public `/…webp` assets are already compressed — serve them as native imgs
 * with long-cache URLs (no /_next/image round-trip). Uploads stay lazy too.
 */
export function SiteImage({ src, alt, fill, width, height, className, priority }: Props) {
  const loading = priority ? "eager" : "lazy";
  const fetchPriority = priority ? "high" : "auto";

  if (fill) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        className={`absolute inset-0 h-full w-full object-cover ${className ?? ""}`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width ?? 800}
      height={height ?? 600}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      className={className}
    />
  );
}
