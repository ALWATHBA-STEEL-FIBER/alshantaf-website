import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Cairo } from "next/font/google";

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  display: "swap",
});

const cairo = Cairo({
  variable: "--font-brand",
  subsets: ["arabic", "latin"],
  weight: ["700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "بوابة المهندس — الشنتف",
  description: "تسجيل الحضور والمصاريف للمهندسين الميدانيين",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f342f",
};

export default function SiteEngineerRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      lang="ar"
      dir="rtl"
      className={`${plexArabic.variable} ${cairo.variable} min-h-screen bg-[#f3f1eb] text-[#1a2e2a] antialiased`}
      style={{ fontFamily: "var(--font-plex-arabic), sans-serif" }}
    >
      {children}
    </div>
  );
}
