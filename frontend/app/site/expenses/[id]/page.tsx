"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { SiteExpense, SiteExpenseMeta } from "@/lib/types";
import { SiteAuthGateWithName } from "@/components/site/SiteAuthGate";
import { SiteShell } from "@/components/site/SiteShell";
import { ExpenseForm } from "@/components/site/ExpenseForm";
import { categoryColor, jod } from "@/components/site/expenseUi";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  if (v == null || v === "") return null;
  return (
    <div className="flex justify-between gap-3 py-2.5 border-b border-[#eee8dc] last:border-0 text-sm">
      <span className="text-[#5a6b66]">{k}</span>
      <span className="font-bold text-[#0f342f] text-start">{v}</span>
    </div>
  );
}

function ExpenseDetail({ engineerName }: { engineerName: string }) {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || "");
  const [meta, setMeta] = useState<SiteExpenseMeta | null>(null);
  const [item, setItem] = useState<SiteExpense | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.siteExpenseMeta(), api.siteExpense(id)])
      .then(([m, e]) => {
        setMeta(m);
        setItem(e);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "تعذّر التحميل"));
  }, [id]);

  async function remove() {
    if (!item) return;
    if (!window.confirm(`حذف مصروف ${jod(item.amount)} د.أ؟`)) return;
    try {
      await api.deleteSiteExpense(item.id);
      router.replace("/site/expenses");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر الحذف");
    }
  }

  return (
    <SiteShell title={item?.canEdit ? "تعديل مصروف" : "تفاصيل المصروف"} subtitle={engineerName} backHref="/site/expenses">
      {error ? (
        <div className="text-sm text-red-700 font-bold">{error}</div>
      ) : !meta || !item ? (
        <div className="text-sm text-[#5a6b66]">جاري التحميل…</div>
      ) : item.canEdit ? (
        <ExpenseForm
          meta={meta}
          initial={item}
          onSaved={() => router.replace("/site/expenses")}
          onDelete={remove}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-[#e4ddd0] p-5 text-center">
            <div className="text-xs font-bold" style={{ color: categoryColor(item.category) }}>
              {item.categoryLabel}
            </div>
            <div className="text-3xl font-extrabold text-[#0f342f] mt-1" style={{ fontFamily: "var(--font-brand), sans-serif" }}>
              {jod(item.amount)} <span className="text-base">د.أ</span>
            </div>
            <div className="text-sm text-[#1a2e2a] mt-2">{item.description}</div>
          </div>
          <div className="rounded-2xl bg-white border border-[#e4ddd0] px-4">
            <Row k="النوع" v={item.scope === "COMPANY" ? "مصروف شركة" : "مصروف مشروع"} />
            <Row k="المشروع" v={item.project?.name} />
            <Row k="التاريخ" v={item.expenseDate} />
            <Row k="طريقة الدفع" v={item.paymentLabel} />
            <Row k="المورّد" v={item.vendor} />
            <Row k="رقم الفاتورة" v={item.invoiceNo} />
            <Row k="أدخله" v={item.engineer.name} />
            <Row k="ملاحظات" v={item.notes} />
          </div>
          {item.hasReceipt ? (
            <a
              href={api.siteExpenseReceiptUrl(item.id)}
              target="_blank"
              rel="noreferrer"
              className="block w-full h-12 rounded-2xl bg-[#0f342f] text-white text-sm font-bold text-center leading-[3rem]"
            >
              عرض الإيصال
            </a>
          ) : null}
          <p className="text-xs text-[#5a6b66] text-center">يمكن تعديل المصروف فقط من قِبل من أدخله.</p>
        </div>
      )}
    </SiteShell>
  );
}

export default function ExpenseDetailPage() {
  return <SiteAuthGateWithName>{({ name }) => <ExpenseDetail engineerName={name} />}</SiteAuthGateWithName>;
}
