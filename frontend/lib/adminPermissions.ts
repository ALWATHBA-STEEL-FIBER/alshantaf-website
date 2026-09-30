"use client";

import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";

export const ADMIN_FEATURES = [
  "dashboard",
  "listings",
  "submissions",
  "contact",
  "landChecks",
  "media",
  "security",
  "users",
  "settings",
] as const;

export type AdminFeature = (typeof ADMIN_FEATURES)[number];
export type AdminPermission = AdminFeature | "*";

export type AdminSession = {
  id: string;
  email: string;
  name: string;
  permissions: AdminPermission[];
};

type Ctx = AdminSession & {
  has: (feature: AdminFeature) => boolean;
  isFull: boolean;
};

const AdminSessionContext = createContext<Ctx | null>(null);

export function AdminSessionProvider({
  session,
  children,
}: {
  session: AdminSession;
  children: ReactNode;
}) {
  const value = useMemo<Ctx>(() => {
    const perms = session.permissions?.length ? session.permissions : (["*"] as AdminPermission[]);
    const isFull = perms.includes("*");
    return {
      ...session,
      permissions: perms,
      isFull,
      has: (feature) => isFull || perms.includes(feature),
    };
  }, [session]);

  return createElement(AdminSessionContext.Provider, { value }, children);
}

export function useAdminSession() {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error("useAdminSession must be used within AdminSessionProvider");
  return ctx;
}
