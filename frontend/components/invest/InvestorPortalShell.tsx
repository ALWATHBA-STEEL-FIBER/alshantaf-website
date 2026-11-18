"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageProvider";
import { investApi } from "@/lib/investApi";

function L(ar: string, en: string, lang: string) {
  return lang === "ar" ? ar : en;
}

export function InvestorPortalShell({ children }: { children: React.ReactNode }) {
  const { lang, toggleLanguage } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/investor/login";

  async function logout() {
    await investApi.portalLogout().catch(() => undefined);
    router.push("/investor/login");
    router.refresh();
  }

  if (isLogin) {
    return <div className="min-h-screen bg-surface-2">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col">
      <header className="sticky top-0 z-20 bg-green text-white border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/investor" className="font-bold text-sm tracking-tight">
            ALSHANTAF · {L("بوابة المستثمر", "Investor portal", lang)}
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleLanguage} className="text-xs font-bold bg-white/10 h-8 px-2 rounded-full">
              {lang === "ar" ? "EN" : "ع"}
            </button>
            <button type="button" onClick={logout} className="text-xs font-bold bg-white/10 h-8 px-3 rounded-full">
              {L("خروج", "Logout", lang)}
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
        {children}
      </main>
    </div>
  );
}