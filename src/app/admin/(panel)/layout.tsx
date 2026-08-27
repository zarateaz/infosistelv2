import Link from "next/link";
import { cookies } from "next/headers";
import { LogOut } from "lucide-react";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { logoutAction } from "../login/actions";

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/pedidos", label: "Pedidos" },
];

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already redirects unauthenticated requests to /admin/login —
  // this re-check is defense-in-depth, and is how the topbar gets the
  // username without a second round trip from every page.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-bg-alt">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <span className="select-none font-display text-lg font-extrabold tracking-tight">
              <span className="text-accent">INFO</span>
              <span className="text-fg">SIS</span>
              <span className="text-accent">TEL</span>
            </span>
            <nav className="hidden items-center gap-6 sm:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-bold text-fg-muted transition-colors hover:text-fg"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
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
        <nav className="flex items-center gap-5 overflow-x-auto border-t border-border px-6 py-2.5 sm:hidden">
          {NAV_LINKS.map((link) => (
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

      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
