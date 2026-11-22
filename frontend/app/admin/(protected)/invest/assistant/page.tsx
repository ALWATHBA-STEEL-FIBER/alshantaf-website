import { InvestAssistant } from "@/components/invest/agent/InvestAssistant";

export default async function AdminInvestAssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string | string[] }>;
}) {
  const sp = await searchParams;
  const projectId = typeof sp.projectId === "string" && /^[0-9a-f-]{36}$/i.test(sp.projectId) ? sp.projectId : null;
  return <InvestAssistant projectId={projectId} />;
}
