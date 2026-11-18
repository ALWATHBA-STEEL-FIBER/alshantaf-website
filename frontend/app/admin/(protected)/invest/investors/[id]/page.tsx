"use client";

import { useParams } from "next/navigation";
import { InvestInvestorDetail } from "@/components/invest/InvestInvestorDetail";

export default function AdminInvestInvestorPage() {
  const params = useParams();
  const id = String(params.id || "");
  if (!id) return null;
  return <InvestInvestorDetail investorId={id} />;
}