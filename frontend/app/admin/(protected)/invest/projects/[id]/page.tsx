"use client";

import { useParams } from "next/navigation";
import { InvestProjectWorkspace } from "@/components/invest/InvestProjectWorkspace";

export default function AdminInvestProjectPage() {
  const params = useParams();
  const id = String(params.id || "");
  if (!id) return null;
  return <InvestProjectWorkspace projectId={id} />;
}