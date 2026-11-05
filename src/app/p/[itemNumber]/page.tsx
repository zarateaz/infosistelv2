import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CategoryIcon } from "@/components/tienda/categoryIcons";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { Check, ShoppingBag, ArrowLeft, ShieldCheck, MapPin, Sparkles } from "lucide-react";

const SITE_URL = "https://infosistel.com.pe";

interface ProductPageProps {
  params: Promise<{ itemNumber: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { itemNumber } = await params;
  const num = parseInt(itemNumber, 10);
  if (isNaN(num)) return { title: "Producto | Infosistel" };

  const product = await prisma.product.findUnique({
    where: { itemNumber: num },
  });

  if (!product) {
    return { title: "Producto no encontrado | Infosistel" };
  }

  const priceText = product.onSale && product.salePrice
    ? `S/. ${product.salePrice.toFixed(2)} (Oferta)`
    : `S/. ${product.price.toFixed(2)}`;

  const title = `${product.name} — ${priceText} | Infosistel`;
  const description = `${product.category} · ${
    product.stock > 0 ? `En stock (${product.stock} u. disponibles)` : "Consultar stock"
  }. Infosistel Huancayo. Pedidos al WhatsApp +51 964 648 202.`;

  const imageUrl = product.image
    ? product.image.startsWith("http")
      ? product.image
      : `${SITE_URL}${product.image}`
    : `${SITE_URL}/og-image.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/p/${product.itemNumber}`,
      siteName: "Infosistel",
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 800,
          alt: product.name,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function PublicProductPage({ params }: ProductPageProps) {
  const { itemNumber } = await params;
  const num = parseInt(itemNumber, 10);
  if (isNaN(num)) notFound();

  const product = await prisma.product.findUnique({
    where: { itemNumber: num },
  });

  if (!product) notFound();

  const currentPrice = product.onSale && product.salePrice ? product.salePrice : product.price;
  const waMessage = `Hola Infosistel! Vi este producto en su catálogo y deseo adquirirlo: *#${product.itemNumber} - ${product.name}* (Precio: S/. ${currentPrice.toFixed(2)}). ¿Tienen disponibilidad?`;
  const waUrl = `https://wa.me/51964648202?text=${encodeURIComponent(waMessage)}`;

  return (
    <div className="min-h-screen bg-bg pb-20 pt-24 text-fg">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Barra superior de retorno */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/tienda"
            className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-bg-surface px-3.5 py-2 text-xs font-bold text-fg-muted transition-colors hover:text-fg hover:bg-bg-alt shadow-sm"
          >
            <ArrowLeft size={14} />
            <span>Ver todo el catálogo</span>
          </Link>

          <span className="font-mono text-xs font-bold text-fg-muted">
            Ítem #{product.itemNumber}
          </span>
        </div>

        {/* Ficha principal */}
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-bg-surface shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Foto del producto */}
            <div className="relative aspect-square w-full bg-bg-alt/60 p-6 flex items-center justify-center border-b md:border-b-0 md:border-r border-border/60">
              {product.image ? (
                <div className="relative h-full w-full">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-contain p-4"
                    priority
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-fg-muted opacity-40">
                  <CategoryIcon category={product.category} size={72} strokeWidth={1.5} />
                  <span className="mt-2 text-sm font-semibold">Sin imagen</span>
                </div>
              )}

              {/* Badge de stock */}
              <div className="absolute left-4 top-4">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold uppercase shadow-sm text-white ${
                    product.stock === 0
                      ? "bg-red-600"
                      : product.stock <= 3
                      ? "bg-amber-500"
                      : "bg-emerald-600"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-white" />
                  {product.stock === 0 ? "Agotado" : `${product.stock} disponibles`}
                </span>
              </div>
            </div>

            {/* Detalles y llamada a la acción */}
            <div className="flex flex-col justify-between p-6 sm:p-8 space-y-6">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-accent">
                  <CategoryIcon category={product.category} size={14} />
                  {product.category}
                </span>

                <h1 className="mt-2 font-display text-2xl sm:text-3xl font-black text-fg leading-tight">
                  {product.name}
                </h1>

                {/* Precios */}
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="font-display text-3xl sm:text-4xl font-black text-fg">
                    S/. {currentPrice.toFixed(2)}
                  </span>
                  {product.onSale && product.salePrice && (
                    <span className="text-sm font-bold text-fg-muted line-through">
                      S/. {product.price.toFixed(2)}
                    </span>
                  )}
                  {product.onSale && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-600">
                      <Sparkles size={12} /> ¡OFERTA!
                    </span>
                  )}
                </div>

                {product.description && (
                  <div className="mt-5 border-t border-border/50 pt-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-fg-muted">
                      Descripción del producto
                    </h3>
                    <p className="mt-2 text-sm text-fg-muted leading-relaxed whitespace-pre-line">
                      {product.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Acciones de compra */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] px-5 py-4 text-sm font-black text-white shadow-lg shadow-[#25D366]/30 transition-all hover:brightness-105 active:scale-98"
                >
                  <WhatsAppIcon size={20} />
                  <span>Pedir o Consultar por WhatsApp</span>
                </a>

                <Link
                  href={`/tienda?p=${product.itemNumber}`}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border/80 bg-bg-surface px-5 py-3 text-sm font-bold text-fg transition-colors hover:bg-bg-alt shadow-sm"
                >
                  <ShoppingBag size={16} />
                  <span>Ver en Tienda Web con Carrito</span>
                </Link>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-fg-muted font-medium">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck size={13} className="text-emerald-500" /> Garantía Infosistel
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} className="text-accent" /> Huancayo, Junín
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
