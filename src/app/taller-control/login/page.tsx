"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { loginAction, verifyMfaAction, type LoginState } from "./actions";
import { CuriousEyes } from "./CuriousEyes";
import { GalaxyBackground } from "./GalaxyBackground";

const initialState: LoginState = {};

export default function AdminLoginPage() {
  const [loginState, loginFormAction, isLoginPending] = useActionState(loginAction, initialState);
  const [mfaState, mfaFormAction, isMfaPending] = useActionState(verifyMfaAction, initialState);
  const [step, setStep] = useState<"password" | "mfa">("password");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Derived-state-during-render, not an effect (React docs' "adjusting
  // state when a prop changes" pattern — a plain useState, not a ref, is
  // the form the lint rules accept for this). useActionState hands back a
  // new object identity each time loginAction resolves, so comparing that
  // identity (not just .mfaRequired) is what lets a second password
  // submission re-enter the MFA step after the user clicked "Volver".
  const [lastHandledLoginState, setLastHandledLoginState] = useState<LoginState | null>(null);
  if (loginState !== lastHandledLoginState) {
    setLastHandledLoginState(loginState);
    if (loginState.mfaRequired) setStep("mfa");
  }

  const state = step === "mfa" ? mfaState : loginState;
  const formAction = step === "mfa" ? mfaFormAction : loginFormAction;
  const isPending = step === "mfa" ? isMfaPending : isLoginPending;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#04070f] px-6 py-12">
      <GalaxyBackground />
      {/* Faint vignette so the galaxy stays legible-dark at the edges even
          on very bright monitors, without flattening the card's contrast. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,transparent_0%,transparent_45%,rgba(4,7,15,0.6)_100%)]" />

      <div className="relative z-10 w-full max-w-4xl">
        <Link
          href="/"
          className="group mb-5 inline-flex items-center gap-2 text-xs font-medium text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
          Volver al inicio
        </Link>

        <div className="relative grid overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#060c1c]/75 shadow-[0_0_80px_-15px_rgba(46,163,255,0.3),0_30px_90px_rgba(0,0,0,0.85)] backdrop-blur-2xl ring-1 ring-white/10 md:grid-cols-2">
          {/* Decorative brand panel */}
          <div className="relative hidden flex-col items-center justify-center overflow-hidden border-r border-cyan-500/10 bg-gradient-to-br from-cyan-950/20 via-transparent to-blue-950/25 px-10 py-16 md:flex">
            <div className="pointer-events-none absolute h-80 w-80 rounded-full bg-[radial-gradient(ellipse,rgba(46,163,255,0.18)_0%,transparent_70%)] blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-[radial-gradient(ellipse,rgba(6,182,212,0.15)_0%,transparent_70%)] blur-3xl" />

            <div className="relative w-full max-w-[260px] transition-transform duration-500 hover:scale-[1.02]">
              <Image
                src="/brand/infosistel-logo-v3.png"
                alt="Infosistel"
                width={1366}
                height={166}
                className="h-auto w-full object-contain drop-shadow-[0_0_40px_rgba(46,163,255,0.7)]"
                priority
              />
            </div>
            
            <div className="relative mt-6 flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-950/30 px-4 py-1.5 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8] animate-pulse" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Panel administrativo
              </p>
            </div>
          </div>

          {/* Form panel */}
          <div className="relative flex flex-col justify-center overflow-hidden bg-gradient-to-b from-[#091226]/85 via-[#060c1d]/90 to-[#040814]/95 px-8 py-12 sm:px-12 backdrop-blur-3xl">
            {/* Ambient cosmic glows */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />

            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-950/50 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.25)] md:hidden">
              <Lock size={20} strokeWidth={1.75} />
            </div>

            <div className="mb-5">
              <CuriousEyes closed={passwordFocused && !showPassword} />
            </div>

            <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {step === "mfa" ? "Verificación en dos pasos" : "Bienvenido de nuevo"}
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              {step === "mfa"
                ? "Ingresa el código de 6 dígitos de tu aplicación de autenticación."
                : "Ingresa tus credenciales para acceder a la consola."}
            </p>

            {step === "mfa" ? (
              <form action={formAction} className="mt-7 space-y-4">
                <div>
                  <label htmlFor="code" className="block text-xs font-medium text-slate-300">
                    Código de seguridad
                  </label>
                  <div className="relative mt-2">
                    <ShieldCheck
                      size={18}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400"
                    />
                    <input
                      id="code"
                      name="code"
                      type="text"
                      inputMode="text"
                      autoComplete="one-time-code"
                      autoFocus
                      required
                      placeholder="123456"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 pl-11 text-sm tracking-widest text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-cyan-400/70 focus:bg-cyan-950/20 focus:shadow-[0_0_20px_rgba(34,211,238,0.25)] focus:ring-1 focus:ring-cyan-400/40"
                    />
                  </div>
                </div>

                {state.error && (
                  <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-2.5 text-xs font-medium text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.25)]">
                    <span className="h-2 w-2 rounded-full bg-red-400 animate-ping" />
                    <p>{state.error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="group relative mt-2 w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-500 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(6,182,212,0.35)] transition-all duration-300 hover:shadow-[0_0_40px_rgba(6,182,212,0.55)] hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
                >
                  <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
                  <span className="relative flex items-center justify-center gap-2">
                    {isPending ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span>Verificando...</span>
                      </>
                    ) : (
                      <span>Confirmar acceso</span>
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep("password")}
                  className="w-full text-center text-xs font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:text-white"
                >
                  ← Volver al login
                </button>
              </form>
            ) : (
              <form action={formAction} className="mt-7 space-y-4">
                <div>
                  <label htmlFor="username" className="block text-xs font-medium text-slate-300">
                    Usuario
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required
                      placeholder="Ingresa tu usuario"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-cyan-400/70 focus:bg-cyan-950/20 focus:shadow-[0_0_20px_rgba(34,211,238,0.25)] focus:ring-1 focus:ring-cyan-400/40"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-slate-300">
                    Contraseña
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      placeholder="••••••••••••"
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 pr-11 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-cyan-400/70 focus:bg-cyan-950/20 focus:shadow-[0_0_20px_rgba(34,211,238,0.25)] focus:ring-1 focus:ring-cyan-400/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-cyan-300"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {state.error && (
                  <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-2.5 text-xs font-medium text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.25)]">
                    <span className="h-2 w-2 rounded-full bg-red-400 animate-ping" />
                    <p>{state.error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="group relative mt-2 w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-500 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(6,182,212,0.35)] transition-all duration-300 hover:shadow-[0_0_40px_rgba(6,182,212,0.55)] hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
                >
                  <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
                  <span className="relative flex items-center justify-center gap-2">
                    {isPending ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span>Verificando credenciales...</span>
                      </>
                    ) : (
                      <span>Ingresar a la consola</span>
                    )}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
