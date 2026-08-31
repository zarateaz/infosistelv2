import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { logoutAction } from "../login/actions";
import { AdminSidebar } from "./AdminSidebar";

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
  // this re-check is defense-in-depth, and is how the sidebar gets the
  // username without a second round trip from every page.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const navLinks = session?.role === "superadmin" ? [...NAV_LINKS, ...SUPERADMIN_NAV_LINKS] : NAV_LINKS;

  return (
    <div className="bg-aurora min-h-screen">
      <AdminSidebar
        navLinks={navLinks}
        username={session?.username as string | undefined}
        logoutAction={logoutAction}
      />
      <main className="px-4 py-8 md:ml-64 md:px-10 md:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
