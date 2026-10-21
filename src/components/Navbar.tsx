"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingCart, X } from "lucide-react";
import { SocialLinks } from "@/components/SocialLinks";

const NAV_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Servicios", href: "/#servicios" },
  { label: "Tienda", href: "/tienda" },
  { label: "Seguimiento", href: "/seguimiento" },
  { label: "Contacto", href: "/#contacto" },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A route change (tapping a link) should always close the mobile menu —
  // adjusted during render (React's documented pattern) instead of an
  // effect, since an effect would leave the menu open for one extra frame.
  const [menuOpenedForPath, setMenuOpenedForPath] = useState(pathname);
  if (pathname !== menuOpenedForPath) {
    setMenuOpenedForPath(pathname);
    if (menuOpen) setMenuOpen(false);
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || menuOpen
          ? "bg-white/95 shadow-[0_4px_24px_rgba(11,18,48,0.06)] backdrop-blur-md text-fg"
          : "bg-white/80 backdrop-blur-md border-b border-slate-200/60 text-fg"
      }`}
    >
      {/* Línea de acento cibernético ultra fina superior */}
      <div className="h-[2px] w-full bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-600" />

      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 md:px-10">
        <Link href="/" className="flex shrink-0 items-center transition-transform hover:scale-105">
          <Image
            src="/brand/infosistel-logo-v3.png"
            alt="Infosistel"
            width={1366}
            height={166}
            priority
            className="h-8 md:h-9 w-auto object-contain"
          />
        </Link>

        {/* Cápsula de navegación flotante elegante con color y contraste */}
        <nav className="hidden items-center gap-1 rounded-full border border-slate-200/80 bg-slate-100/70 p-1 backdrop-blur-md shadow-sm lg:flex">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`relative rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider transition-all duration-200 ${
                  isActive
                    ? "bg-accent text-white shadow-md shadow-accent/25"
                    : "text-slate-700 hover:text-accent hover:bg-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <SocialLinks className="hidden lg:flex" />

          {/* CTA Rápido de Laboratorio */}
          <a
            href="https://wa.me/51964648202?text=Hola%20Infosistel,%20deseo%20una%20consulta%20técnica%20para%20mi%20laptop"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden xl:inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-accent to-blue-600 hover:from-blue-600 hover:to-accent px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-accent/20 transition-all hover:scale-105 active:scale-95"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Laboratorio Express
          </a>

          <Link
            href="/tienda"
            aria-label="Ir a la tienda"
            className="rounded-full p-2 text-fg-muted transition-colors hover:text-accent lg:hidden"
          >
            <ShoppingCart size={20} />
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            className="rounded-full p-2 text-fg transition-colors hover:text-accent lg:hidden"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-border bg-bg-alt px-6 py-4 lg:hidden">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="block rounded-xl px-3 py-3 text-sm font-bold uppercase tracking-wide text-fg-muted transition-colors hover:bg-bg hover:text-fg"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <SocialLinks className="mt-4 justify-center border-t border-border pt-4" />
        </nav>
      )}
    </header>
  );
}
