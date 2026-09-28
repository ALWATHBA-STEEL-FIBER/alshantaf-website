import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ToastProvider } from "@/components/admin/Toast";
import { AdminAuthGate } from "@/components/admin/AdminAuthGate";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AdminAuthGate>
        <div className="min-h-screen bg-surface-2 lg:flex">
          <AdminSidebar />
          <main className="flex-1 min-w-0 px-4 py-6 lg:p-8">{children}</main>
        </div>
      </AdminAuthGate>
    </ToastProvider>
  );
}
