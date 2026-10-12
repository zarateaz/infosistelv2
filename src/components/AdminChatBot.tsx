"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageCircle, X, ArrowUp, Camera, Image as ImageIcon, Ghost } from "lucide-react";
import { CameraScanner } from "@/app/taller-control/(panel)/productos/CameraScanner";
import { Cobweb, HangingSpider, BatSVG } from "@/app/taller-control/login/SpookyDecor";
import "@/app/taller-control/login/halloween.css";

export function AdminChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const transport = new DefaultChatTransport({
    api: "/api/admin-chat",
  });

  const { messages, sendMessage, status, error } = useChat({
    transport,
  });

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isBusy, error]);

  const onBarcodeDetected = (code: string) => {
    setShowScanner(false);
    sendMessage({ text: `Registra la venta del producto con código de barras: ${code}` });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isBusy) return;

    // Si hay imagen, la enviamos usando files de AI SDK v5, sino enviamos normal
    if (selectedImage) {
      const dt = new DataTransfer();
      dt.items.add(selectedImage);
      sendMessage({
        text: input.trim() || "Procesa este producto.",
        files: dt.files,
      });
      removeImage();
    } else {
      sendMessage({ text: input });
    }

    setInput("");
  };

  return (
    <>
      {/* Botón flotante blanco con temática Halloween */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-white text-orange-500 border-2 border-orange-200/90 shadow-[0_8px_30px_rgba(249,115,22,0.35)] transition-all hover:scale-105 hover:border-orange-400 hover:shadow-[0_12px_35px_rgba(249,115,22,0.45)] active:scale-95"
        title="Asistente Cripta Admin"
      >
        {isOpen ? (
          <X size={22} className="text-slate-700 hover:text-orange-600 transition-colors" />
        ) : (
          <div className="relative flex items-center justify-center">
            <Ghost size={24} className="animate-bounce drop-shadow-[0_2px_8px_rgba(249,115,22,0.6)]" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
            </span>
          </div>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[100] flex h-[550px] w-[400px] flex-col overflow-hidden rounded-3xl border border-orange-200/80 bg-white/95 backdrop-blur-xl shadow-[0_20px_50px_-10px_rgba(249,115,22,0.2),0_10px_30px_rgba(147,51,234,0.12)] ring-1 ring-orange-100">
          {/* Arañas y Murciélagos animados de Halloween */}
          <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden rounded-3xl">
            <svg className="absolute left-[10%] -top-10 w-8 h-8 text-slate-800 opacity-0 walking-spider" viewBox="0 0 60 60">
              <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none">
                <path d="M24 28 Q12 18 6 24" /><path d="M24 31 Q10 28 4 34" /><path d="M24 34 Q12 38 6 46" /><path d="M25 37 Q16 46 12 54" />
                <path d="M36 28 Q48 18 54 24" /><path d="M36 31 Q50 28 56 34" /><path d="M36 34 Q48 38 54 46" /><path d="M35 37 Q44 46 48 54" />
              </g>
              <ellipse cx="30" cy="38" rx="10" ry="12" fill="currentColor" />
              <path d="M27 34 L33 34 L30 38 L33 42 L27 42 L30 38 Z" fill="#ff5e1a" />
              <circle cx="30" cy="24" r="6.5" fill="currentColor" />
            </svg>
            <svg className="absolute right-[20%] -top-10 w-6 h-6 text-slate-700 opacity-0 walking-spider-delay" viewBox="0 0 60 60">
              <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none">
                <path d="M24 28 Q12 18 6 24" /><path d="M24 31 Q10 28 4 34" /><path d="M24 34 Q12 38 6 46" /><path d="M25 37 Q16 46 12 54" />
                <path d="M36 28 Q48 18 54 24" /><path d="M36 31 Q50 28 56 34" /><path d="M36 34 Q48 38 54 46" /><path d="M35 37 Q44 46 48 54" />
              </g>
              <ellipse cx="30" cy="38" rx="10" ry="12" fill="currentColor" />
              <path d="M27 34 L33 34 L30 38 L33 42 L27 42 L30 38 Z" fill="#ff5e1a" />
              <circle cx="30" cy="24" r="6.5" fill="currentColor" />
            </svg>
            <BatSVG className="absolute top-12 left-4 w-9 text-slate-400/40 transform -rotate-12 hw-float" />
            <BatSVG className="absolute top-4 right-16 w-7 text-purple-400/40 transform rotate-12 hw-float" style={{ animationDelay: "1s" }} />
          </div>

          {/* Encabezado blanco con detalles festivos */}
          <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-orange-50/90 via-white to-purple-50/90 px-5 py-4 border-b border-orange-100/90 relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-purple-600 text-white shadow-sm shadow-orange-500/30">
                <Ghost size={18} className="drop-shadow-sm" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-800 text-sm tracking-wide">CRIPTA ADMIN</span>
                  <span className="text-xs">🎃</span>
                </div>
                <p className="text-[11px] font-medium text-slate-400 leading-none mt-0.5">Asistente IA • Halloween Edition</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-2 text-slate-400 hover:bg-orange-100/60 hover:text-orange-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Área de mensajes con fondo blanco luminoso */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-4 bg-gradient-to-b from-white via-orange-50/15 to-white text-sm relative">
            <Cobweb size={130} className="absolute top-0 left-0 text-slate-300 opacity-60" />
            <Cobweb size={100} className="absolute top-0 right-0 text-slate-300 opacity-60" flip />
            <HangingSpider length={50} size={24} className="right-6" delay={1.2} />

            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center px-4 py-10 relative z-10">
                <div className="h-12 w-12 rounded-2xl bg-orange-100/80 text-orange-600 flex items-center justify-center mb-3 shadow-inner">
                  <Ghost size={24} className="animate-bounce" />
                </div>
                <p className="text-slate-700 font-bold text-xs tracking-wide uppercase mb-1">
                  ¿Qué invocamos hoy?
                </p>
                <p className="text-slate-400 text-xs leading-relaxed max-w-[260px]">
                  Escribe un producto, toma una foto o escanea su código de barras para gestionar tu inventario desde el más allá. 🎃👻
                </p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} relative z-10`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed text-sm ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-purple-600 to-orange-500 text-white font-medium rounded-br-xs shadow-sm shadow-orange-500/20"
                      : "bg-white border border-slate-200/80 text-slate-800 rounded-bl-xs shadow-xs"
                  }`}
                >
                  {m.parts.map((part, i) => {
                    if (part.type === "text") return <span key={i} className="whitespace-pre-wrap">{part.text}</span>;
                    if (part.type === "file" && part.mediaType?.startsWith("image/")) {
                      return (
                        <div key={i} className="mb-2">
                          <img src={part.url} alt="Uploaded" className="rounded-lg max-w-full max-h-[200px] object-cover border border-slate-200" />
                        </div>
                      );
                    }
                    if (part.type === "tool-buscarProductoAdmin" || part.type === "tool-registrarVentaAdmin" || part.type === "tool-ajustarStockAdmin") {
                      if (part.state === "output-available") {
                        if (part.type === "tool-registrarVentaAdmin") {
                          return (
                            <div key={i} className="mt-2 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200/80 rounded-xl px-3 py-1.5 flex items-center gap-1.5 shadow-xs">
                              🛒 Stock descontado en las sombras
                            </div>
                          );
                        }
                        if (part.type === "tool-ajustarStockAdmin") {
                          return (
                            <div key={i} className="mt-2 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200/80 rounded-xl px-3 py-1.5 flex items-center gap-1.5 shadow-xs">
                              📦 Stock invocado con éxito
                            </div>
                          );
                        }
                        return (
                          <div key={i} className="mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-xl px-3 py-1.5 flex items-center gap-1.5 shadow-xs">
                            ✅ Búsqueda completada
                          </div>
                        );
                      } else {
                        return (
                          <div key={i} className="mt-2 text-xs font-medium text-orange-600 bg-orange-50/60 rounded-lg px-2.5 py-1 flex items-center gap-1.5 animate-pulse">
                            🔮 Invocando datos...
                          </div>
                        );
                      }
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}

            {isBusy ? (
              <div className="flex items-center gap-2 text-orange-600 font-medium text-xs p-2 relative z-10">
                <Ghost size={14} className="animate-bounce" />
                <span className="animate-pulse">Consultando a los espíritus del almacén...</span>
              </div>
            ) : null}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl p-3 relative z-10">
                Error: {error.message || "Algo salió mal"}
              </div>
            )}
          </div>

          {/* Formulario de entrada blanco y nítido */}
          <form onSubmit={handleSubmit} className="flex flex-col border-t border-orange-100 bg-white p-3.5 gap-2.5 relative z-10">
            {imagePreviewUrl && (
              <div className="relative self-start mb-1 rounded-xl border border-orange-200 p-1 bg-orange-50/50">
                <img src={imagePreviewUrl} alt="Preview" className="h-14 w-14 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-sm transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200/80 transition-all shadow-xs"
                title="Subir Foto"
              >
                <ImageIcon size={18} />
              </button>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200/80 transition-all shadow-xs"
                title="Escanear Código de Barras"
              >
                <Camera size={18} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ej: Descuenta 1 teclado..."
                disabled={isBusy}
                className="flex-1 rounded-xl border border-slate-200/90 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={(!input.trim() && !selectedImage) || isBusy}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-purple-600 text-white transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 shadow-sm shadow-orange-500/25"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </form>
        </div>
      )}

      {showScanner && (
        <CameraScanner onDetected={onBarcodeDetected} onClose={() => setShowScanner(false)} />
      )}
    </>
  );
}
