"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageProvider";
import { api } from "@/lib/api";
import {
  CloseIcon,
  FolderIcon,
  HomeIcon,
  InboxIcon,
  ListingsIcon,
  MapCheckIcon,
  MenuIcon,
  MessageIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";
import { LiveVisitors } from "@/components/admin/LiveVisitors";
import { useAdminSession, type AdminFeature } from "@/lib/adminPermissions";

const NAV = [
  { href: "/admin", key: "dashboard" as const, icon: HomeIcon, feature: "dashboard" as AdminFeature },
  { href: "/admin/listings", key: "listings" as const, icon: ListingsIcon, feature: "listings" as AdminFeature },
  { href: "/admin/submissions", key: "submissions" as const, icon: InboxIcon, feature: "submissions" as AdminFeature },
  { href: "/admin/contact", key: "contact" as const, icon: MessageIcon, feature: "contact" as AdminFeature },
  { href: "/admin/land-checks", key: "landChecks" as const, icon: MapCheckIcon, feature: "landChecks" as AdminFeature },
  { href: "/admin/media", key: "media" as const, icon: FolderIcon, feature: "media" as AdminFeature },
  { href: "/admin/security", key: "security" as const, icon: ShieldIcon, feature: "security" as AdminFeature },
  { href: "/admin/users", key: "admins" as const, icon: UsersIcon, feature: "users" as AdminFeature },
  { href: "/admin/settings", key: "settings" as const, icon: SettingsIcon, feature: "settings" as AdminFeature },
];

export function AdminSidebar() {
  const { t, toggleLanguage } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const { has } = useAdminSession();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleLogout() {
    await api.logout().catch(() => undefined);
    router.push("/admin/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const visibleNav = NAV.filter((item) => has(item.feature));

  const navList = (
    <nav className="flex flex-col gap-1">
      {visibleNav.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setDrawerOpen(false)}
            className={`flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-bold transition-colors ${
              active ? "bg-green text-white" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-gold"}`} />
            {t.admin.sidebar[item.key]}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 bg-green text-white flex items-center justify-between px-4 h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)]">
        <button type="button" onClick={() => setDrawerOpen(true)} aria-label="menu">
          <MenuIcon />
        </button>
        <span className="font-bold text-sm">ALSHANTAF — Admin</span>
        <button type="button" onClick={toggleLanguage} className="text-xs font-bold bg-white/10 h-8 px-2 rounded-full">
          {t.utility.toggle}
        </button>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} aria-label="close" />
          <div className="absolute inset-y-0 start-0 w-72 max-w-[80%] bg-white p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="font-bold text-green">ALSHANTAF</span>
              <button onClick={() => setDrawerOpen(false)} type="button" aria-label="close">
                <CloseIcon />
              </button>
            </div>
            {navList}
            <div className="mt-auto flex flex-col gap-2 pb-[env(safe-area-inset-bottom,0px)]">
              <LiveVisitors />
              <Link href="/" className="h-10 px-3 rounded-xl text-sm font-bold text-ink-soft flex items-center gap-2">
                ← {t.admin.sidebar.backToSite}
              </Link>
              <button onClick={handleLogout} type="button" className="h-10 rounded-xl bg-surface-2 text-sm font-bold">
                {t.admin.logout}
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-e border-line bg-white p-4">
        <Link href="/admin" className="font-bold text-green px-3 mb-6 flex items-center gap-2">
          <ShieldIcon className="w-4 h-4 text-gold" />
          ALSHANTAF — Admin
        </Link>
        {navList}
        <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-line">
          <LiveVisitors />
          <button onClick={toggleLanguage} type="button" className="h-10 rounded-xl border border-line text-xs font-bold">
            {t.utility.toggle}
          </button>
          <Link href="/" className="h-10 px-3 rounded-xl text-xs font-bold text-ink-soft flex items-center gap-2">
            ← {t.admin.sidebar.backToSite}
          </Link>
          <button onClick={handleLogout} type="button" className="h-10 rounded-xl bg-surface-2 text-xs font-bold">
            {t.admin.logout}
          </button>
        </div>
      </aside>
    </>
  );
}
