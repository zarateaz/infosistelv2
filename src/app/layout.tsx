import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { SiteChrome } from "@/components/SiteChrome";
import "./globals.css";

const display = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://infosistel.com.pe";
const SITE_DESCRIPTION =
  "Diagnóstico honesto, repuestos reales y garantía sobre cada trabajo — reparación y venta de laptops, PC e impresoras en Huancayo, Perú.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "INFOSISTEL — Reparación y venta de tecnología en Huancayo",
    template: "%s — INFOSISTEL",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: SITE_URL,
    siteName: "INFOSISTEL",
    title: "INFOSISTEL — Reparación y venta de tecnología en Huancayo",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "INFOSISTEL — Reparación y venta de tecnología en Huancayo",
    description: SITE_DESCRIPTION,
  },
};

export default async function RootLayout({
  children,
}: LayoutProps<"/">) {
  // Forces the whole app into dynamic rendering, which the nonce-based CSP
  // in src/proxy.ts requires (a statically-built page can't know the
  // per-request nonce). Any component that needs the actual nonce value —
  // e.g. to pass to a <Script nonce=...> — reads it the same way, locally:
  // (await headers()).get("x-nonce").
  await headers();

  return (
    <html
      lang="es"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-fg font-sans">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
