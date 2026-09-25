"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
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

// No hay login de cliente en la tienda, así que "cliente frecuente" se
// resuelve por navegador, no por cuenta — este par de claves en
// localStorage es toda la "memoria" del chatbot sobre un visitante.
const LS_RETURNING_KEY = "infosistel_chat_returning";
const LS_CATEGORIES_KEY = "infosistel_chat_categories";
const MAX_REMEMBERED_CATEGORIES = 5;

interface VisitorMemory {
  returning: boolean;
  recentCategories: string[];
}

function readRecentCategories(): string[] {
  try {
    const raw = localStorage.getItem(LS_CATEGORIES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : [];
  } catch {
    // Modo privado u otro bloqueo de localStorage — se pierde la
    // personalización, nunca la función del chat.
    return [];
  }
}

function loadVisitorMemory(): VisitorMemory {
  try {
    return { returning: localStorage.getItem(LS_RETURNING_KEY) === "1", recentCategories: readRecentCategories() };
  } catch {
    return { returning: false, recentCategories: [] };
  }
}

// Mezcla las categorías vistas en esta conversación con las de visitas
// pasadas — más recientes primero, sin duplicados, capado a un puñado para
// no acumular para siempre.
function rememberCategories(seen: string[]) {
  if (seen.length === 0) return;
  try {
    const merged = [...seen, ...readRecentCategories()]
      .filter((c, i, arr) => arr.indexOf(c) === i)
      .slice(0, MAX_REMEMBERED_CATEGORIES);
    localStorage.setItem(LS_CATEGORIES_KEY, JSON.stringify(merged));
  } catch {
    // ídem — no crítico.
  }
}

// Mensaje sembrado en el cliente, sin llamar a DeepSeek: el chatbot debe
// saludar y presentarse apenas alguien entra a la web, no recién cuando
// escribe algo. Cambia de tono si ya reconoce al visitante.
function buildGreeting(visitor: VisitorMemory): UIMessage {
  const lastCategory = visitor.recentCategories[0];
  const text = visitor.returning
    ? lastCategory
      ? `¡Qué bueno tenerte de vuelta! ¿Sigues buscando algo de ${lastCategory.toLowerCase()}, o te ayudo con otra cosa?`
      : "¡Qué bueno tenerte de vuelta! ¿En qué te ayudo hoy — catálogo, reparación o algo puntual?"
    : "¡Hola! Soy el asistente de INFOSISTEL. Vendemos y reparamos laptops, PCs, impresoras, redes y accesorios en Huancayo. Elige una opción o cuéntame qué buscas.";
  return { id: "infosistel-welcome", role: "assistant", parts: [{ type: "text", text }] };
}

const QUICK_REPLIES = [
  { label: "Laptops y PCs", text: "Quiero ver laptops y PCs" },
  { label: "Impresoras", text: "Quiero ver impresoras" },
  { label: "Redes y Wi-Fi", text: "Necesito algo de redes o Wi-Fi" },
  { label: "Reparar un equipo", text: "Tengo un equipo para reparar" },
];

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  // Se lee una sola vez al montar — el "returning" y las categorías que ve
  // ESTE saludo son el estado de ANTES de esta visita (se marca como visto
  // justo después, en el useEffect de abajo, para que la próxima vez ya
  // cuente como recurrente). Nunca se reasigna — no es el canal por el que
  // esta misma sesión aprende, ver `transport` más abajo para eso.
  const [visitor] = useState<VisitorMemory>(() => loadVisitorMemory());
  const [showPulse, setShowPulse] = useState(() => visitor.returning);
  const [initialMessages] = useState<UIMessage[]>(() => [buildGreeting(visitor)]);

  // Objeto nuevo cada render (barato) — `recentCategories` se relee de
  // localStorage en cada render en vez de guardarse en un estado propio,
  // así el body de la próxima llamada ya refleja lo que esta misma
  // conversación acaba de aprender (ver el useEffect de aprendizaje más
  // abajo) sin duplicar esa fuente de verdad en otro state.
  const transport = new DefaultChatTransport({
    api: "/api/chat",
    body: { visitorContext: { returning: visitor.returning, recentCategories: readRecentCategories() } },
  });

  const { messages, sendMessage, status, error } = useChat({ messages: initialMessages, transport });
  const scrollRef = useRef<HTMLDivElement>(null);

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isBusy, error]);

  // Primera vez en el sitio: el panel se abre solo a los pocos segundos para
  // que el saludo se vea sin que el cliente tenga que buscar el botón —
  // "que al entrar a la web el chatbot te salude". Marca el flag de una vez
  // para que esto no se repita en cada recarga. Visitas siguientes: no se
  // fuerza el panel (no ser invasivo), solo un pulso breve en el botón.
  useEffect(() => {
    try {
      localStorage.setItem(LS_RETURNING_KEY, "1");
    } catch {
      // no crítico — en el peor caso, la próxima visita se trata como si
      // fuera la primera.
    }
    if (visitor.returning) {
      const t = setTimeout(() => setShowPulse(false), 6000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setIsOpen(true), 3500);
    return () => clearTimeout(t);
    // Solo al montar: `visitor.returning` leído aquí es a propósito el
    // valor de ANTES de esta visita (ver useState de `visitor` arriba), no
    // algo a lo que este efecto deba reaccionar si cambiara después.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Aprende" qué categorías le interesan a este visitante a partir de lo
  // que buscarProductos/productosPopulares ya le mostró en esta conversación
  // — se guarda en localStorage y queda disponible para el saludo de la
  // próxima visita, y para `transport` (arriba) en el resto de esta misma,
  // que relee `readRecentCategories()` en cada render.
  useEffect(() => {
    const seen = new Set<string>();
    for (const message of messages) {
      for (const part of message.parts) {
        if (
          (part.type === "tool-buscarProductos" || part.type === "tool-productosPopulares") &&
          part.state === "output-available"
        ) {
          const productos = (part.output as { productos?: ProductoResultado[] } | undefined)?.productos;
          productos?.forEach((p) => seen.add(p.categoria));
        }
      }
    }
    if (seen.size > 0) rememberCategories(Array.from(seen));
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isBusy) return;
    sendMessage({ text: input });
    setInput("");
  };

  const handleQuickReply = (text: string) => {
    if (isBusy) return;
    sendMessage({ text });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen((v) => !v)}
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        className="fixed right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg shadow-accent/30 transition-transform hover:scale-105 active:scale-95"
        aria-label="Abrir asistente"
      >
        {showPulse && !isOpen && (
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-accent/60" />
        )}
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
                    if (
                      (part.type === "tool-buscarProductos" || part.type === "tool-productosPopulares") &&
                      part.state === "output-available"
                    ) {
                      const productos = (part.output as { productos?: ProductoResultado[] } | undefined)
                        ?.productos;
                      return productos ? <ProductResults key={i} productos={productos} /> : null;
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}

            {/* Chips de respuesta rápida bajo el saludo inicial — llevan a
                que el cliente navegue el catálogo con un toque, en vez de
                tener que escribir. Desaparecen apenas empieza la
                conversación real. */}
            {messages.length === 1 && !isBusy && (
              <div className="flex flex-wrap gap-2 pl-1">
                {QUICK_REPLIES.map((qr) => (
                  <button
                    key={qr.label}
                    onClick={() => handleQuickReply(qr.text)}
                    className="rounded-full border border-border bg-bg px-3 py-1.5 text-xs font-bold text-fg transition-colors hover:bg-accent/10 hover:text-accent"
                  >
                    {qr.label}
                  </button>
                ))}
              </div>
            )}

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
