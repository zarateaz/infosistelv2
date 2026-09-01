"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";
import { loginAction, type LoginState } from "./actions";
import { CuriousEyes } from "./CuriousEyes";
import { GalaxyBackground } from "./GalaxyBackground";

const initialState: LoginState = {};

export default function AdminLoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#04070f] px-6 py-12">
      <GalaxyBackground />
      {/* Faint vignette so the galaxy stays legible-dark at the edges even
          on very bright monitors, without flattening the card's contrast. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,transparent_0%,transparent_45%,rgba(4,7,15,0.6)_100%)]" />

      <div className="relative z-10 w-full max-w-4xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Volver al inicio
        </Link>

        <div className="grid overflow-hidden rounded-[var(--radius-lg)] shadow-[0_30px_90px_-20px_rgba(46,163,255,0.45)] md:grid-cols-2">
          {/* Decorative brand panel — fully transparent so the WebGL galaxy
              behind the whole page shows through unobstructed here instead
              of being boxed in; only a soft dark pool right behind the logo
              keeps it legible against a bright pass of the accretion disk. */}
          <div className="relative hidden flex-col items-center justify-center overflow-hidden px-10 py-16 md:flex">
            <div className="pointer-events-none absolute h-80 w-80 rounded-full bg-[radial-gradient(ellipse,rgba(4,7,15,0.6)_0%,transparent_70%)]" />

            <div className="relative w-full max-w-[260px]">
              <Image
                src="/brand/infosistel-logo-v3.png"
                alt="Infosistel"
                width={1366}
                height={166}
                className="h-auto w-full object-contain drop-shadow-[0_0_45px_rgba(46,163,255,0.6)]"
                priority
              />
            </div>
            <p className="relative mt-6 text-xs font-bold uppercase tracking-[0.3em] text-white/70">
              Panel administrativo
            </p>
          </div>

          {/* Form panel — keeps the light frosted glass-panel treatment on
              its own (rather than inherited from a shared parent) so it
              stays fully legible over the dark galaxy on mobile too, where
              the decorative left panel is hidden and this is the whole card. */}
          <div className="glass-panel flex flex-col justify-center px-8 py-12 sm:px-12">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent md:hidden">
              <Lock size={20} strokeWidth={1.75} />
            </div>

            <div className="mb-2">
              <CuriousEyes closed={passwordFocused} />
            </div>

            <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-fg md:mt-0">
              Bienvenido de nuevo
            </h1>
            <p className="mt-1.5 text-sm text-fg-muted">
              Ingresa tus credenciales para continuar. Acceso restringido a personal autorizado.
            </p>

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
                <div className="relative mt-2">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 pr-11 text-sm text-fg outline-none transition-colors focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-fg-muted transition-colors hover:text-fg"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
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
    </div>
  );
}
