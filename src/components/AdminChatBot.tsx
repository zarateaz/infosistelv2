"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageCircle, X, ArrowUp, Camera, Image as ImageIcon } from "lucide-react";
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
        className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-transform hover:scale-105"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[100] flex h-[550px] w-[400px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between bg-blue-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} />
              <span className="font-bold">Asistente IA - Inventario</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:text-gray-200">
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 text-sm">
            {messages.length === 0 && (
              <p className="text-gray-500 text-center">
                Escribe un producto, toma una foto o escanea su código de barras para descontar stock o añadir existencias.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 ${
                    m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800 whitespace-pre-wrap"
                  }`}
                >
                  {/* Render attachments if any */}
                  {/* @ts-expect-error experimental_attachments type missing */}
                  {m.experimental_attachments?.map((attachment: { url: string }, i: number) => (
                    <div key={`attachment-${i}`} className="mb-2">
                      <img src={attachment.url} alt="Uploaded" className="rounded-md max-w-full max-h-[200px] object-cover" />
                    </div>
                  ))}
                  
                  {m.parts.map((part, i) => {
                    if (part.type === "text") return <span key={i}>{part.text}</span>;
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

          <form onSubmit={handleSubmit} className="flex flex-col border-t border-gray-200 bg-white p-3 gap-2">
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
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 text-black disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={(!input.trim() && !selectedImage) || isBusy}
                className="rounded-lg bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
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
