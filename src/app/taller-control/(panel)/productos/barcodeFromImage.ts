"use client";

/**
 * Lee un código de barras (EAN-13, UPC, Code128...) directamente de una FOTO,
 * en el navegador, con ZXing. Si lo encuentra, la identificación del producto es
 * exacta y no depende de la IA.
 *
 * Prueba varias versiones de la imagen porque las fotos tomadas a mano suelen
 * estar giradas, pequeñas o con reflejos: tamaño original, reducida, girada 90°
 * y en escala de grises con más contraste.
 */
export async function decodeBarcodeFromFile(file: File): Promise<string | null> {
  try {
    const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
      import("@zxing/browser"),
      import("@zxing/library"),
    ]);
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
    ]);
    const reader = new BrowserMultiFormatReader(hints);

    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const variants: { maxDim: number; rotate: boolean; contrast: boolean }[] = [
      { maxDim: 2000, rotate: false, contrast: false },
      { maxDim: 1200, rotate: false, contrast: false },
      { maxDim: 2000, rotate: false, contrast: true },
      { maxDim: 2000, rotate: true, contrast: false },
      { maxDim: 1200, rotate: true, contrast: true },
    ];

    try {
      for (const v of variants) {
        const canvas = drawVariant(bitmap, v.maxDim, v.rotate, v.contrast);
        if (!canvas) continue;
        try {
          const result = reader.decodeFromCanvas(canvas);
          const text = result?.getText()?.trim();
          if (text && /^[0-9A-Za-z-]{6,32}$/.test(text)) return text;
        } catch {
          // NotFoundException → probar la siguiente versión
        }
      }
    } finally {
      bitmap.close();
    }
  } catch {
    // ZXing no disponible / imagen ilegible → se continúa solo con la IA
  }
  return null;
}

function drawVariant(bitmap: ImageBitmap, maxDim: number, rotate: boolean, contrast: boolean) {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = rotate ? h : w;
  canvas.height = rotate ? w : h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  if (contrast) ctx.filter = "grayscale(1) contrast(1.8)";
  if (rotate) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
  } else {
    ctx.drawImage(bitmap, 0, 0, w, h);
  }
  return canvas;
}
