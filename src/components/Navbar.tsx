"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";

const NAV_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Servicios", href: "/#servicios" },
  { label: "Tienda", href: "/tienda" },
  { label: "Nosotros", href: "/#nosotros" },
  { label: "Contacto", href: "/#contacto" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-shadow duration-300 ${
        scrolled ? "bg-bg-alt/90 shadow-[0_1px_0_0_var(--border)] backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/brand/infosistel-logo-v2.png"
            alt="Infosistel"
            width={335}
            height={53}
            priority
            className="h-8 w-auto object-contain"
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

        <div className="flex items-center gap-2">
          <Link
            href="/tienda"
            aria-label="Ir a la tienda"
            className="rounded-full p-2 text-fg-muted transition-colors hover:text-accent lg:hidden"
          >
            <ShoppingCart size={20} />
          </Link>
          <Link
            href="/admin/login"
            className="rounded-full border border-accent/40 px-5 py-2 text-xs font-bold uppercase tracking-wider text-accent transition-colors hover:border-accent hover:bg-accent hover:text-accent-fg"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </header>
  );
}
