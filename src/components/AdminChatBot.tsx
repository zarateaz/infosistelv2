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
        className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-orange-500 border border-purple-900 shadow-[0_0_20px_rgba(168,85,247,0.6)] transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.8)] active:scale-95"
      >
        {isOpen ? <X size={22} /> : <Ghost size={22} className="animate-bounce drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[100] flex h-[550px] w-[400px] flex-col overflow-hidden rounded-3xl border border-purple-900/50 bg-slate-950 shadow-[0_0_40px_rgba(168,85,247,0.25)] ring-1 ring-black/5">
          {/* Arañas y Bruja de Halloween */}
          <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden rounded-3xl">
            <svg className="absolute left-[10%] -top-10 w-8 h-8 text-black opacity-0 walking-spider" viewBox="0 0 60 60"><g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none"><path d="M24 28 Q12 18 6 24" /><path d="M24 31 Q10 28 4 34" /><path d="M24 34 Q12 38 6 46" /><path d="M25 37 Q16 46 12 54" /><path d="M36 28 Q48 18 54 24" /><path d="M36 31 Q50 28 56 34" /><path d="M36 34 Q48 38 54 46" /><path d="M35 37 Q44 46 48 54" /></g><ellipse cx="30" cy="38" rx="10" ry="12" fill="currentColor" /><path d="M27 34 L33 34 L30 38 L33 42 L27 42 L30 38 Z" fill="#ff5e1a" /><circle cx="30" cy="24" r="6.5" fill="currentColor" /></svg>
            <svg className="absolute right-[20%] -top-10 w-6 h-6 text-slate-800 opacity-0 walking-spider-delay" viewBox="0 0 60 60"><g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none"><path d="M24 28 Q12 18 6 24" /><path d="M24 31 Q10 28 4 34" /><path d="M24 34 Q12 38 6 46" /><path d="M25 37 Q16 46 12 54" /><path d="M36 28 Q48 18 54 24" /><path d="M36 31 Q50 28 56 34" /><path d="M36 34 Q48 38 54 46" /><path d="M35 37 Q44 46 48 54" /></g><ellipse cx="30" cy="38" rx="10" ry="12" fill="currentColor" /><path d="M27 34 L33 34 L30 38 L33 42 L27 42 L30 38 Z" fill="#ff5e1a" /><circle cx="30" cy="24" r="6.5" fill="currentColor" /></svg>
            <BatSVG className="absolute top-12 left-4 w-10 text-black/40 transform -rotate-12 hw-float" />
            <BatSVG className="absolute top-4 right-16 w-8 text-black/40 transform rotate-12 hw-float" style={{ animationDelay: "1s" }} />
          </div>
          <div className="flex shrink-0 items-center justify-between bg-slate-950 px-5 py-4 border-b border-purple-900/50 relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-900/50 text-orange-500 border border-purple-800">
                <Ghost size={16} className="drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]" />
              </div>
              <span className="font-extrabold text-purple-100 tracking-wider uppercase">Cripta Admin</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="rounded-full p-2 text-purple-400 hover:bg-purple-900 hover:text-purple-200 transition-colors">
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-5 bg-slate-900 text-sm relative">
            <Cobweb size={120} className="absolute top-0 left-0 text-purple-900/30" />
            <Cobweb size={90} className="absolute top-0 right-0 text-purple-900/30" flip />
            <HangingSpider length={50} size={24} className="right-6" delay={1.2} />
            {messages.length === 0 && (
              <p className="text-purple-500/80 text-center px-4 leading-relaxed mt-10 italic">
                Escribe un producto, toma una foto o escanea su código de barras para invocar tu stock desde el más allá.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed shadow-lg relative z-10 ${
                    m.role === "user" ? "bg-purple-900 text-purple-50 border border-purple-700 rounded-br-md shadow-purple-900/40" : "bg-slate-800 border border-purple-900/50 text-purple-200 rounded-bl-md"
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
                          return <div key={i} className="mt-2 text-xs font-bold text-orange-500">🛒 Stock descontado en las sombras</div>;
                        }
                        if (part.type === "tool-ajustarStockAdmin") {
                          return <div key={i} className="mt-2 text-xs font-bold text-purple-400">📦 Stock invocado con éxito</div>;
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

          <form onSubmit={handleSubmit} className="flex flex-col border-t border-purple-900/50 bg-slate-950 p-4 gap-3 relative z-10">
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
                className="flex items-center justify-center rounded-xl bg-slate-800 p-2 text-purple-400 hover:bg-slate-700 hover:text-purple-300 transition-colors"
                title="Subir Foto"
              >
                <ImageIcon size={20} />
              </button>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="flex items-center justify-center rounded-xl bg-slate-800 p-2 text-purple-400 hover:bg-slate-700 hover:text-purple-300 transition-colors"
                title="Escanear Código de Barras"
              >
                <Camera size={20} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ej: Descuenta 1 teclado..."
                disabled={isBusy}
                className="flex-1 rounded-2xl border border-transparent bg-slate-900 px-4 py-2.5 text-sm text-purple-100 outline-none transition-all placeholder:text-purple-800 focus:border-purple-600 focus:bg-slate-800 focus:ring-4 focus:ring-purple-900/50 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={(!input.trim() && !selectedImage) || isBusy}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-700 text-white transition-all hover:scale-105 hover:bg-purple-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 shadow-[0_0_10px_rgba(126,34,206,0.5)]"
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
