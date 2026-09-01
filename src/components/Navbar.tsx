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
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

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
      className={`fixed inset-x-0 top-0 z-50 transition-shadow duration-300 ${
        scrolled || menuOpen ? "bg-bg-alt/90 shadow-[0_1px_0_0_var(--border)] backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/brand/infosistel-logo-v3.png"
            alt="Infosistel"
            width={1366}
            height={166}
            priority
            className="h-9 w-auto object-contain"
          />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="group relative py-1 text-xs font-bold uppercase tracking-widest text-fg-muted transition-colors hover:text-fg"
            >
              {link.label}
              <span className="absolute -bottom-0.5 left-0 h-0.5 w-0 rounded-full bg-accent transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <SocialLinks className="hidden lg:flex" />
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
