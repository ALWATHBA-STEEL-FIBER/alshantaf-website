"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { SiteExpenseMeta, SiteExpenseScope } from "@/lib/types";
import { SiteAuthGateWithName } from "@/components/site/SiteAuthGate";
import { SiteShell } from "@/components/site/SiteShell";
import { ExpenseForm } from "@/components/site/ExpenseForm";
import { jod } from "@/components/site/expenseUi";

function NewExpense({ engineerName }: { engineerName: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [meta, setMeta] = useState<SiteExpenseMeta | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [formKey, setFormKey] = useState(0);
  const scopeParam = sp.get("scope");
  const defaultScope: SiteExpenseScope | undefined =
    scopeParam === "COMPANY" ? "COMPANY" : scopeParam === "PROJECT" ? "PROJECT" : undefined;
  const [lastScope, setLastScope] = useState<SiteExpenseScope | undefined>(defaultScope);
  const [lastProject, setLastProject] = useState<string | null>(sp.get("projectId"));

  useEffect(() => {
    api
      .siteExpenseMeta()
      .then(setMeta)
      .catch((err) => setError(err instanceof ApiError ? err.message : "تعذّر التحميل"));
  }, []);

  const back = sp.get("back") || "/site/expenses";

  return (
    <SiteShell title="مصروف جديد" subtitle={engineerName} backHref={back}>
      {flash ? (
        <div className="mb-4 rounded-xl bg-[#0f342f] text-white px-4 py-3 text-sm font-bold">{flash}</div>
      ) : null}
      {error ? (
        <div className="text-sm text-red-700 font-bold">{error}</div>
      ) : !meta ? (
        <div className="text-sm text-[#5a6b66]">جاري التحميل…</div>
      ) : (
        <ExpenseForm
          key={formKey}
          meta={meta}
          defaultScope={lastScope}
          defaultProjectId={lastProject}
          onSaved={(saved, again) => {
            if (again) {
              setFlash(`تم حفظ ${jod(saved.amount)} د.أ — ${saved.description}. أضف التالي:`);
              setLastScope(saved.scope);
              setLastProject(saved.projectId);
              setFormKey((k) => k + 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              router.replace(`${back}${back.includes("?") ? "&" : "?"}saved=${saved.id}`);
            }
          }}
        />
      )}
    </SiteShell>
  );
}

export default function NewExpensePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-[#5a6b66]">جاري التحميل…</div>}>
      <SiteAuthGateWithName>{({ name }) => <NewExpense engineerName={name} />}</SiteAuthGateWithName>
    </Suspense>
  );
}
