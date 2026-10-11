"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageCircle, X, ArrowUp, Camera, Image as ImageIcon, Sparkles } from "lucide-react";
import { CameraScanner } from "@/app/taller-control/(panel)/productos/CameraScanner";

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
    
    // Si hay imagen, la enviamos usando `files` de AI SDK v5, sino enviamos normal
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
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-[0_8px_30px_rgba(79,70,229,0.4)] transition-all hover:scale-105 hover:shadow-[0_8px_30px_rgba(79,70,229,0.6)] active:scale-95"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[100] flex h-[550px] w-[400px] flex-col overflow-hidden rounded-3xl border border-indigo-100 bg-white/95 shadow-[0_20px_60px_-15px_rgba(79,70,229,0.25)] ring-1 ring-black/5">
          {/* Arañas de Halloween */}
          <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden rounded-3xl">
            <svg className="absolute left-[15%] -top-10 w-8 h-8 text-black opacity-0 walking-spider" viewBox="0 0 60 60">
              <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none">
                <path d="M24 28 Q12 18 6 24" /><path d="M24 31 Q10 28 4 34" /><path d="M24 34 Q12 38 6 46" /><path d="M25 37 Q16 46 12 54" />
                <path d="M36 28 Q48 18 54 24" /><path d="M36 31 Q50 28 56 34" /><path d="M36 34 Q48 38 54 46" /><path d="M35 37 Q44 46 48 54" />
              </g>
              <ellipse cx="30" cy="38" rx="10" ry="12" fill="currentColor" />
              <path d="M27 34 L33 34 L30 38 L33 42 L27 42 L30 38 Z" fill="#ff5e1a" />
              <circle cx="30" cy="24" r="6.5" fill="currentColor" />
            </svg>
            <svg className="absolute right-[25%] -top-10 w-6 h-6 text-slate-800 opacity-0 walking-spider-delay" viewBox="0 0 60 60">
              <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none">
                <path d="M24 28 Q12 18 6 24" /><path d="M24 31 Q10 28 4 34" /><path d="M24 34 Q12 38 6 46" /><path d="M25 37 Q16 46 12 54" />
                <path d="M36 28 Q48 18 54 24" /><path d="M36 31 Q50 28 56 34" /><path d="M36 34 Q48 38 54 46" /><path d="M35 37 Q44 46 48 54" />
              </g>
              <ellipse cx="30" cy="38" rx="10" ry="12" fill="currentColor" />
              <circle cx="30" cy="24" r="6.5" fill="currentColor" />
            </svg>
          </div>
          <div className="flex shrink-0 items-center justify-between bg-white/95 px-5 py-4 border-b border-gray-100 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Sparkles size={16} />
              </div>
              <span className="font-extrabold text-gray-900 tracking-tight">Asistente IA</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50 text-sm">
            {messages.length === 0 && (
              <p className="text-gray-500 text-center px-4 leading-relaxed mt-4">
                Escribe un producto, toma una foto o escanea su código de barras para gestionar tu stock de manera inteligente.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed shadow-sm ${
                    m.role === "user" ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-md shadow-blue-500/20" : "bg-white border border-gray-100 text-gray-700 rounded-bl-md"
                  }`}
                >
                  {m.parts.map((part, i) => {
                    if (part.type === "text") return <span key={i}>{part.text}</span>;
                    if (part.type === "file" && part.mediaType?.startsWith("image/")) {
                      return (
                        <div key={i} className="mb-2">
                          <img src={part.url} alt="Uploaded" className="rounded-md max-w-full max-h-[200px] object-cover" />
                        </div>
                      );
                    }
                    if (part.type === "tool-buscarProductoAdmin" || part.type === "tool-registrarVentaAdmin" || part.type === "tool-ajustarStockAdmin") {
                      if (part.state === "output-available") {
                        if (part.type === "tool-registrarVentaAdmin") {
                          return <div key={i} className="mt-2 text-xs font-bold text-green-700">🛒 Stock descontado con éxito</div>;
                        }
                        if (part.type === "tool-ajustarStockAdmin") {
                          return <div key={i} className="mt-2 text-xs font-bold text-blue-700">📦 Stock añadido con éxito</div>;
                        }
                        return <div key={i} className="mt-2 text-xs opacity-80">✅ Búsqueda completada</div>;
                      } else {
                        return <div key={i} className="mt-2 text-xs opacity-70 animate-pulse">Trabajando...</div>;
                      }
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}
            {isBusy ? (
              <div className="flex items-center gap-1.5 text-gray-400 p-2">
                <span className="animate-pulse">Escribiendo...</span>
              </div>
            ) : null}
            {error && (
              <div className="text-red-500 text-xs p-2">Error: {error.message || "Algo salió mal"}</div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col border-t border-gray-100 bg-white/95 p-4 gap-3 backdrop-blur-md">
            {imagePreviewUrl && (
              <div className="relative self-start mb-2 rounded-lg border border-gray-200 p-1">
                <img src={imagePreviewUrl} alt="Preview" className="h-16 w-16 object-cover rounded" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex gap-2">
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
                className="flex items-center justify-center rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200"
                title="Subir Foto"
              >
                <ImageIcon size={20} />
              </button>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="flex items-center justify-center rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200"
                title="Escanear Código de Barras"
              >
                <Camera size={20} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ej: Descuenta 1 teclado..."
                disabled={isBusy}
                className="flex-1 rounded-2xl border border-transparent bg-gray-100 px-4 py-2.5 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={(!input.trim() && !selectedImage) || isBusy}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
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
