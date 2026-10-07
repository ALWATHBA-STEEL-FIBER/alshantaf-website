"use client";

import { useLanguage } from "@/lib/LanguageProvider";
import { GovTools } from "@/components/GovTools";

export function DecisionToolsHome() {
  const { t } = useLanguage();
  return (
    <GovTools
      eyebrow={t.journey.decisionEyebrow}
      heading={t.journey.decisionTitle}
      subtitle={t.journey.decisionSubtitle}
    />
  );
}
