"use client";

import { useParams } from "next/navigation";
import { InvestorPortalProject } from "@/components/invest/InvestorPortalProject";

export default function InvestorProjectPage() {
  const params = useParams();
  const id = String(params.id || "");
  if (!id) return null;
  return <InvestorPortalProject projectId={id} />;
}