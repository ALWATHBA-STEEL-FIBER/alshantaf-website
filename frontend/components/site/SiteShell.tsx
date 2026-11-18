"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { HardHatIcon } from "@/components/icons";

export function SiteShell({
  title,
  subtitle,
  backHref,
  children,
  showLogout,
  nav,
}: {
  nav?: "home" | "expenses";
  title: string;
  subtitle?: string;
  backHref?: string;
  children: React.ReactNode;
  showLogout?: boolean;
}) {
  const router = useRouter();

  async function logout() {
    await api.siteLogout().catch(() => undefined);
    router.replace("/site/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-[#0f342f] text-white pt-[env(safe-area-inset-top,0px)]">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {backHref ? (
              <Link
                href={backHref}
                className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-lg"
                aria-label="رجوع"
              >
                →
              </Link>
            ) : (
              <HardHatIcon className="w-5 h-5 text-[#d4a84b] shrink-0" />
            )}
            <div className="min-w-0">
              <div
                className="font-bold text-sm truncate"
                style={{ fontFamily: "var(--font-brand), sans-serif" }}
              >
                {title}
              </div>
              {subtitle ? <div className="text-[11px] text-white/70 truncate">{subtitle}</div> : null}
            </div>
          </div>
          {showLogout ? (
            <button
              type="button"
              onClick={logout}
              className="h-9 px-3 rounded-full bg-white/10 text-xs font-bold shrink-0"
            >
              خروج
            </button>
          ) : null}
        </div>
      </header>
      <main
        className={`flex-1 w-full max-w-2xl mx-auto px-4 py-5 ${
          nav ? "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]" : "pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
        }`}
      >
        {children}
      </main>
      {nav ? (
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-[#e4ddd0] pb-[env(safe-area-inset-bottom,0px)]">
          <div className="max-w-2xl mx-auto grid grid-cols-3 h-16 text-[11px] font-bold">
            <Link
              href="/site"
              className={`flex flex-col items-center justify-center gap-0.5 ${nav === "home" ? "text-[#0f342f]" : "text-[#8a958f]"}`}
            >
              <span className="text-lg leading-none" aria-hidden>⌂</span>
              المشاريع والحضور
            </Link>
            <Link
              href="/site/expenses/new"
              className="flex flex-col items-center justify-center"
              aria-label="إضافة مصروف"
            >
              <span className="-mt-7 h-14 w-14 rounded-full bg-[#d4a84b] text-[#0f342f] text-3xl font-bold flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(15,52,47,0.5)] border-4 border-[#f3f1eb]">
                +
              </span>
              <span className="text-[#0f342f] mt-0.5">مصروف</span>
            </Link>
            <Link
              href="/site/expenses"
              className={`flex flex-col items-center justify-center gap-0.5 ${nav === "expenses" ? "text-[#0f342f]" : "text-[#8a958f]"}`}
            >
              <span className="text-lg leading-none" aria-hidden>▤</span>
              المصاريف
            </Link>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
