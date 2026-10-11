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
        className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-cyan-400 border border-cyan-800 shadow-[0_0_15px_rgba(8,145,178,0.5)] transition-transform hover:scale-105"
      >
        {isOpen ? <X size={22} /> : <Ghost size={22} className="animate-bounce" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[100] flex h-[550px] w-[400px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between bg-slate-950 border-b border-cyan-900/50 px-4 py-3 text-cyan-300 relative overflow-hidden">
            <BatSVG className="absolute -top-1 -right-2 w-12 text-slate-800/50 transform rotate-12" />
            <BatSVG className="absolute top-2 left-20 w-8 text-slate-800/50 transform -rotate-12" />
            <div className="flex items-center gap-2 relative z-10">
              <Ghost size={18} className="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
              <span className="font-bold tracking-wider uppercase text-cyan-50">Cripta IA</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:text-gray-200">
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900 text-sm relative">
            <Cobweb size={100} className="absolute top-0 left-0 text-cyan-900/30" />
            <Cobweb size={80} className="absolute top-0 right-0" flip />
            <HangingSpider length={40} size={20} className="right-4" delay={0.5} />
            {messages.length === 0 && (
              <p className="text-cyan-700/80 text-center italic mt-10">
                Escribe un producto, toma una foto o escanea su código de barras para descontar stock o añadir existencias.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 relative z-10 shadow-lg ${
                    m.role === "user" ? "bg-cyan-900 text-cyan-50 border border-cyan-700" : "bg-slate-800 text-cyan-100 border border-cyan-900 whitespace-pre-wrap"
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
                          return <div key={i} className="mt-2 text-xs font-bold text-cyan-400">🛒 Stock descontado en las sombras</div>;
                        }
                        if (part.type === "tool-ajustarStockAdmin") {
                          return <div key={i} className="mt-2 text-xs font-bold text-blue-400">📦 Stock invocado con éxito</div>;
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

          <form onSubmit={handleSubmit} className="flex flex-col border-t border-cyan-900/50 bg-slate-950 p-3 gap-2 relative">
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
                className="flex items-center justify-center rounded-lg bg-slate-800 p-2 text-cyan-500 hover:bg-slate-700 hover:text-cyan-300"
                title="Subir Foto"
              >
                <ImageIcon size={20} />
              </button>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="flex items-center justify-center rounded-lg bg-slate-800 p-2 text-cyan-500 hover:bg-slate-700 hover:text-cyan-300"
                title="Escanear Código de Barras"
              >
                <Camera size={20} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ej: Descuenta 1 teclado..."
                disabled={isBusy}
                className="flex-1 rounded-lg border border-cyan-900 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-500 text-cyan-100 placeholder-cyan-800 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={(!input.trim() && !selectedImage) || isBusy}
                className="rounded-lg bg-cyan-900 px-3 py-2 text-cyan-50 border border-cyan-700 disabled:opacity-50 hover:bg-cyan-800"
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
