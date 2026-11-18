"use client";

import { useParams } from "next/navigation";
import { SiteWorkerDetailView } from "@/components/admin/SiteWorkerDetailView";

export default function AdminSiteWorkerPage() {
  const params = useParams();
  const id = String(params.id || "");
  if (!id) return null;
  return <SiteWorkerDetailView workerId={id} />;
}
