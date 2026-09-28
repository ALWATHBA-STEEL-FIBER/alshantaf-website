"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageProvider";
import { CloseIcon, MessageIcon } from "@/components/icons";
import { AssistantOfferCardView, AssistantServiceCardView } from "@/components/assistant/AssistantCards";
import type { AssistantCard } from "@/lib/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards?: AssistantCard[];
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AiAssistant() {
  const { t, lang } = useLanguage();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .assistantStatus()
      .then((s) => {
        // Backend always reports enabled; keep widget available even if AI is degraded.
        if (!cancelled) setEnabled(s.enabled !== false);
      })
      .catch(() => {
        // Network blip — still show the assistant; chat endpoint degrades gracefully.
        if (!cancelled) setEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
    inputRef.current?.focus();
  }, [open, messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);

    try {
      const history = nextMessages.slice(-12).map((m) => ({ role: m.role, content: m.content }));
      const res = await api.assistantChat({ lang, messages: history });
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: res.reply, cards: res.cards },
      ]);
    } catch {
      // Last-resort client fallback — backend already avoids hard failures.
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: t.assistant.error,
          cards: [
            {
              type: "service",
              service: {
                id: "contact",
                title: lang === "ar" ? "تواصل معنا" : "Contact us",
                note:
                  lang === "ar"
                    ? "تواصل مع فريق الشنتف لأي استفسار."
                    : "Reach the Alshantaf team with any question.",
                href: "/contact",
                cta: lang === "ar" ? "تواصل معنا" : "Contact us",
              },
            },
          ],
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  if (!enabled) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 end-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:end-6">
      {open && (
        <section
          className="pointer-events-auto flex h-[min(70vh,560px)] w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-3xl border border-line bg-[#f7f5f0] shadow-[0_28px_60px_-28px_rgba(15,52,47,0.55)]"
          role="dialog"
          aria-label={t.assistant.title}
        >
          <header className="flex items-start justify-between gap-3 bg-green px-4 py-3.5 text-white">
            <div>
              <p className="text-sm font-bold">{t.assistant.title}</p>
              <p className="mt-0.5 text-[11px] text-white/75">{t.assistant.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label={t.assistant.close}
            >
              <CloseIcon />
            </button>
          </header>

          <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="rounded-2xl bg-white px-3.5 py-3 text-sm leading-relaxed text-ink-soft border border-line">
                  {t.assistant.empty}
                </p>
                <div className="flex flex-wrap gap-2">
                  {t.assistant.starters.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      disabled={busy}
                      onClick={() => void send(starter)}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-bold text-green hover:border-gold/50 disabled:opacity-60"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-stretch"}`}>
                <div
                  className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-green text-white"
                      : "border border-line bg-white text-ink"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.cards && msg.cards.length > 0 && (
                  <div className="grid gap-2">
                    {msg.cards.map((card) =>
                      card.type === "offer" ? (
                        <AssistantOfferCardView key={`offer-${card.offer.id}`} offer={card.offer} />
                      ) : (
                        <AssistantServiceCardView key={`service-${card.service.id}`} service={card.service} />
                      )
                    )}
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <p className="text-xs font-bold text-ink-soft animate-pulse">{t.assistant.thinking}</p>
            )}
          </div>

          <form onSubmit={onSubmit} className="border-t border-line bg-white p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.assistant.placeholder}
                maxLength={2000}
                disabled={busy}
                className="h-11 flex-1 rounded-full border border-line bg-surface-2 px-4 text-sm outline-none focus:border-gold/50 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="h-11 shrink-0 rounded-full bg-green px-4 text-sm font-bold text-white hover:bg-green-2 disabled:opacity-50"
              >
                {t.assistant.send}
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto inline-flex h-14 items-center gap-2 rounded-full bg-green px-5 text-sm font-bold text-white shadow-[0_18px_40px_-18px_rgba(15,52,47,0.75)] hover:bg-green-2"
        aria-expanded={open}
        aria-label={open ? t.assistant.close : t.assistant.open}
      >
        {open ? <CloseIcon /> : <MessageIcon className="h-5 w-5" />}
        <span className="hidden sm:inline">{open ? t.assistant.close : t.assistant.title}</span>
      </button>
    </div>
  );
}
