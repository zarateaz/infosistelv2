"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  Boxes,
  Package,
  ScanBarcode,
  Tags,
  Wrench,
  ShoppingBag,
  TrendingUp,
  Users,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  "/taller-control": LayoutDashboard,
  "/taller-control/caja": Wallet,
  "/taller-control/inventario": Boxes,
  "/taller-control/productos": Package,
  "/taller-control/alta-rapida": ScanBarcode,
  "/taller-control/categorias": Tags,
  "/taller-control/reparaciones": Wrench,
  "/taller-control/pedidos": ShoppingBag,
  "/taller-control/ventas": TrendingUp,
  "/taller-control/usuarios": Users,
};

type NavLink = { href: string; label: string };

export function AdminSidebar({
  navLinks,
  username,
  logoutAction,
}: {
  navLinks: NavLink[];
  username?: string;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Exact match for the dashboard root; otherwise a prefix match, so
  // /taller-control/productos/abc123 still highlights "Productos".
  const isActive = (href: string) =>
    href === "/taller-control" ? pathname === href : pathname.startsWith(href);

  const NavList = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
      {navLinks.map((link) => {
        const Icon = ICONS[link.href] ?? LayoutDashboard;
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMobileOpen(false)}
            className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-accent text-accent-fg shadow-sm shadow-accent/30"
                : "text-fg-muted hover:bg-bg-raised hover:text-fg"
            }`}
          >
            <Icon
              size={18}
              className={active ? "text-accent-fg" : "text-fg-muted group-hover:text-accent"}
            />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar — sidebar is off-canvas below md */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-bg-alt/90 px-4 py-3 backdrop-blur-md md:hidden">
        <Image
          src="/brand/infosistel-logo-v3.png"
          alt="Infosistel"
          width={1366}
          height={166}
          priority
          className="h-6 w-auto object-contain"
        />
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
          className="rounded-lg border border-border-strong p-2 text-fg transition-colors hover:border-accent hover:text-accent"
        >
          <Menu size={18} />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-fg/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="glass-panel absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-bg-alt shadow-2xl">
            <div className="flex items-center justify-between px-5 py-5">
              <Image
                src="/brand/infosistel-logo-v3.png"
                alt="Infosistel"
                width={1366}
                height={166}
                className="h-6 w-auto object-contain"
              />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
                className="rounded-lg p-1.5 text-fg-muted transition-colors hover:text-fg"
              >
                <X size={18} />
              </button>
            </div>
            {NavList}
            <SidebarFooter username={username} logoutAction={logoutAction} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar — fixed, always visible */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-bg-alt/90 backdrop-blur-md md:flex">
        <div className="px-5 py-6">
          <Image
            src="/brand/infosistel-logo-v3.png"
            alt="Infosistel"
            width={1366}
            height={166}
            priority
            className="h-7 w-auto object-contain"
          />
        </div>
        {NavList}
        <SidebarFooter username={username} logoutAction={logoutAction} />
      </aside>
    </>
  );
}

function SidebarFooter({
  username,
  logoutAction,
}: {
  username?: string;
  logoutAction: () => Promise<void>;
}) {
  return (
    <div className="border-t border-border px-4 py-4">
      <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-bg-raised px-3 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-fg">
          {username?.slice(0, 2).toUpperCase() ?? "?"}
        </div>
        <span className="truncate text-sm font-semibold text-fg">{username}</span>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-wide text-fg transition-colors hover:border-accent hover:text-accent"
        >
          <LogOut size={14} />
          Salir
        </button>
      </form>
    </div>
  );
}
