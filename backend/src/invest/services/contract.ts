/** Purchase-contract details stored on InvProject.contractDetails (JSON). */

export type SellerInstallment = {
  id: string;
  label: string;
  amount: string;
  dueDate: string | null;
  paidDate: string | null;
  note: string | null;
};

export type ContractDetails = {
  contractNo: string | null;
  contractDate: string | null;
  sellerName: string | null;
  sellerIdNo: string | null;
  sellerPhone: string | null;
  /** Name(s) the land is registered under after transfer. */
  registeredTo: string | null;
  deedNo: string | null;
  registryOffice: string | null;
  village: string | null;
  basin: string | null;
  plotNo: string | null;
  brokerName: string | null;
  brokerFee: string | null;
  /** Agreed total price in the contract (may differ from purchasePrice if fees are included). */
  contractPrice: string | null;
  downPayment: string | null;
  downPaymentDate: string | null;
  paymentTerms: string | null;
  transferDate: string | null;
  notes: string | null;
  installments: SellerInstallment[];
};

function bad(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

function s(v: unknown, max = 300): string | null {
  if (v == null) return null;
  const x = String(v).trim();
  return x ? x.slice(0, max) : null;
}

function m(v: unknown, label: string): string | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 1e12) throw bad(`${label}: قيمة غير صالحة`);
  return String(n);
}

function d(v: unknown, label: string): string | null {
  if (v == null || v === "") return null;
  const x = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x) || Number.isNaN(new Date(x).getTime())) throw bad(`${label}: تاريخ غير صالح`);
  return x;
}

export function cleanContract(raw: unknown): ContractDetails {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(o.installments) ? o.installments : [];
  if (list.length > 60) throw bad("عدد الدفعات كبير جداً");
  const installments: SellerInstallment[] = list.map((r, i) => {
    const x = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
    const amount = m(x.amount, `الدفعة ${i + 1}`);
    if (amount == null) throw bad(`الدفعة ${i + 1}: أدخل المبلغ`);
    return {
      id: s(x.id, 40) ?? `i${Date.now().toString(36)}${i}`,
      label: s(x.label, 120) ?? `دفعة ${i + 1}`,
      amount,
      dueDate: d(x.dueDate, `الدفعة ${i + 1}`),
      paidDate: d(x.paidDate, `الدفعة ${i + 1}`),
      note: s(x.note, 500),
    };
  });
  return {
    contractNo: s(o.contractNo, 100),
    contractDate: d(o.contractDate, "تاريخ العقد"),
    sellerName: s(o.sellerName),
    sellerIdNo: s(o.sellerIdNo, 60),
    sellerPhone: s(o.sellerPhone, 40),
    registeredTo: s(o.registeredTo),
    deedNo: s(o.deedNo, 100),
    registryOffice: s(o.registryOffice),
    village: s(o.village),
    basin: s(o.basin),
    plotNo: s(o.plotNo, 100),
    brokerName: s(o.brokerName),
    brokerFee: m(o.brokerFee, "عمولة الوسيط"),
    contractPrice: m(o.contractPrice, "سعر العقد"),
    downPayment: m(o.downPayment, "العربون"),
    downPaymentDate: d(o.downPaymentDate, "تاريخ العربون"),
    paymentTerms: s(o.paymentTerms, 2000),
    transferDate: d(o.transferDate, "تاريخ نقل الملكية"),
    notes: s(o.notes, 4000),
    installments,
  };
}

/** Seller-side payment progress: down payment + installments. */
export function contractProgress(c: ContractDetails | null, fallbackPrice: string | null) {
  const price = Number(c?.contractPrice ?? fallbackPrice ?? 0) || 0;
  let paid = Number(c?.downPayment ?? 0) || 0;
  let scheduled = paid;
  let overdue = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const i of c?.installments ?? []) {
    const a = Number(i.amount) || 0;
    scheduled += a;
    if (i.paidDate) paid += a;
    else if (i.dueDate && i.dueDate < today) overdue += a;
  }
  return {
    price: price.toFixed(3),
    paid: paid.toFixed(3),
    remaining: Math.max(0, price - paid).toFixed(3),
    scheduled: scheduled.toFixed(3),
    unscheduled: Math.max(0, price - scheduled).toFixed(3),
    overdue: overdue.toFixed(3),
    paidPercent: price > 0 ? ((paid * 100) / price).toFixed(1) : null,
  };
}

export function readContract(raw: unknown): ContractDetails | null {
  if (!raw || typeof raw !== "object") return null;
  try {
    return cleanContract(raw);
  } catch {
    return null;
  }
}
