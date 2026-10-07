"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageProvider";
import { CloseIcon, MessageIcon } from "@/components/icons";
import { AssistantOfferCardView, AssistantServiceCardView } from "@/components/assistant/AssistantCards";
import { OPEN_ASSISTANT_EVENT } from "@/lib/assistantUi";
import type { AssistantCard } from "@/lib/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards?: AssistantCard[];
};

const QUICK_LINKS = [
  { href: "/opportunities", key: "opportunities" as const },
  { href: "/offers", key: "offers" as const },
  { href: "/services", key: "services" as const },
  { href: "/land-check", key: "landCheck" as const },
  { href: "/contact", key: "contact" as const },
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AiAssistant() {
  const { t, lang } = useLanguage();
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [offerContext, setOfferContext] = useState<{
    id: string;
    listingNo: string;
    title: string;
    area: string;
    industryType: string;
    dealType: string;
    status: string;
    size?: string | null;
    price?: string | null;
    description?: string;
  } | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastReplyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .assistantStatus()
      .then((s) => {
        if (!cancelled) setEnabled(s.enabled !== false);
      })
      .catch(() => {
        if (!cancelled) setEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener(OPEN_ASSISTANT_EVENT, openChat);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, openChat);
  }, []);

  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(overlap > 40 ? overlap : 0);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (busy) return;

    const node = lastReplyRef.current;
    const root = scrollerRef.current;
    if (node && root) {
      const centerReply = () => {
        const viewH = root.clientHeight;
        const msgH = node.offsetHeight;
        // Center the AI reply bubble in the chat pane; leave room below for cards.
        const top = Math.max(0, node.offsetTop - Math.max(24, (viewH - msgH) / 2));
        const maxTop = Math.max(0, root.scrollHeight - viewH);
        root.scrollTo({ top: Math.min(top, maxTop), behavior: "smooth" });
      };
      requestAnimationFrame(() => {
        centerReply();
        // Second pass after cards/layout settle so centering stays accurate.
        window.setTimeout(centerReply, 80);
      });
      return;
    }
    if (!messages.length) {
      scrollerRef.current?.scrollTo({ top: 0 });
    }
  }, [open, messages, busy]);

  useEffect(() => {
    let cancelled = false;
    const match = pathname.match(/^\/offers\/([^/?#]+)/);
    if (!match) {
      setOfferContext(null);
      return;
    }
    const listingId = decodeURIComponent(match[1]);
    api
      .publicListing(listingId)
      .then((listing) => {
        if (cancelled) return;
        setOfferContext({
          id: listing.id,
          listingNo: listing.listingNo,
          title: listing.title,
          area: listing.area,
          industryType: listing.industryType,
          dealType: listing.dealType,
          status: listing.status,
          size: listing.size,
          price: listing.price,
          description: listing.description?.slice(0, 300),
        });
      })
      .catch(() => {
        if (!cancelled) setOfferContext(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);

    try {
      const history = nextMessages
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 800) }));
      const res = await api.assistantChat({
        lang,
        messages: history,
        context: offerContext ? { offer: offerContext } : undefined,
      });
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: res.reply, cards: res.cards },
      ]);
    } catch {
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

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const quickLabels = {
    opportunities: t.nav.opportunities,
    offers: t.nav.offers,
    services: t.nav.services,
    landCheck: t.landCheck.pageCta,
    contact: t.nav.contact,
  };

  return (
    <div
      className={`z-[60] flex flex-col items-end gap-3 ${
        open
          ? "pointer-events-none fixed inset-0 lg:pointer-events-none lg:inset-auto lg:bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))] lg:end-6"
          : "pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] end-4 sm:bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:end-6"
      }`}
      style={open ? { paddingBottom: keyboardInset } : undefined}
    >
      {open && (
        <>
          <button
            type="button"
            className="pointer-events-auto absolute inset-0 bg-black/45 lg:hidden"
            aria-label={t.assistant.close}
            onClick={() => setOpen(false)}
          />
          <section
            className="pointer-events-auto relative flex w-full flex-col overflow-hidden bg-[#f7f5f0] max-lg:h-[100dvh] max-lg:pt-[env(safe-area-inset-top,0px)] lg:h-[min(70vh,560px)] lg:w-[min(100vw-2rem,400px)] lg:rounded-3xl lg:border lg:border-line lg:shadow-[0_28px_60px_-28px_rgba(15,52,47,0.55)]"
            role="dialog"
            aria-modal="true"
            aria-label={t.assistant.title}
            onClick={(e) => {
              const a = (e.target as HTMLElement).closest("a");
              const href = a?.getAttribute("href");
              if (href && href.startsWith("/")) setOpen(false);
            }}
          >
            <header className="flex items-start justify-between gap-3 bg-green px-4 py-3.5 text-white">
              <div>
                <p className="text-sm font-bold">{t.assistant.title}</p>
                <p className="mt-0.5 text-[11px] text-white/75">{t.assistant.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 min-w-11 rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label={t.assistant.close}
              >
                <CloseIcon />
              </button>
            </header>

            <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="rounded-2xl border border-line bg-white px-3.5 py-3 text-sm leading-relaxed text-ink-soft">
                    {t.assistant.empty}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {t.assistant.starters.map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        disabled={busy}
                        onClick={() => void send(starter)}
                        className="min-h-11 rounded-full border border-line bg-white px-3 py-2 text-[12px] font-bold text-green hover:border-gold/50 disabled:opacity-60"
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => {
                const isLastReply = msg.id === lastAssistantId;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-stretch"}`}
                  >
                    <div
                      ref={isLastReply ? lastReplyRef : undefined}
                      className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user" ? "bg-green text-white" : "border border-line bg-white text-ink"
                      }`}
                    >
                      {msg.content}
                    </div>
                    {msg.cards && msg.cards.length > 0 && (
                      <div className="grid gap-2">
                        {isLastReply && (
                          <p className="px-1 text-[11px] font-bold text-ink-soft">{t.assistant.moreBelow}</p>
                        )}
                        {msg.cards.map((card) =>
                          card.type === "offer" ? (
                            <AssistantOfferCardView key={`offer-${card.offer.id}`} offer={card.offer} />
                          ) : (
                            <AssistantServiceCardView key={`service-${card.service.id}`} service={card.service} />
                          )
                        )}
                      </div>
                    )}
                    {isLastReply && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {QUICK_LINKS.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-3 text-[12px] font-bold text-green"
                          >
                            {quickLabels[link.key]}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {busy && <p className="text-xs font-bold text-ink-soft animate-pulse">{t.assistant.thinking}</p>}
            </div>

            <form
              onSubmit={onSubmit}
              className="border-t border-line bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
            >
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t.assistant.placeholder}
                  maxLength={2000}
                  disabled={busy}
                  enterKeyHint="send"
                  className="h-12 min-h-12 flex-1 rounded-full border border-line bg-surface-2 px-4 text-base outline-none focus:border-gold/50 disabled:opacity-60 sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="h-12 min-h-12 shrink-0 rounded-full bg-green px-5 text-sm font-bold text-white hover:bg-green-2 disabled:opacity-50"
                >
                  {t.assistant.send}
                </button>
              </div>
            </form>
          </section>
        </>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto inline-flex h-14 min-h-14 items-center gap-2 rounded-full bg-green px-5 text-sm font-bold text-white shadow-[0_18px_40px_-18px_rgba(15,52,47,0.75)] hover:bg-green-2"
          aria-expanded={false}
          aria-label={t.assistant.open}
        >
          <MessageIcon className="h-5 w-5" />
          <span className="hidden sm:inline">{t.assistant.title}</span>
        </button>
      )}
    </div>
  );
}
