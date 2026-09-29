"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageProvider";
import { SkeletonBlock } from "./EmptyState";

/** Verifies the session cookie against the API before rendering admin pages. */
export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let ignore = false;
    api
      .me()
      .then(() => {
        if (!ignore) setReady(true);
      })
      .catch(async () => {
        await api.logout().catch(() => undefined);
        if (!ignore) {
          // Trusted devices can open /admin/login without ?unlock=; others get 404 from the proxy.
          router.replace("/admin/login");
          router.refresh();
        }
      });
    return () => {
      ignore = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-[50vh] flex flex-col gap-3 justify-center max-w-md mx-auto px-4">
        <p className="text-sm text-ink-soft text-center">{t.admin.verifyingSession}</p>
        <SkeletonBlock className="h-10" />
        <SkeletonBlock className="h-32" />
      </div>
    );
  }

  return <>{children}</>;
}
