"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function SiteAuthGateWithName({
  children,
}: {
  children: (ctx: { name: string }) => React.ReactNode;
}) {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .siteMe()
      .then((me) => {
        if (!ignore) setName(me.name);
      })
      .catch(() => {
        if (!ignore) router.replace("/site/login");
      });
    return () => {
      ignore = true;
    };
  }, [router]);

  if (name == null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-[#5a6b66]">
        جاري التحميل…
      </div>
    );
  }

  return <>{children({ name })}</>;
}
