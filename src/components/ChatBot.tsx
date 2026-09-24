"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { MessageCircle, X, ArrowUp } from "lucide-react";
import { CategoryIcon } from "@/components/tienda/categoryIcons";

// The chat bubble renders plain text (no markdown parser, by design — no
// new dependency for a handful of short messages). The system prompt asks
// the model to avoid markdown, but a user can explicitly ask for "bold"
// and the model will still reach for **asterisks** anyway — this strips
// the common tokens as a second layer so raw syntax never leaks through.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "• ");
}

// Mirrors the shape buscarProductos (src/lib/chatTools.ts) returns — kept
// separate from that file's inline return type since this is the client
// bundle, not server code.
interface ProductoResultado {
  nombre: string;
  categoria: string;
  precio: string;
  precioRegular: string | null;
  disponible: boolean;
  stock: number;
  imagen: string | null;
}

/** Real catalog photos for whatever buscarProductos just found, rendered
 *  as a horizontally-scrollable row next to the assistant's text — this is
 *  what lets "compara esta impresora con esa otra" actually show both
 *  side by side instead of the model just describing them in prose. Same
 *  photo (or category icon placeholder) the storefront itself uses, so a
 *  product looks the same in chat as it does on /tienda. */
function ProductResults({ productos }: { productos: ProductoResultado[] }) {
  if (productos.length === 0) return null;
  return (
    <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
      {productos.map((p, i) => (
        <div
          key={i}
          className="w-[124px] shrink-0 overflow-hidden rounded-xl border border-border bg-bg-alt"
        >
          <div className="flex h-[88px] w-full items-center justify-center bg-bg">
            {p.imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imagen} alt={p.nombre} className="h-full w-full object-contain p-2" />
            ) : (
              <CategoryIcon category={p.categoria} size={26} strokeWidth={1.25} className="text-fg-muted opacity-40" />
            )}
          </div>
          <div className="flex flex-col gap-0.5 p-2">
            <span className="truncate text-[8px] font-black uppercase tracking-wider text-fg-muted">
              {p.categoria}
            </span>
            <span className="line-clamp-2 text-[11px] font-bold leading-tight text-fg">{p.nombre}</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xs font-black text-accent">{p.precio}</span>
              {p.precioRegular && (
                <span className="text-[9px] text-fg-muted line-through">{p.precioRegular}</span>
              )}
            </div>
            <span className={`text-[9px] font-bold ${p.disponible ? "text-emerald-500" : "text-red-400"}`}>
              {p.disponible ? "En stock" : "Agotado"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Mirrors MAX_MESSAGE_CHARS in src/app/api/chat/route.ts — keeps the
// paste-a-huge-block-of-text case from ever leaving the browser instead of
// round-tripping to get rejected server-side.
const MAX_MESSAGE_CHARS = 500;

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isBusy, error]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isBusy) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <>
      <button
        onClick={() => setIsOpen((v) => !v)}
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        className="fixed right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg shadow-accent/30 transition-transform hover:scale-105 active:scale-95"
        aria-label="Abrir asistente"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {isOpen && (
        // Mobile: near-fullscreen sheet (inset-x-3 + top-3 instead of a
        // small floating card) — a fixed 70vh card leaves too little room
        // once the on-screen keyboard opens on a phone, which is where
        // most Infosistel customers are. dvh (not vh) so the panel doesn't
        // get stuck sized against the address-bar-hidden viewport and then
        // clipped when the bar reappears — Android Chrome. From sm: up
        // (real desktop pointer, no keyboard-over-viewport problem) it
        // goes back to the small floating-card layout.
        <div
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          className="fixed inset-x-3 top-3 bottom-3 z-50 flex flex-col overflow-hidden rounded-3xl border border-border bg-bg-alt shadow-2xl sm:inset-x-auto sm:inset-y-auto sm:bottom-24 sm:right-6 sm:h-[70dvh] sm:max-h-[560px] sm:w-96"
        >
          <div className="flex shrink-0 items-center gap-3 bg-accent px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/10">
              <MessageCircle size={16} className="text-accent-fg" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight text-accent-fg">Asistente Infosistel</p>
              <p className="text-[11px] font-medium text-accent-fg/70">Responde en segundos</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-accent-fg/70 transition-colors hover:text-accent-fg"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <MessageCircle size={28} className="text-fg-muted opacity-40" />
                <p className="text-sm font-medium text-fg-muted">
                  Pregúntame por servicios, horarios o cómo llegar.
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "rounded-br-md bg-bg-raised text-fg"
                      : "rounded-bl-md bg-bg text-fg-muted"
                  }`}
                >
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <span key={i}>
                          {message.role === "assistant" ? stripMarkdown(part.text) : part.text}
                        </span>
                      );
                    }
                    if (part.type === "tool-buscarProductos" && part.state === "output-available") {
                      const productos = (part.output as { productos?: ProductoResultado[] } | undefined)
                        ?.productos;
                      return productos ? <ProductResults key={i} productos={productos} /> : null;
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}

            {isBusy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-bg px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-muted"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-red-500/10 px-4 py-2.5 text-sm leading-relaxed text-red-400">
                  {/* Server-specific message when the AI SDK's onError supplied one
                      (invalid key, sin saldo, etc.) — generic fallback otherwise. */}
                  {error?.message || "No pude responder en este momento."} Intenta de nuevo o
                  escríbenos por{" "}
                  <a
                    href="https://wa.me/51964648202"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold underline"
                  >
                    WhatsApp
                  </a>
                  .
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-2 border-t border-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              disabled={isBusy}
              maxLength={MAX_MESSAGE_CHARS}
              // 16px (text-base), not text-sm (14px) — below 16px, iOS
              // Safari auto-zooms the whole page on focus, which on a
              // small phone screen shoves the input out from under the
              // keyboard. Purely a mobile-correctness fix, invisible on
              // desktop.
              className="flex-1 rounded-full bg-bg px-4 py-2.5 text-base text-fg outline-none placeholder:text-fg-muted disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isBusy || !input.trim()}
              aria-label="Enviar"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
