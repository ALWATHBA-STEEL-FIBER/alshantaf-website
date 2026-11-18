import type { Metadata } from "next";
import { InvestorPortalShell } from "@/components/invest/InvestorPortalShell";

export const metadata: Metadata = {
  title: "Investor portal",
  robots: { index: false, follow: false, nocache: true },
};

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  return <InvestorPortalShell>{children}</InvestorPortalShell>;
}