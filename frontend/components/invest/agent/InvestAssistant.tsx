"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import {
  agentApi,
  knowledgeHref,
  type AgentAttachment,
  type AgentKnowledgeFile,
  type AgentConversation,
  type AgentMemory,
  type AgentMessage,
} from "@/lib/investAgentApi";
import { ErrorNote, btnGhost, inputCls, useT } from "../crm/ui";
import { useAdminSession } from "@/lib/adminPermissions";

const SPEAK_KEY = "invest-agent-speak";

function readSpeakPref() {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(SPEAK_KEY) === "1";
  } catch {
    return false;
  }
}

function speak(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*_#`>|]/g, "").replace(/\s+\n/g, "\n").slice(0, 1500);
    const u = new SpeechSynthesisUtterance(clean);
    const arabic = /[؀-ۿ]/.test(clean);
    u.lang = arabic ? "ar-SA" : "en-US";
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(arabic ? "ar" : "en"));
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  } catch {
    /* speech is optional */
  }
}

/** Plain text with **bold** spans (the only markdown the assistant tends to use). */
function RichText({ text }: { text: string }) {
  const parts = text.replace(/^#{1,4}\s+/gm, "").split(/(\*\*[^*\n]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
      )}
    </>
  );
}

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

/** Admin-only investment assistant: chat (text + voice + bill photos) that creates and updates projects. */
export function InvestAssistant({ projectId }: { projectId: string | null }) {
  const { t } = useT();
  const session = useAdminSession();
  if (!session.has("investAi")) {
    return (
      <div className="max-w-xl rounded-2xl border border-line bg-white p-5 text-sm">
        {t("ليس لديك صلاحية «مساعد الاستثمار الذكي». اطلبها من المدير العام.", "You don't have the “Investment AI assistant” permission. Ask a full admin.")}
      </div>
    );
  }
  return <AssistantInner projectId={projectId} />;
}

