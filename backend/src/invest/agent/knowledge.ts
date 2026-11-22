/**
 * Assistant memory files: one JSON + one TXT per project and a portfolio index,
 * regenerated from live data and stored encrypted on disk. The assistant reads the
 * index every turn and can open any project's file; the admin can download them.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../../prisma";
import { hashOf, open, seal } from "./secure";
import { projectBrief } from "./brief";
import { investDocsDir } from "./paths";

type Brief = Awaited<ReturnType<typeof projectBrief>>;
type Manifest = Record<string, { hash: string; name: string; status: string; updatedAt: string }>;

function dir() {
  const d = path.join(investDocsDir(), "agent-knowledge");
  fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  return d;
}

const safeId = (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Object.assign(new Error("معرّف غير صالح"), { status: 400 });
  return id;
};

function writeSealed(name: string, content: string) {
  const file = path.join(dir(), name);
  fs.writeFileSync(`${file}.tmp`, seal(content), { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
}

function readSealed(name: string): string | null {
  const file = path.join(dir(), name);
  if (!fs.existsSync(file)) return null;
  return open(fs.readFileSync(file, "utf8")) || null;
}

function readManifest(): Manifest {
  try {
    return JSON.parse(readSealed("manifest.enc") ?? "{}") as Manifest;
  } catch {
    return {};
  }
}

const n = (v: unknown) => (v == null || v === "" ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 3 }));

function notesFor(projectId: string): { at: string; note: string }[] {
  try {
    return JSON.parse(readSealed(`${safeId(projectId)}.notes.enc`) ?? "[]");
  } catch {
    return [];
  }
}

/** Human-readable project file. */
function toTxt(b: Brief, notes: { at: string; note: string }[]) {
  const L: string[] = [];
  L.push(`المشروع: ${b.name} (${b.code}) — الحالة: ${b.status}`);
  L.push(`الموقع: ${b.location ?? "—"} | القطعة: ${b.plotParcelNo ?? "—"} | المساحة م²: ${n(b.landAreaSqm)}`);
  L.push(`تاريخ الشراء: ${b.purchaseDate ?? "—"} | سعر الشراء: ${n(b.purchasePrice)} | السعر المستهدف: ${n(b.targetSalePrice)} | آخر تقدير: ${n(b.estimatedValue)}`);
  const rule = b.commissionRule as { basis?: string; percent?: string } | null;
  L.push(`حصة المنسق: ${rule?.percent ?? 0}% (${rule?.basis ?? "—"}) — تُحتسب من صافي ربح كل شريك، ويمكن تخصيصها لكل شريك.`);
  L.push("");
  L.push("الشركاء:");
  for (const p of b.partners) {
    L.push(
      `- ${p.name}${p.code ? ` (${p.code})` : ""}${p.coordinator ? " [المنسق]" : ""}: رأس المال ${n(p.capital)} | الدفعة الأولى ${n(p.initialPayment)} | الملكية ${Number(p.ownershipPercent).toFixed(2)}% | حصة المنسق منه ${p.cutPercent ?? "—"}%${Number(p.expenseShare) ? ` | فرق توزيع المصاريف ${n(p.expenseShare)}` : ""}`
    );
  }
  L.push("");
  L.push(`الدفعات (${b.payments.length}):`);
  for (const c of b.payments) L.push(`- ${c.date} ${c.kind} ${n(c.amount)} ${c.method ?? ""} ${c.ref ?? ""} [${c.status}]`.trim());
  L.push("");
  L.push(`المصاريف (${b.expenses.length}):`);
  for (const e of b.expenses) L.push(`- ${e.date} ${e.title} ${n(e.amount)} — ${e.category ?? "other"} — ${e.status}${e.payer ? ` — دفعها ${e.payer}` : ""} — التوزيع ${e.split ?? "ownership"}`);
  const c = b.contract as Record<string, unknown> | null;
  if (c) {
    L.push("");
    L.push(`العقد: رقم ${c.contractNo ?? "—"} بتاريخ ${c.contractDate ?? "—"} | البائع ${c.sellerName ?? "—"} | السعر ${n(c.contractPrice)} | العربون ${n(c.downPayment)}`);
    const prog = b.contractProgress as Record<string, string> | null;
    if (prog) L.push(`المدفوع للبائع ${n(prog.paid)} | المتبقي ${n(prog.remaining)} | المتأخر ${n(prog.overdue)}`);
  }
  if (notes.length) {
    L.push("");
    L.push("ملاحظات المساعد:");
    for (const x of notes) L.push(`- ${x.at.slice(0, 10)}: ${x.note}`);
  }
  return L.join("\n");
}

