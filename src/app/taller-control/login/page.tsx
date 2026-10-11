"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { loginAction, verifyMfaAction, type LoginState } from "./actions";
import { CuriousEyes } from "./CuriousEyes";
import { HalloweenBackground } from "./HalloweenBackground";
import { Cobweb, HangingSpider } from "./SpookyDecor";
import "./halloween.css";

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05020a] px-6 py-12">
      <HalloweenBackground />
      {/* Corner cobwebs */}
      <Cobweb className="absolute -left-10 -top-10 opacity-70" size={300} />
      <Cobweb className="absolute -right-10 -top-10 opacity-70" size={300} flip />
      
      {/* Vignette: subtle dark wash behind the card for legibility while keeping the outer cosmos vibrant */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(10,4,20,0.55)_0%,transparent_65%,rgba(5,2,10,0.8)_100%)]" />

      <div className="relative z-10 w-full max-w-4xl hw-float">
        <Link
          href="/"
          className="group mb-5 inline-flex items-center gap-2 text-xs font-medium text-slate-400 transition-colors hover:text-orange-400"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
          Huir al inicio
        </Link>

        <div className="hw-card relative grid overflow-hidden rounded-3xl border border-orange-500/20 bg-[#130722]/85 shadow-[0_0_80px_-15px_rgba(255,110,20,0.3),0_30px_90px_rgba(0,0,0,0.85)] backdrop-blur-2xl ring-1 ring-orange-500/10 md:grid-cols-2">
          {/* Decorative spider dropping in */}
          <HangingSpider className="left-12 -top-2 z-20" length={140} delay={1.5} />
          {/* Decorative brand panel */}
          <div className="relative hidden flex-col items-center justify-center overflow-hidden border-r border-orange-500/10 bg-gradient-to-br from-purple-950/30 via-transparent to-orange-950/20 px-10 py-16 md:flex">
            <Cobweb className="absolute -bottom-12 -left-12 opacity-40" size={200} flipY />
            <div className="pointer-events-none absolute h-80 w-80 rounded-full bg-[radial-gradient(ellipse,rgba(168,85,247,0.15)_0%,transparent_70%)] blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-[radial-gradient(ellipse,rgba(255,110,20,0.12)_0%,transparent_70%)] blur-3xl" />

            <div className="relative w-full max-w-[260px] transition-transform duration-500 hover:scale-[1.02] drop-shadow-[0_0_15px_rgba(255,110,20,0.5)]">
              <Image
                src="/brand/infosistel-logo-v3.png"
                alt="Infosistel"
                width={1366}
                height={166}
                className="h-auto w-full object-contain"
                unoptimized
                priority
              />
            </div>
            
            <div className="relative mt-6 flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-950/40 px-4 py-1.5 backdrop-blur-md shadow-[0_0_15px_rgba(255,110,20,0.2)]">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_#ff7a18] animate-pulse" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-200">
                Cripta Administrativa
              </p>
            </div>
          </div>

          {/* Form panel */}
          <div className="relative flex flex-col justify-center overflow-hidden bg-gradient-to-b from-[#1c0b2b]/90 via-[#11051c]/95 to-[#0a0210]/95 px-8 py-12 sm:px-12 backdrop-blur-3xl">
            {/* Ambient cosmic glows */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-600/10 blur-3xl" />

            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-950/50 text-orange-400 shadow-[0_0_20px_rgba(255,110,20,0.25)] md:hidden">
              <Lock size={20} strokeWidth={1.75} />
            </div>

            <div className="mb-5">
              <CuriousEyes closed={passwordFocused && !showPassword} />
            </div>

            <h1 className="font-display hw-flicker text-3xl font-bold tracking-tight text-orange-50 sm:text-4xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {step === "mfa" ? "Conjuro de verificación" : "Bienvenido al Más Allá"}
            </h1>
            <p className="mt-1.5 text-sm text-purple-200/70">
              {step === "mfa"
                ? "Ingresa el código de 6 dígitos del pergamino mágico de tu aplicación de autenticación."
                : "Invoca tus credenciales para acceder a la cripta."}
            </p>

            {step === "mfa" ? (
              <form action={formAction} className="mt-7 space-y-4">
                <div>
                  <label htmlFor="code" className="block text-xs font-medium text-purple-200/80">
                    Código de seguridad
                  </label>
                  <div className="relative mt-2">
                    <ShieldCheck
                      size={18}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-orange-500"
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
                      className="w-full rounded-xl border border-purple-500/20 bg-purple-950/20 px-4 py-3 pl-11 text-sm tracking-widest text-white placeholder-purple-300/40 outline-none transition-all duration-200 focus:border-orange-500/70 focus:bg-orange-950/20 focus:shadow-[0_0_20px_rgba(255,110,20,0.25)] focus:ring-1 focus:ring-orange-500/40"
                    />
                  </div>
                </div>

                {state.error && (
                  <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-2.5 text-xs font-medium text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.25)]">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                    <p>{state.error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="group relative mt-2 w-full overflow-hidden rounded-xl bg-gradient-to-r from-purple-700 via-orange-600 to-purple-700 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(255,110,20,0.35)] transition-all duration-300 hover:shadow-[0_0_40px_rgba(255,110,20,0.6)] hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
                >
                  <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
                  <span className="relative flex items-center justify-center gap-2">
                    {isPending ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span>Verificando...</span>
                      </>
                    ) : (
                      <span>Romper el sello</span>
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep("password")}
                  className="w-full text-center text-xs font-semibold uppercase tracking-wider text-purple-300/60 transition-colors hover:text-orange-400"
                >
                  ← Volver a las sombras
                </button>
              </form>
            ) : (
              <form action={formAction} className="mt-7 space-y-4">
                <div>
                  <label htmlFor="username" className="block text-xs font-medium text-purple-200/80">
                    Alma (Usuario)
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required
                      placeholder="Ingresa tu nombre"
                      className="w-full rounded-xl border border-purple-500/20 bg-purple-950/20 px-4 py-3 text-sm text-white placeholder-purple-300/40 outline-none transition-all duration-200 focus:border-orange-500/70 focus:bg-orange-950/20 focus:shadow-[0_0_20px_rgba(255,110,20,0.25)] focus:ring-1 focus:ring-orange-500/40"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-purple-200/80">
                    Palabra secreta (Contraseña)
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
                      className="w-full rounded-xl border border-purple-500/20 bg-purple-950/20 px-4 py-3 pr-11 text-sm text-white placeholder-purple-300/40 outline-none transition-all duration-200 focus:border-orange-500/70 focus:bg-orange-950/20 focus:shadow-[0_0_20px_rgba(255,110,20,0.25)] focus:ring-1 focus:ring-orange-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar" : "Mostrar"}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-purple-300/60 transition-colors hover:text-orange-400"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {state.error && (
                  <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-2.5 text-xs font-medium text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.25)]">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                    <p>{state.error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="group relative mt-2 w-full overflow-hidden rounded-xl bg-gradient-to-r from-purple-700 via-orange-600 to-purple-700 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(255,110,20,0.35)] transition-all duration-300 hover:shadow-[0_0_40px_rgba(255,110,20,0.6)] hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
                >
                  <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
                  <div className="hw-drip pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-red-600/80 to-transparent" />
                  <span className="relative flex items-center justify-center gap-2">
                    {isPending ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span>Descifrando pergamino...</span>
                      </>
                    ) : (
                      <span>Abrir el portal</span>
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
