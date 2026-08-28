import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { LogOut } from "lucide-react";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { logoutAction } from "../login/actions";

const NAV_LINKS = [
  { href: "/taller-control", label: "Dashboard" },
  { href: "/taller-control/caja", label: "Caja" },
  { href: "/taller-control/inventario", label: "Inventario" },
  { href: "/taller-control/productos", label: "Productos" },
  { href: "/taller-control/categorias", label: "Categorías" },
  { href: "/taller-control/reparaciones", label: "Reparaciones" },
  { href: "/taller-control/pedidos", label: "Pedidos" },
  { href: "/taller-control/ventas", label: "Ventas" },
];

const SUPERADMIN_NAV_LINKS = [{ href: "/taller-control/usuarios", label: "Usuarios" }];

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already redirects unauthenticated requests to /taller-control/login —
  // this re-check is defense-in-depth, and is how the topbar gets the
  // username without a second round trip from every page.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const navLinks = session?.role === "superadmin" ? [...NAV_LINKS, ...SUPERADMIN_NAV_LINKS] : NAV_LINKS;

  return (
    <div className="bg-aurora min-h-screen">
      <header className="border-b border-border bg-bg-alt/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <Image
            src="/brand/infosistel-logo-v3.png"
            alt="Infosistel"
            width={1366}
            height={166}
            priority
            className="h-7 w-auto shrink-0 object-contain"
          />

          <div className="flex shrink-0 items-center gap-4">
            <span className="hidden text-sm text-fg-muted sm:inline">
              <span className="font-semibold text-fg">{session?.username}</span>
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full border border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-wide text-fg transition-colors hover:border-accent hover:text-accent"
              >
                <LogOut size={14} />
                Salir
              </button>
            </form>
          </div>
        </div>
        {/* Own row, own scroll container — a fixed count of sections would
            fit inline, but this panel keeps growing (started with 3 links,
            now 9), and re-litigating the header layout every time a new
            section is added isn't worth it. Horizontal scroll degrades
            gracefully forever, on any screen width. */}
        <nav className="no-scrollbar flex items-center gap-5 overflow-x-auto border-t border-border px-6 py-2.5">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-xs font-bold uppercase tracking-wide text-fg-muted transition-colors hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}
