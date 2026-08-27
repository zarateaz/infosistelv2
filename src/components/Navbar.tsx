"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { SocialLinks } from "@/components/SocialLinks";

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
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "border-b border-border bg-bg/85 backdrop-blur-md" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <Link href="/" className="flex items-center">
          <Image
            src="/brand/infosistel-logo.png"
            alt="Infosistel"
            width={1912 * 0.09}
            height={229 * 0.09}
            priority
            className="h-7 w-auto object-contain"
          />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/tienda" className="text-sm font-bold text-fg-muted transition-colors hover:text-fg">
            Tienda
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <SocialLinks className="hidden sm:flex" />
          <Link
            href="/tienda"
            aria-label="Ir a la tienda"
            className="rounded-full p-2 text-fg-muted transition-colors hover:text-accent md:hidden"
          >
            <ShoppingCart size={20} />
          </Link>
          <a
            href="https://wa.me/51964648202"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-border-strong px-5 py-2 text-xs font-bold uppercase tracking-wider text-fg transition-colors hover:border-accent hover:text-accent"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </header>
  );
}
