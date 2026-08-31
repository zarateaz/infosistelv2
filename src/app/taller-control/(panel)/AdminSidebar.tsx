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

// Groups the flat nav list into labeled sections purely for display — the
// actual link list (and its role-based filtering, e.g. Usuarios only for
// superadmin) stays owned by layout.tsx. A link whose href isn't in here
// falls back to "General" so a future addition never silently disappears.
const GROUP_OF: Record<string, string> = {
  "/taller-control": "General",
  "/taller-control/caja": "Ventas",
  "/taller-control/pedidos": "Ventas",
  "/taller-control/ventas": "Ventas",
  "/taller-control/inventario": "Inventario",
  "/taller-control/productos": "Inventario",
  "/taller-control/alta-rapida": "Inventario",
  "/taller-control/categorias": "Inventario",
  "/taller-control/reparaciones": "Servicio técnico",
  "/taller-control/usuarios": "Sistema",
};
const GROUP_ORDER = ["General", "Ventas", "Inventario", "Servicio técnico", "Sistema"];

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

  const groupedLinks = GROUP_ORDER.map((group) => ({
    group,
    links: navLinks.filter((link) => (GROUP_OF[link.href] ?? "General") === group),
  })).filter((g) => g.links.length > 0);

  const NavList = (
    <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-2">
      {groupedLinks.map(({ group, links }, i) => (
        <div key={group} className={i > 0 ? "mt-3" : undefined}>
          <p className="px-3.5 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-fg-muted/60">
            {group}
          </p>
          <div className="flex flex-col gap-1">
            {links.map((link) => {
              const Icon = ICONS[link.href] ?? LayoutDashboard;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    active
                      ? "bg-accent text-accent-fg shadow-[0_4px_16px_-4px_rgba(10,95,219,0.5)]"
                      : "text-fg-muted hover:translate-x-0.5 hover:bg-bg-raised hover:text-fg"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white/70 shadow-[0_0_8px_1px_rgba(255,255,255,0.8)]" />
                  )}
                  <Icon
                    size={18}
                    className={active ? "text-accent-fg" : "text-fg-muted transition-colors group-hover:text-accent"}
                  />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar — sidebar is off-canvas below md */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-bg-alt/90 px-4 py-3 shadow-[0_4px_20px_-8px_rgba(10,30,80,0.15)] backdrop-blur-md md:hidden">
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
          <aside className="admin-sidebar absolute inset-y-0 left-0 flex w-72 flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-5">
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
      <aside className="admin-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 flex-col md:flex">
        <div className="border-b border-border/60 px-5 py-6">
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
    <div className="border-t border-border/60 px-4 py-4">
      <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-bg-raised/80 px-3 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-fg shadow-[0_0_0_3px_rgba(10,95,219,0.15),0_0_12px_-2px_rgba(10,95,219,0.6)]">
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
