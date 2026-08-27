import { cookies } from "next/headers";
import { LogOut } from "lucide-react";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { logoutAction } from "./login/actions";

export default async function AdminPage() {
  // proxy.ts already redirects unauthenticated requests to /admin/login —
  // this re-check is defense-in-depth, and is how we get the username to
  // display without a second round trip.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  return (
    <div className="min-h-screen bg-bg px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-fg">
              Panel administrativo
            </h1>
            <p className="mt-1 text-sm text-fg-muted">
              Sesión iniciada como <span className="font-semibold text-fg">{session?.username}</span>
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full border border-border-strong px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-accent hover:text-accent"
            >
              <LogOut size={15} />
              Cerrar sesión
            </button>
          </form>
        </div>

        <div className="mt-10 rounded-[var(--radius-lg)] border border-border bg-bg-alt px-8 py-12 text-center">
          <p className="text-sm text-fg-muted">
            El contenido del panel (catálogo, pedidos, escáner de inventario) llega en la
            siguiente fase. Por ahora esta pantalla confirma que la autenticación funciona.
          </p>
        </div>
      </div>
    </div>
  );
}
