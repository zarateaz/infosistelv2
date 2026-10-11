"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MessageCircle, X, ArrowUp, Sparkles } from "lucide-react";
import "@/app/taller-control/login/halloween.css";
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
      ? `¡Hola de nuevo! 👋 Es un honor tenerte de vuelta en INFOSISTEL. ¿Deseas seguir explorando nuestras opciones de ${lastCategory.toLowerCase()} o te gustaría que te ayude con algo completamente nuevo? Estoy a tu entera disposición.`
      : "¡Hola de nuevo! 👋 Qué gusto verte por aquí. En INFOSISTEL estamos listos para brindarte la mejor tecnología y servicio. ¿En qué te puedo asesorar el día de hoy?"
    : "¡Hola y muy bienvenido a INFOSISTEL! 👋 Nos enorgullece ofrecerte la mejor tecnología, equipos y servicio técnico en todo Huancayo. ¿En qué te podemos ayudar hoy? Ya sea buscar el equipo perfecto o reparar uno, estoy aquí para guiarte paso a paso de la manera más amable.";
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
      // no crítico
    }
    const t = setTimeout(() => setIsOpen(true), 1500);
    return () => clearTimeout(t);
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
        className="fixed right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-[0_8px_30px_rgba(79,70,229,0.3)] transition-all hover:scale-105 hover:shadow-[0_8px_30px_rgba(79,70,229,0.5)] active:scale-95"
        aria-label="Abrir asistente"
      >
        {showPulse && !isOpen && (
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-blue-500/60" />
        )}
        {isOpen ? <X size={22} /> : <Sparkles size={22} />}
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
          className="fixed inset-x-3 top-3 bottom-3 z-50 flex flex-col overflow-hidden rounded-3xl border border-blue-100 bg-white/95 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(37,99,235,0.25)] ring-1 ring-black/5 sm:inset-x-auto sm:inset-y-auto sm:bottom-24 sm:right-6 sm:h-[70dvh] sm:max-h-[560px] sm:w-96"
        >
          {/* Arañas de Halloween que caminan y desaparecen al abrir */}
          <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden rounded-3xl">
            <svg className="absolute left-[10%] -top-10 w-8 h-8 text-black opacity-0 walking-spider" viewBox="0 0 60 60">
              <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none">
                <path d="M24 28 Q12 18 6 24" /><path d="M24 31 Q10 28 4 34" /><path d="M24 34 Q12 38 6 46" /><path d="M25 37 Q16 46 12 54" />
                <path d="M36 28 Q48 18 54 24" /><path d="M36 31 Q50 28 56 34" /><path d="M36 34 Q48 38 54 46" /><path d="M35 37 Q44 46 48 54" />
              </g>
              <ellipse cx="30" cy="38" rx="10" ry="12" fill="currentColor" />
              <path d="M27 34 L33 34 L30 38 L33 42 L27 42 L30 38 Z" fill="#ff5e1a" />
              <circle cx="30" cy="24" r="6.5" fill="currentColor" />
            </svg>
            <svg className="absolute right-[20%] -top-10 w-6 h-6 text-slate-800 opacity-0 walking-spider-delay" viewBox="0 0 60 60">
              <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none">
                <path d="M24 28 Q12 18 6 24" /><path d="M24 31 Q10 28 4 34" /><path d="M24 34 Q12 38 6 46" /><path d="M25 37 Q16 46 12 54" />
                <path d="M36 28 Q48 18 54 24" /><path d="M36 31 Q50 28 56 34" /><path d="M36 34 Q48 38 54 46" /><path d="M35 37 Q44 46 48 54" />
              </g>
              <ellipse cx="30" cy="38" rx="10" ry="12" fill="currentColor" />
              <circle cx="30" cy="24" r="6.5" fill="currentColor" />
            </svg>
          </div>
          <div className="flex shrink-0 items-center gap-4 bg-white px-6 py-4 border-b border-gray-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 shadow-inner">
              <Sparkles size={18} className="text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold tracking-tight text-gray-900">Asistente Infosistel</p>
              <p className="text-xs font-medium text-gray-500">Respuestas en segundos</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 rounded-full"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 bg-slate-50/50">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    message.role === "user"
                      ? "rounded-br-md bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-blue-500/20"
                      : "rounded-bl-md bg-white border border-gray-100 text-gray-700"
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
                    className="rounded-full border border-gray-200 bg-white shadow-sm px-4 py-2 text-xs font-bold text-gray-600 transition-all hover:border-blue-500 hover:text-blue-600 hover:shadow"
                  >
                    {qr.label}
                  </button>
                ))}
              </div>
            )}

            {isBusy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white border border-gray-100 shadow-sm px-5 py-4">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400"
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

          <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-3 border-t border-gray-100 bg-white/95 p-4 backdrop-blur-md">
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
              className="flex-1 rounded-2xl bg-gray-100 border border-transparent px-4 py-3 text-base text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isBusy || !input.trim()}
              aria-label="Enviar"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 transition-all hover:scale-105 hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
