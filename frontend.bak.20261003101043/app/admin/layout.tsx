import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: "ALSHANTAF Admin",
    template: "%s · ALSHANTAF Admin",
  },
  robots: { index: false, follow: false, nocache: true },
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ALSHANTAF Admin",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f342f",
  viewportFit: "cover",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
