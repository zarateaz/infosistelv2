"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  CheckCircle2,
  User,
  KeyRound,
  MessageCircle,
  Mail,
  Hash,
} from "lucide-react";
import {
  loginAction,
  verifyMfaAction,
  requestPasswordResetAction,
  requestEmailOtpAction,
  verifyEmailOtpAndResetAction,
  type LoginState,
  type ForgotPasswordState,
  type EmailOtpRequestState,
  type EmailOtpVerifyState,
} from "./actions";
import { CuriousEyes } from "./CuriousEyes";

const initialState: LoginState = {};
const initialForgotState: ForgotPasswordState = {};
const initialOtpReqState: EmailOtpRequestState = {};
const initialOtpVerifyState: EmailOtpVerifyState = {};

export default function AdminLoginPage() {
  const [loginState, loginFormAction, isLoginPending] = useActionState(loginAction, initialState);
  const [mfaState, mfaFormAction, isMfaPending] = useActionState(verifyMfaAction, initialState);
  const [forgotState, forgotFormAction, isForgotPending] = useActionState(
    requestPasswordResetAction,
    initialForgotState
  );
  const [otpReqState, otpReqAction, isOtpReqPending] = useActionState(
    requestEmailOtpAction,
    initialOtpReqState
  );
  const [otpVerifyState, otpVerifyAction, isOtpVerifyPending] = useActionState(
    verifyEmailOtpAndResetAction,
    initialOtpVerifyState
  );

  const [step, setStep] = useState<"password" | "mfa" | "forgot">("password");
  const [forgotChannel, setForgotChannel] = useState<"email" | "whatsapp">("email");
  const [forgotEmailStep, setForgotEmailStep] = useState<"request" | "verify" | "done">("request");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [lastHandledLoginState, setLastHandledLoginState] = useState<LoginState | null>(null);
  if (loginState !== lastHandledLoginState) {
    setLastHandledLoginState(loginState);
    if (loginState.mfaRequired) setStep("mfa");
  }

  const [lastHandledOtpReq, setLastHandledOtpReq] = useState<EmailOtpRequestState | null>(null);
  if (otpReqState !== lastHandledOtpReq) {
    setLastHandledOtpReq(otpReqState);
    if (otpReqState.otpSent) setForgotEmailStep("verify");
  }

  const [lastHandledOtpVerify, setLastHandledOtpVerify] = useState<EmailOtpVerifyState | null>(null);
  if (otpVerifyState !== lastHandledOtpVerify) {
    setLastHandledOtpVerify(otpVerifyState);
    if (otpVerifyState.resetSuccess) setForgotEmailStep("done");
  }

  const state = step === "mfa" ? mfaState : loginState;
  const formAction = step === "mfa" ? mfaFormAction : loginFormAction;
  const isPending = step === "mfa" ? isMfaPending : isLoginPending;

  return (
    <div className="bg-aurora relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      {/* Subtle architectural engineering grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(#0b1230 1px, transparent 1px), linear-gradient(90deg, #0b1230 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Ambient Infosistel blue corporate glows */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#0a5fdb]/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#2e7ef0]/12 blur-3xl" />

      <div className="relative z-10 w-full max-w-4xl">
        <Link
          href="/"
          className="group mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-fg-muted transition-colors hover:text-accent"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
          Volver al inicio
        </Link>

        <div className="relative grid overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-[0_25px_70px_-15px_rgba(10,45,110,0.18)] backdrop-blur-xl ring-1 ring-[#0a5fdb]/10 md:grid-cols-2">
          {/* Decorative corporate brand panel */}
          <div className="relative hidden flex-col items-center justify-between overflow-hidden border-r border-slate-200/80 bg-gradient-to-br from-[#eaf1ff] via-[#f4f8ff] to-[#dce8ff] px-10 py-14 md:flex">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "linear-gradient(#0a5fdb 1px, transparent 1px), linear-gradient(90deg, #0a5fdb 1px, transparent 1px)",
                backgroundSize: "36px 36px",
              }}
            />
            <div className="pointer-events-none absolute h-72 w-72 rounded-full bg-[#0a5fdb]/15 blur-3xl" />

            <div className="relative flex items-center gap-2 rounded-full border border-[#0a5fdb]/20 bg-white/85 px-4 py-1.5 shadow-sm backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-[#0a5fdb]" />
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0b1230]">
                Consola Corporativa
              </p>
            </div>

            <div className="relative my-auto flex flex-col items-center py-8 text-center">
              <div className="w-full max-w-[260px] transition-transform duration-300 hover:scale-[1.02]">
                <Image
                  src="/brand/infosistel-logo-v3.png"
                  alt="Infosistel"
                  width={1366}
                  height={166}
                  className="h-auto w-full object-contain drop-shadow-[0_12px_28px_rgba(10,95,219,0.18)]"
                  unoptimized
                  priority
                />
              </div>
              <p className="mt-5 max-w-xs text-xs font-medium leading-relaxed text-fg-muted">
                Sistema integral de administración de inventario, facturación electrónica, cotizaciones y servicio técnico.
              </p>
            </div>

            <div className="relative w-full space-y-2 rounded-2xl border border-[#0a5fdb]/15 bg-white/75 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-[#0b1230]">
                <CheckCircle2 size={15} className="shrink-0 text-[#0a5fdb]" />
                <span>Acceso protegido y auditado</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-[#0b1230]">
                <CheckCircle2 size={15} className="shrink-0 text-[#0a5fdb]" />
                <span>Gestión en tiempo real — INFOSISTEL</span>
              </div>
            </div>
          </div>

          {/* Form panel */}
          <div className="relative flex flex-col justify-center bg-white px-8 py-12 sm:px-12">
            {/* Top accent bar */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0a5fdb] via-[#2e7ef0] to-[#0a5fdb]" />

            <div className="mb-4 flex items-center justify-between md:hidden">
              <Image
                src="/brand/infosistel-logo-v3.png"
                alt="Infosistel"
                width={1366}
                height={166}
                className="h-6 w-auto object-contain"
                unoptimized
                priority
              />
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf1ff] text-[#0a5fdb]">
                <Lock size={18} strokeWidth={2} />
              </div>
            </div>

            <div className="mb-5">
              <CuriousEyes closed={passwordFocused && !showPassword} />
            </div>

            <div className="text-center md:text-left">
              <h1 className="font-display text-2xl font-bold tracking-tight text-[#0b1230] sm:text-3xl">
                {step === "mfa"
                  ? "Verificación en dos pasos"
                  : step === "forgot"
                  ? "Recuperar contraseña"
                  : "Panel Administrativo"}
              </h1>
              <p className="mt-1.5 text-sm text-fg-muted">
                {step === "mfa"
                  ? "Ingresa el código de 6 dígitos de tu aplicación de autenticación."
                  : step === "forgot"
                  ? forgotChannel === "email"
                    ? "Recibe un código OTP de 6 dígitos en tu correo registrado."
                    : "Solicita un restablecimiento seguro al Superadministrador."
                  : "Ingresa tus credenciales autorizadas para continuar."}
              </p>
            </div>

            {step === "forgot" ? (
              <div className="mt-6 space-y-4">
                {/* Selector de canal de recuperación */}
                <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1">
                  <button
                    type="button"
                    onClick={() => setForgotChannel("email")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
                      forgotChannel === "email"
                        ? "bg-white text-[#0a5fdb] shadow-xs"
                        : "text-slate-600 hover:text-[#0b1230]"
                    }`}
                  >
                    <Mail size={14} />
                    <span>Código OTP (Correo)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotChannel("whatsapp")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
                      forgotChannel === "whatsapp"
                        ? "bg-white text-emerald-700 shadow-xs"
                        : "text-slate-600 hover:text-[#0b1230]"
                    }`}
                  >
                    <MessageCircle size={14} />
                    <span>Supervisor (WhatsApp)</span>
                  </button>
                </div>

                {forgotChannel === "email" ? (
                  forgotEmailStep === "done" ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 text-sm text-emerald-950">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                          <div>
                            <p className="font-bold">¡Contraseña restablecida con éxito!</p>
                            <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                              Tu nueva contraseña ya está activa y las sesiones anteriores fueron cerradas. Ya puedes iniciar sesión.
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmailStep("request");
                          setStep("password");
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a5fdb] py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_-6px_rgba(10,95,219,0.45)] transition-colors hover:bg-[#084bb5]"
                      >
                        Ir al inicio de sesión
                      </button>
                    </div>
                  ) : forgotEmailStep === "verify" ? (
                    <form action={otpVerifyAction} className="space-y-4">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs leading-relaxed text-emerald-900">
                        <p className="font-bold">
                          Paso 2 de 2 — Código enviado
                          {otpReqState.maskedEmail ? ` a ${otpReqState.maskedEmail}` : ""}
                        </p>
                        <p className="mt-0.5">
                          Revisa tu bandeja de entrada o spam. El código de 6 dígitos vence en 10 minutos.
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="otp-verify-identifier"
                          className="block text-xs font-bold uppercase tracking-wider text-[#0b1230]"
                        >
                          Usuario o correo electrónico
                        </label>
                        <input
                          id="otp-verify-identifier"
                          name="identifier"
                          type="text"
                          required
                          minLength={2}
                          maxLength={150}
                          defaultValue={otpReqState.identifier ?? ""}
                          placeholder="usuario o correo@ejemplo.com"
                          className="mt-1.5 w-full rounded-xl border-2 border-slate-300 bg-[#f8fafc] px-4 py-2.5 text-sm font-medium text-[#0b1230] placeholder-slate-400 outline-none focus:border-[#0a5fdb] focus:bg-white focus:ring-4 focus:ring-[#0a5fdb]/15"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="otp-code"
                          className="block text-xs font-bold uppercase tracking-wider text-[#0b1230]"
                        >
                          Código OTP (6 dígitos)
                        </label>
                        <div className="relative mt-1.5">
                          <Hash
                            size={16}
                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0a5fdb]"
                          />
                          <input
                            id="otp-code"
                            name="otp"
                            type="text"
                            inputMode="numeric"
                            pattern="\d{6}"
                            maxLength={6}
                            required
                            autoFocus
                            placeholder="123456"
                            className="w-full rounded-xl border-2 border-slate-300 bg-[#f8fafc] px-4 py-3 pl-10 font-mono text-base font-black tracking-[0.25em] text-[#0b1230] placeholder-slate-400 outline-none focus:border-[#0a5fdb] focus:bg-white focus:ring-4 focus:ring-[#0a5fdb]/15"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="otp-new-pw"
                          className="block text-xs font-bold uppercase tracking-wider text-[#0b1230]"
                        >
                          Nueva contraseña (mín. 12 caracteres)
                        </label>
                        <div className="relative mt-1.5">
                          <Lock
                            size={16}
                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                          <input
                            id="otp-new-pw"
                            name="newPassword"
                            type={showNewPassword ? "text" : "password"}
                            minLength={12}
                            maxLength={256}
                            required
                            placeholder="Mínimo 12 caracteres"
                            className="w-full rounded-xl border-2 border-slate-300 bg-[#f8fafc] px-4 py-2.5 pl-10 pr-11 text-sm font-medium text-[#0b1230] placeholder-slate-400 outline-none focus:border-[#0a5fdb] focus:bg-white focus:ring-4 focus:ring-[#0a5fdb]/15"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword((v) => !v)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0a5fdb]"
                          >
                            {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="otp-confirm-pw"
                          className="block text-xs font-bold uppercase tracking-wider text-[#0b1230]"
                        >
                          Confirmar nueva contraseña
                        </label>
                        <input
                          id="otp-confirm-pw"
                          name="confirmPassword"
                          type={showNewPassword ? "text" : "password"}
                          minLength={12}
                          maxLength={256}
                          required
                          placeholder="Repite tu nueva contraseña"
                          className="mt-1.5 w-full rounded-xl border-2 border-slate-300 bg-[#f8fafc] px-4 py-2.5 text-sm font-medium text-[#0b1230] placeholder-slate-400 outline-none focus:border-[#0a5fdb] focus:bg-white focus:ring-4 focus:ring-[#0a5fdb]/15"
                        />
                      </div>

                      {otpVerifyState.error && (
                        <div
                          role="alert"
                          className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700"
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" />
                          <p>{otpVerifyState.error}</p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isOtpVerifyPending}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a5fdb] py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_-6px_rgba(10,95,219,0.45)] transition-colors hover:bg-[#084bb5] disabled:opacity-60"
                      >
                        <KeyRound size={16} />
                        <span>{isOtpVerifyPending ? "Verificando código..." : "Cambiar contraseña"}</span>
                      </button>

                      <div className="flex items-center justify-between text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setForgotEmailStep("request")}
                          className="text-fg-muted hover:text-[#0a5fdb]"
                        >
                          ← Pedir otro código
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep("password")}
                          className="text-fg-muted hover:text-[#0a5fdb]"
                        >
                          Volver al login
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form action={otpReqAction} className="space-y-4">
                      <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 p-3.5 text-xs leading-relaxed text-slate-700">
                        <strong>Paso 1 de 2:</strong> Escribe tu usuario o tu correo electrónico
                        registrado en <strong>Usuarios</strong>. Te enviaremos un código OTP de 6 dígitos.
                      </div>

                      <div>
                        <label
                          htmlFor="otp-identifier"
                          className="block text-xs font-bold uppercase tracking-wider text-[#0b1230]"
                        >
                          Usuario o correo electrónico
                        </label>
                        <div className="relative mt-2">
                          <Mail
                            size={17}
                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                          <input
                            id="otp-identifier"
                            name="identifier"
                            type="text"
                            required
                            minLength={2}
                            maxLength={150}
                            autoFocus
                            defaultValue={otpReqState.identifier ?? ""}
                            placeholder="usuario o correo@ejemplo.com"
                            className="w-full rounded-xl border-2 border-slate-300 bg-[#f8fafc] px-4 py-3 pl-10 text-sm font-medium text-[#0b1230] placeholder-slate-400 outline-none focus:border-[#0a5fdb] focus:bg-white focus:ring-4 focus:ring-[#0a5fdb]/15"
                          />
                        </div>
                      </div>

                      {otpReqState.error && (
                        <div
                          role="alert"
                          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700"
                        >
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-600" />
                          <p>{otpReqState.error}</p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isOtpReqPending}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a5fdb] py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_-6px_rgba(10,95,219,0.45)] transition-colors hover:bg-[#084bb5] disabled:opacity-60"
                      >
                        <Mail size={16} />
                        <span>{isOtpReqPending ? "Enviando código OTP..." : "Enviar código OTP al correo"}</span>
                      </button>

                      <div className="flex items-center justify-between pt-1 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setForgotEmailStep("verify")}
                          className="text-[#0a5fdb] hover:underline"
                        >
                          Ya tengo un código de 6 dígitos →
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep("password")}
                          className="text-fg-muted hover:text-[#0a5fdb]"
                        >
                          ← Volver al login
                        </button>
                      </div>
                    </form>
                  )
                ) : forgotState.sent ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 text-sm text-emerald-950">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                        <div>
                          <p className="font-bold">Solicitud registrada en el sistema</p>
                          <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                            Tu petición para el usuario{" "}
                            <span className="font-mono font-bold">{forgotState.requestedUsername}</span>{" "}
                            quedó registrada en la auditoría. Envíala ahora por WhatsApp al Supervisor
                            para que te asigne una nueva contraseña temporal desde{" "}
                            <strong>Usuarios</strong>.
                          </p>
                        </div>
                      </div>
                    </div>

                    {forgotState.whatsappUrl && (
                      <a
                        href={forgotState.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition-colors hover:bg-emerald-700"
                      >
                        <MessageCircle size={18} />
                        <span>Solicitar clave por WhatsApp</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => setStep("password")}
                      className="w-full pt-1 text-center text-xs font-bold uppercase tracking-wider text-fg-muted transition-colors hover:text-[#0a5fdb]"
                    >
                      ← Volver al inicio de sesión
                    </button>
                  </div>
                ) : (
                  <form action={forgotFormAction} className="space-y-4">
                    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 text-xs leading-relaxed text-slate-700">
                      Si aún no tienes correo asignado, registra tu solicitud y avisa por WhatsApp
                      al <strong>Superadministrador</strong> para que te cambie la clave.
                    </div>

                    <div>
                      <label
                        htmlFor="forgot-username"
                        className="block text-xs font-bold uppercase tracking-wider text-[#0b1230]"
                      >
                        Tu nombre de usuario
                      </label>
                      <div className="relative mt-2">
                        <User
                          size={17}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          id="forgot-username"
                          name="username"
                          type="text"
                          required
                          minLength={2}
                          maxLength={64}
                          autoFocus
                          placeholder="Ej. vendedor1"
                          className="w-full rounded-xl border-2 border-slate-300 bg-[#f8fafc] px-4 py-3 pl-10 text-sm font-medium text-[#0b1230] placeholder-slate-400 outline-none focus:border-[#0a5fdb] focus:bg-white focus:ring-4 focus:ring-[#0a5fdb]/15"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="forgot-note"
                        className="block text-xs font-bold uppercase tracking-wider text-[#0b1230]"
                      >
                        Teléfono o nota (opcional)
                      </label>
                      <input
                        id="forgot-note"
                        name="note"
                        type="text"
                        maxLength={150}
                        placeholder="Ej. Cel. 999 888 777 — turno mañana"
                        className="mt-2 w-full rounded-xl border-2 border-slate-300 bg-[#f8fafc] px-4 py-2.5 text-sm font-medium text-[#0b1230] placeholder-slate-400 outline-none focus:border-[#0a5fdb] focus:bg-white focus:ring-4 focus:ring-[#0a5fdb]/15"
                      />
                    </div>

                    {forgotState.error && (
                      <div
                        role="alert"
                        className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700"
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" />
                        <p>{forgotState.error}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isForgotPending}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition-colors hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <KeyRound size={16} />
                      <span>{isForgotPending ? "Registrando..." : "Solicitar al Supervisor"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStep("password")}
                      className="w-full pt-1 text-center text-xs font-bold uppercase tracking-wider text-fg-muted transition-colors hover:text-[#0a5fdb]"
                    >
                      ← Volver al inicio de sesión
                    </button>
                  </form>
                )}
              </div>
            ) : step === "mfa" ? (
              <form action={formAction} className="mt-7 space-y-4">
                <div>
                  <label htmlFor="code" className="block text-xs font-bold uppercase tracking-wider text-[#0b1230]">
                    Código de seguridad
                  </label>
                  <div className="relative mt-2">
                    <ShieldCheck
                      size={18}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0a5fdb]"
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
                      className="w-full rounded-xl border-2 border-slate-300 bg-[#f8fafc] px-4 py-3 pl-11 text-sm font-semibold tracking-widest text-[#0b1230] placeholder-slate-400 outline-none transition-all duration-200 focus:border-[#0a5fdb] focus:bg-white focus:ring-4 focus:ring-[#0a5fdb]/15"
                    />
                  </div>
                </div>

                {state.error && (
                  <div
                    role="alert"
                    className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" />
                    <p>{state.error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a5fdb] py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_-6px_rgba(10,95,219,0.45)] transition-all duration-200 hover:bg-[#084bb5] active:scale-[0.99] disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span>Verificando...</span>
                    </>
                  ) : (
                    <span>Confirmar acceso</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep("password")}
                  className="w-full text-center text-xs font-bold uppercase tracking-wider text-fg-muted transition-colors hover:text-[#0a5fdb]"
                >
                  ← Volver al inicio de sesión
                </button>
              </form>
            ) : (
              <form action={formAction} className="mt-7 space-y-4">
                <div>
                  <label htmlFor="username" className="block text-xs font-bold uppercase tracking-wider text-[#0b1230]">
                    Usuario
                  </label>
                  <div className="relative mt-2">
                    <User
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required
                      placeholder="Ingresa tu usuario"
                      className="w-full rounded-xl border-2 border-slate-300 bg-[#f8fafc] px-4 py-3 pl-10 text-sm font-medium text-[#0b1230] placeholder-slate-400 outline-none transition-all duration-200 focus:border-[#0a5fdb] focus:bg-white focus:ring-4 focus:ring-[#0a5fdb]/15"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-[#0b1230]">
                      Contraseña
                    </label>
                    <button
                      type="button"
                      onClick={() => setStep("forgot")}
                      className="text-xs font-bold text-[#0a5fdb] transition-colors hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative mt-2">
                    <Lock
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      placeholder="••••••••••••"
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      className="w-full rounded-xl border-2 border-slate-300 bg-[#f8fafc] px-4 py-3 pl-10 pr-11 text-sm font-medium text-[#0b1230] placeholder-slate-400 outline-none transition-all duration-200 focus:border-[#0a5fdb] focus:bg-white focus:ring-4 focus:ring-[#0a5fdb]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-[#0a5fdb]"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {state.error && (
                  <div
                    role="alert"
                    className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" />
                    <p>{state.error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a5fdb] py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_-6px_rgba(10,95,219,0.45)] transition-all duration-200 hover:bg-[#084bb5] active:scale-[0.99] disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span>Verificando credenciales...</span>
                    </>
                  ) : (
                    <span>Iniciar sesión</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