/** Rebuild changed project files + the portfolio index. Cheap when nothing changed. */
export async function syncKnowledge() {
  const rows = await prisma.invProject.findMany({ select: { id: true, name: true, status: true }, orderBy: { createdAt: "asc" } });
  const old = readManifest();
  const next: Manifest = {};
  const index: { id: string; name: string; code: string; status: string; capital: unknown; partners: string[]; expensesTotal: number; purchasePrice: unknown }[] = [];
  for (const r of rows) {
    let brief: Brief;
    try {
      brief = await projectBrief(r.id);
    } catch {
      continue;
    }
    const notes = notesFor(r.id);
    const json = JSON.stringify({ ...brief, assistantNotes: notes }, null, 2);
    const hash = hashOf(json);
    if (old[r.id]?.hash !== hash) {
      writeSealed(`${r.id}.json.enc`, json);
      writeSealed(`${r.id}.txt.enc`, toTxt(brief, notes));
    }
    next[r.id] = { hash, name: r.name, status: r.status, updatedAt: old[r.id]?.hash === hash ? old[r.id]!.updatedAt : new Date().toISOString() };
    index.push({
      id: r.id,
      name: String(brief.name),
      code: String(brief.code ?? ""),
      status: String(brief.status),
      capital: (brief.stats as { capital?: unknown } | null)?.capital ?? null,
      partners: brief.partners.map((p) => `${p.name}${p.coordinator ? "*" : ""}`),
      expensesTotal: brief.expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0),
      purchasePrice: brief.purchasePrice,
    });
  }
  for (const id of Object.keys(old)) {
    if (!next[id]) for (const ext of ["json.enc", "txt.enc", "notes.enc"]) fs.rmSync(path.join(dir(), `${id}.${ext}`), { force: true });
  }
  writeSealed("manifest.enc", JSON.stringify(next));
  writeSealed("index.json.enc", JSON.stringify(index, null, 2));
  const txt = index
    .map(
      (p) =>
        `- ${p.name} (${p.code}) [${p.status}] id=${p.id} | رأس المال ${n(p.capital)} | الشراء ${n(p.purchasePrice)} | المصاريف ${n(p.expensesTotal)} | الشركاء: ${p.partners.join("، ")}`
    )
    .join("\n");
  writeSealed("index.txt.enc", txt || "لا توجد مشاريع بعد.");
  return { projects: index.length };
}

export function readIndexTxt() {
  return readSealed("index.txt.enc") ?? "";
}

export function readProjectFile(projectId: string, format: "json" | "txt") {
  return readSealed(`${safeId(projectId)}.${format}.enc`);
}

export function readIndexFile(format: "json" | "txt") {
  return readSealed(`index.${format}.enc`);
}

export function listKnowledge() {
  const m = readManifest();
  return Object.entries(m).map(([id, v]) => ({ projectId: id, ...v }));
}

export async function addProjectNote(projectId: string, note: string) {
  const id = safeId(projectId);
  const list = notesFor(id);
  list.push({ at: new Date().toISOString(), note: note.slice(0, 1000) });
  writeSealed(`${id}.notes.enc`, JSON.stringify(list.slice(-200)));
}
