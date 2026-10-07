"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageProvider";
import { SkeletonBlock } from "./EmptyState";
import { AdminSessionProvider, type AdminSession } from "@/lib/adminPermissions";

/** Verifies the session cookie against the API before rendering admin pages. */
export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .me()
      .then((me) => {
        if (!ignore) {
          setSession({
            id: me.id,
            email: me.email,
            name: me.name,
            permissions: (me.permissions?.length ? me.permissions : ["*"]) as AdminSession["permissions"],
          });
        }
      })
      .catch(async () => {
        await api.logout().catch(() => undefined);
        if (!ignore) {
          router.replace("/admin/login");
          router.refresh();
        }
      });
    return () => {
      ignore = true;
    };
  }, [router]);

  if (!session) {
    return (
      <div className="min-h-[50vh] flex flex-col gap-3 justify-center max-w-md mx-auto px-4">
        <p className="text-sm text-ink-soft text-center">{t.admin.verifyingSession}</p>
        <SkeletonBlock className="h-10" />
        <SkeletonBlock className="h-32" />
      </div>
    );
  }

  return <AdminSessionProvider session={session}>{children}</AdminSessionProvider>;
}
