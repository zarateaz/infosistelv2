"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function AdminLoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={14} />
          Volver al inicio
        </Link>

        <div className="rounded-[var(--radius-lg)] border border-border bg-bg-alt px-8 py-10 shadow-[0_20px_60px_-15px_rgba(11,18,48,0.12)]">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Lock size={20} strokeWidth={1.75} />
          </div>

          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-fg">
            Panel administrativo
          </h1>
          <p className="mt-1.5 text-sm text-fg-muted">Acceso restringido — solo personal autorizado.</p>

          <form action={formAction} className="mt-8 space-y-4">
            <div>
              <label htmlFor="username" className="text-xs font-bold uppercase tracking-wider text-fg-muted">
                Usuario
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="mt-2 w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-fg outline-none transition-colors focus:border-accent"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-fg-muted">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-2 w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-fg outline-none transition-colors focus:border-accent"
              />
            </div>

            {state.error && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-full bg-accent py-3 text-sm font-bold text-accent-fg transition-opacity disabled:opacity-60"
            >
              {isPending ? "Verificando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
