import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Cairo } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/LanguageProvider";
import { getServerLang } from "@/lib/serverLang";
import { SITE_URL } from "@/lib/site";
import { JsonLd } from "@/components/JsonLd";

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

const cairo = Cairo({
  variable: "--font-brand",
  subsets: ["arabic", "latin"],
  weight: ["700", "800"],
  display: "swap",
  preload: false,
  adjustFontFallback: true,
});

const SITE_NAME = "ALSHANTAF INVEST";
const SITE_DESCRIPTION = "الشنتف للعقار والاستثمار — أراضٍ وفرص صناعية في الأردن";

/** Lock page pinch/double-tap zoom on mobile; map still zooms inside Leaflet. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f342f",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "industrial land Jordan",
    "أراضي صناعية الأردن",
    "Sahab industrial",
    "سحاب الصناعية",
    "Alshantaf",
    "الشنتف",
    "factory land Amman",
    "DLS administrative value",
  ],
  alternates: {
    canonical: "/",
    types: {
      "text/plain": [
        { url: "/llms.txt", title: "llms.txt" },
        { url: "/llms-full.txt", title: "llms-full.txt" },
      ],
      "application/xml": [{ url: "/sitemap.xml", title: "Sitemap" }],
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "ar_JO",
    alternateLocale: ["en_US"],
    images: ["/hero-industrial-sunset.webp"],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/hero-industrial-sunset.webp"],
  },
  category: "real estate",
  applicationName: SITE_NAME,
  appleWebApp: {
    capable: true,
    title: "ALSHANTAF",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48 64x64" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getServerLang();
  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <html lang={lang} dir={dir} className={`${plexArabic.variable} ${cairo.variable} antialiased`}>
      <body className="min-h-screen flex flex-col">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: SITE_NAME,
            alternateName: ["الشنتف للعقار والاستثمار", "Alshantaf Invest"],
            url: SITE_URL,
            logo: `${SITE_URL}/logo-mark.webp`,
            image: `${SITE_URL}/hero-industrial-sunset.webp`,
            description: SITE_DESCRIPTION,
            areaServed: {
              "@type": "Country",
              name: "Jordan",
            },
            knowsAbout: [
              "Industrial real estate",
              "Industrial land Jordan",
              "Sahab Industrial Area",
              "Department of Lands and Survey Jordan",
            ],
          }}
        />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: SITE_NAME,
            url: SITE_URL,
            inLanguage: ["ar", "en"],
            potentialAction: {
              "@type": "SearchAction",
              target: `${SITE_URL}/offers?area={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          }}
        />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "RealEstateAgent",
            name: SITE_NAME,
            url: SITE_URL,
            image: `${SITE_URL}/logo-mark.webp`,
            description: SITE_DESCRIPTION,
            address: {
              "@type": "PostalAddress",
              addressLocality: "Amman",
              addressCountry: "JO",
            },
            areaServed: "JO",
            priceRange: "$$",
          }}
        />
        <LanguageProvider initialLang={lang}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