function AssistantInner({ projectId }: { projectId: string | null }) {
  const { t } = useT();
  const [status, setStatus] = useState<{ enabled: boolean; vision: boolean } | null>(null);
  const [convs, setConvs] = useState<AgentConversation[]>([]);
  const [active, setActive] = useState<AgentConversation | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<AgentAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [speakOn, setSpeakOn] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [memory, setMemory] = useState<AgentMemory[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [files, setFiles] = useState<AgentKnowledgeFile[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const errText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

  const openConversation = useCallback(
    async (c: AgentConversation) => {
      setActive(c);
      setMessages([]);
      try {
        const data = await agentApi.conversation(c.id);
        setActive(data.conversation);
        setMessages(data.messages);
      } catch (err) {
        setError(errText(err, t("تعذّر فتح المحادثة", "Could not open the chat")));
      }
    },
    [t]
  );

  // First load: status, conversation list, and the right conversation for the page context.
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [st, list] = await Promise.all([agentApi.status(), agentApi.conversations()]);
        if (ignore) return;
        setSpeakOn(readSpeakPref());
        setStatus(st);
        setConvs(list);
        let target = projectId ? list.find((c) => c.projectId === projectId) : list[0];
        if (projectId && !target) {
          target = await agentApi.createConversation(projectId);
          if (ignore) return;
          setConvs((x) => [target!, ...x]);
        }
        if (target) await openConversation(target);
      } catch (err) {
        if (!ignore) setError(errText(err, t("تعذّر تحميل المساعد", "Could not load the assistant")));
      }
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recRef.current?.stream.getTracks().forEach((tr) => tr.stop());
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    },
    []
  );

  async function newConversation() {
    setError("");
    try {
      const c = await agentApi.createConversation(null);
      setConvs((x) => [c, ...x]);
      setActive(c);
      setMessages([]);
      inputRef.current?.focus();
    } catch (err) {
      setError(errText(err, t("تعذّر بدء محادثة", "Could not start a chat")));
    }
  }

  async function removeConversation(c: AgentConversation) {
    if (!window.confirm(t("حذف هذه المحادثة؟ (لا يحذف أي بيانات من المشاريع)", "Delete this chat? (project data is kept)"))) return;
    try {
      await agentApi.deleteConversation(c.id);
      setConvs((x) => x.filter((y) => y.id !== c.id));
      if (active?.id === c.id) {
        setActive(null);
        setMessages([]);
      }
    } catch (err) {
      setError(errText(err, t("تعذّر الحذف", "Delete failed")));
    }
  }

  async function send() {
    const body = text.trim();
    if ((!body && !pending.length) || sending) return;
    setError("");
    let conv = active;
    try {
      if (!conv) {
        conv = await agentApi.createConversation(projectId);
        setConvs((x) => [conv!, ...x]);
        setActive(conv);
      }
      const optimistic: AgentMessage = {
        id: `tmp-${Date.now()}`,
        role: "user",
        content: body,
        attachments: pending,
        actions: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m, optimistic]);
      setText("");
      const ids = pending.map((p) => p.documentId);
      setPending([]);
      setSending(true);
      const out = await agentApi.send(conv.id, body, ids);
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), out.user, out.reply]);
      const title = body.slice(0, 70);
      setConvs((x) =>
        x.map((c) => (c.id === conv!.id ? { ...c, projectId: out.projectId, title: c.title === "محادثة جديدة" && title ? title : c.title } : c))
      );
      setActive((a) => (a ? { ...a, projectId: out.projectId } : a));
      if (speakOn && out.reply.content) speak(out.reply.content);
    } catch (err) {
      setMessages((m) => m.filter((x) => !x.id.startsWith("tmp-")));
      setText(body);
      setError(errText(err, t("تعذّر الإرسال", "Send failed")));
    } finally {
      setSending(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      for (const f of Array.from(files).slice(0, 6 - pending.length)) {
        const a = await agentApi.upload(f);
        setPending((x) => [...x, a]);
      }
    } catch (err) {
      setError(errText(err, t("تعذّر رفع الملف", "Upload failed")));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function toggleRecording() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(t("المتصفح لا يدعم التسجيل الصوتي", "This browser can't record audio"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" });
        if (blob.size < 1500) return;
        setTranscribing(true);
        try {
          const { text: heard } = await agentApi.transcribe(blob);
          if (heard) setText((x) => (x.trim() ? `${x.trim()} ${heard}` : heard));
          inputRef.current?.focus();
        } catch (err) {
          setError(errText(err, t("تعذّر تحويل الصوت", "Transcription failed")));
        } finally {
          setTranscribing(false);
        }
      };
      recRef.current = rec;
      rec.start();
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s >= 179) rec.stop();
          return s + 1;
        });
      }, 1000);
      setRecording(true);
    } catch {
      setError(t("لم يُسمح باستخدام الميكروفون", "Microphone permission was denied"));
    }
  }

  function toggleSpeak() {
    const next = !speakOn;
    setSpeakOn(next);
    try {
      window.localStorage.setItem(SPEAK_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (!next) {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    }
  }

  async function openMemory() {
    setShowMemory((v) => !v);
    try {
      const [m, f] = await Promise.all([agentApi.memory(), agentApi.knowledge()]);
      setMemory(m);
      setFiles(f);
    } catch (err) {
      setError(errText(err, t("تعذّر تحميل الذاكرة", "Could not load memory")));
    }
  }

  async function refreshFiles() {
    setSyncing(true);
    try {
      await agentApi.syncKnowledge();
      setFiles(await agentApi.knowledge());
    } catch (err) {
      setError(errText(err, t("تعذّر التحديث", "Refresh failed")));
    } finally {
      setSyncing(false);
    }
  }

  async function addMemory() {
    const c = newMemory.trim();
    if (!c) return;
    try {
      const m = await agentApi.addMemory(c);
      setMemory((x) => [...x, m]);
      setNewMemory("");
    } catch (err) {
      setError(errText(err, t("تعذّر الحفظ", "Save failed")));
    }
  }

  async function deleteMemory(id: string) {
    try {
      await agentApi.deleteMemory(id);
      setMemory((x) => x.filter((m) => m.id !== id));
    } catch (err) {
      setError(errText(err, t("تعذّر الحذف", "Delete failed")));
    }
  }

  const disabled = status ? !status.enabled : false;

  return (
    <div className="max-w-6xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/invest" className="text-xs font-bold text-ink-soft hover:text-green">
            ← {t("شراكات الاستثمار", "Investments")}
          </Link>
          <h1 className="text-2xl font-extrabold text-green mt-1">{t("مساعد الاستثمار", "Investment assistant")}</h1>
          <p className="text-sm text-ink-soft mt-1">
            {t(
              "أخبره عن المشروع كتابةً أو بالصوت، يسألك عن الناقص ثم ينشئ المشروع. بعدها أرسل له الفواتير والمصاريف والدفعات.",
              "Describe a project by text or voice; it asks for what's missing, then creates it. Later send bills, expenses and payments."
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={toggleSpeak} className={`${btnGhost} ${speakOn ? "!border-green !text-green" : ""}`}>
            {speakOn ? t("🔊 قراءة الردود: تعمل", "🔊 Read replies: on") : t("🔈 قراءة الردود", "🔈 Read replies")}
          </button>
          <button type="button" onClick={openMemory} className={btnGhost}>
            {t("ذاكرة المساعد", "Assistant memory")}
          </button>
        </div>
      </header>

      {disabled ? (
        <ErrorNote message={t("لم يتم إعداد مفتاح الذكاء الاصطناعي. أضفه من الإعدادات ← الذكاء الاصطناعي.", "No AI key configured. Add one under Settings → AI.")} />
      ) : null}

      {showMemory ? (
        <section className="rounded-2xl border border-line bg-white p-4 space-y-3">
          <div>
            <h2 className="font-extrabold text-ink">{t("ما يتذكره المساعد عنك", "What the assistant remembers about you")}</h2>
            <p className="text-[11px] text-ink-soft">
              {t(
                "خاصة بحسابك وبهذا المساعد فقط — منفصلة تماماً عن مساعد الموقع العام.",
                "Private to your account and this assistant only — fully separate from the public website assistant."
              )}
            </p>
          </div>
          {memory.length ? (
            <ul className="space-y-1.5">
              {memory.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                  <span dir="auto">{m.content}</span>
                  <button type="button" className="text-[11px] font-bold text-red-700 shrink-0" onClick={() => deleteMemory(m.id)}>
                    {t("حذف", "Delete")}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">{t("لا شيء بعد.", "Nothing yet.")}</p>
          )}
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              placeholder={t("مثال: عمولتي المعتادة 10%", "e.g. my usual cut is 10%")}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addMemory();
              }}
            />
            <button type="button" className={btnGhost} onClick={addMemory}>
              {t("إضافة", "Add")}
            </button>
          </div>
          <div className="border-t border-line pt-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-ink text-sm">{t("ملفات ذاكرة المشاريع (مشفّرة)", "Project memory files (encrypted)")}</h3>
                <p className="text-[11px] text-ink-soft">
                  {t(
                    "ملف JSON وملف TXT لكل مشروع، تُبنى تلقائياً من البيانات الحية وتُحفظ مشفّرة (AES-256) على السيرفر. التنزيل يفك التشفير لك فقط.",
                    "A JSON and a TXT file per project, rebuilt from live data and stored AES-256 encrypted on the server. Downloads are decrypted for you only."
                  )}
                </p>
              </div>
              <div className="flex gap-2 text-xs font-bold">
                <a className="text-green" href={knowledgeHref("index", "txt")}>{t("فهرس كل المشاريع TXT", "All-projects index TXT")}</a>
                <a className="text-green" href={knowledgeHref("index", "json")}>JSON</a>
                <button type="button" className="text-ink-soft" onClick={refreshFiles} disabled={syncing}>
                  {syncing ? "…" : t("تحديث", "Refresh")}
                </button>
              </div>
            </div>
            {files.length ? (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {files.map((f) => (
                  <li key={f.projectId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-bold" dir="auto">
                      {f.name} <span className="text-[10px] text-ink-soft font-normal">{f.status}</span>
                    </span>
                    <span className="flex gap-3 text-xs font-bold shrink-0">
                      <a className="text-green" href={knowledgeHref(f.projectId, "txt")}>TXT</a>
                      <a className="text-green" href={knowledgeHref(f.projectId, "json")}>JSON</a>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">{t("لا مشاريع بعد.", "No projects yet.")}</p>
            )}
          </div>
        </section>
      ) : null}

      <div className="grid lg:grid-cols-[240px_1fr] gap-4 items-start">
        <aside className="rounded-2xl border border-line bg-white overflow-hidden">
          <div className="p-2 border-b border-line">
            <button type="button" onClick={newConversation} className="w-full h-10 rounded-xl bg-green text-white text-sm font-bold">
              + {t("محادثة جديدة", "New chat")}
            </button>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            {convs.length ? (
              convs.map((c) => (
                <div key={c.id} className={`group flex items-center border-b border-line ${active?.id === c.id ? "bg-green/10" : ""}`}>
                  <button type="button" onClick={() => openConversation(c)} className="flex-1 min-w-0 text-start px-3 py-2.5">
                    <div className="text-sm font-bold text-ink truncate" dir="auto">
                      {c.title}
                    </div>
                    {c.projectId ? <div className="text-[10px] text-green font-bold">{t("مرتبطة بمشروع", "Linked to a project")}</div> : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeConversation(c)}
                    className="px-2 text-ink-soft hover:text-red-700 text-sm"
                    aria-label={t("حذف المحادثة", "Delete chat")}
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <p className="p-3 text-xs text-ink-soft">{t("لا محادثات بعد.", "No chats yet.")}</p>
            )}
          </div>
        </aside>

        <section className="rounded-2xl border border-line bg-white flex flex-col min-h-[60vh] max-h-[78vh]">
          {active?.projectId ? (
            <div className="px-4 py-2 border-b border-line text-xs">
              <Link href={`/admin/invest/projects/${active.projectId}`} className="font-bold text-green">
                {t("فتح صفحة المشروع ←", "Open project page →")}
              </Link>
            </div>
          ) : null}
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {!messages.length && !sending ? (
              <div className="text-sm text-ink-soft space-y-2 max-w-xl">
                <p className="font-bold text-ink">{t("أمثلة:", "Examples:")}</p>
                <p>• {t("«مشروع جديد: أرض في ناعور قطعة 55 حوض 3، 4 دونم، اشتريناها بـ 500 ألف، الشركاء أنا وأحمد وخالد»", "“New project: land in Naour plot 55, 4 dunums, bought for 500k, partners me, Ahmad and Khaled”")}</p>
                <p>• {t("«سجّل رسوم تسجيل 12 ألف دفعتها أنا أمس»", "“Record 12k registration fees I paid yesterday”")}</p>
                <p>• {t("«غيّر الدفعة الأولى لخالد إلى 180 ألف»", "“Change Khaled's initial payment to 180k”")}</p>
                <p>• {t("أرفق صورة فاتورة وقل من دفعها.", "Attach a bill photo and say who paid it.")}</p>
              </div>
            ) : null}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    m.role === "user" ? "bg-green text-white rounded-ss-sm" : "bg-surface-2 text-ink rounded-se-sm"
                  }`}
                >
                  {m.content ? (
                    <div className="whitespace-pre-wrap leading-relaxed" dir="auto">
                      <RichText text={m.content} />
                    </div>
                  ) : null}
                  {m.attachments.length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.attachments.map((a) => (
                        <a
                          key={a.documentId}
                          href={`/api/invest/documents/${a.documentId}/download`}
                          className={`text-[11px] px-2 py-0.5 rounded-lg ${m.role === "user" ? "bg-white/20" : "bg-white border border-line"}`}
                        >
                          📎 {a.name}
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {m.actions.length ? (
                    <div className="mt-2 flex flex-col gap-1">
                      {m.actions.map((a, i) =>
                        a.href ? (
                          <Link key={i} href={a.href} className="text-[12px] font-bold text-green bg-white border border-green/30 rounded-lg px-2 py-1">
                            ✓ {a.label}
                          </Link>
                        ) : (
                          <span key={i} className="text-[12px] font-bold text-ink-soft bg-white border border-line rounded-lg px-2 py-1">
                            ✓ {a.label}
                          </span>
                        )
                      )}
                    </div>
                  ) : null}
                  {m.role === "assistant" && m.content ? (
                    <button type="button" onClick={() => speak(m.content)} className="mt-1 text-[10px] text-ink-soft hover:text-green">
                      🔊 {t("استمع", "Listen")}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {sending ? (
              <div className="flex justify-end">
                <div className="rounded-2xl bg-surface-2 px-3.5 py-2.5 text-sm text-ink-soft animate-pulse">{t("يعمل…", "Working…")}</div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-line p-3 space-y-2">
            <ErrorNote message={error} />
            {pending.length ? (
              <div className="flex flex-wrap gap-1.5">
                {pending.map((a) => (
                  <span key={a.documentId} className="text-[11px] px-2 py-1 rounded-lg bg-surface-2 inline-flex items-center gap-1">
                    📎 {a.name}
                    <button type="button" className="text-red-700 font-bold" onClick={() => setPending((x) => x.filter((y) => y.documentId !== a.documentId))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                className={`${inputCls} min-h-[46px] max-h-40 py-2.5 resize-y`}
                rows={2}
                dir="auto"
                value={text}
                disabled={disabled}
                placeholder={
                  recording
                    ? t("جارٍ التسجيل… اضغط ■ للإيقاف", "Recording… press ■ to stop")
                    : transcribing
                      ? t("جارٍ تحويل الصوت إلى نص…", "Transcribing…")
                      : t("اكتب أو سجّل رسالتك…", "Type or record your message…")
                }
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => onFiles(e.target.files)} />
              <button
                type="button"
                title={t("إرفاق فاتورة أو مستند", "Attach a bill or document")}
                disabled={disabled || uploading || pending.length >= 6}
                onClick={() => fileRef.current?.click()}
                className="h-[46px] w-[46px] shrink-0 rounded-xl border border-line text-lg disabled:opacity-40"
              >
                {uploading ? "…" : "📎"}
              </button>
              <button
                type="button"
                title={recording ? t("إيقاف التسجيل", "Stop recording") : t("تسجيل صوتي", "Record voice")}
                disabled={disabled || transcribing}
                onClick={toggleRecording}
                className={`h-[46px] min-w-[46px] px-2 shrink-0 rounded-xl text-sm font-bold disabled:opacity-40 ${
                  recording ? "bg-red-600 text-white animate-pulse" : "border border-line"
                }`}
              >
                {recording ? `■ ${seconds}s` : transcribing ? "…" : "🎤"}
              </button>
              <button
                type="button"
                disabled={disabled || sending || recording || (!text.trim() && !pending.length)}
                onClick={send}
                className="h-[46px] px-4 shrink-0 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-40"
              >
                {t("إرسال", "Send")}
              </button>
            </div>
            <p className="text-[10px] text-ink-soft">
              {t(
                "المساعد يطلب تأكيدك قبل إنشاء المشروع أو تسجيل المبالغ، ولا يستطيع حذف أي شيء. كل ما يسجّله يظهر في صفحة المشروع وسجل التدقيق.",
                "The assistant asks before creating projects or recording money and can't delete anything. Everything it records shows on the project page and audit log."
              )}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
