"use client";

import { useParams } from "next/navigation";
import { SiteProjectDetailView } from "@/components/admin/SiteProjectDetailView";

export default function AdminSiteProjectPage() {
  const params = useParams();
  const id = String(params.id || "");
  if (!id) return null;
  return <SiteProjectDetailView projectId={id} />;
}
