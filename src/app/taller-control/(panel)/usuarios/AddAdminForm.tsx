"use client";

import { useActionState, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { createAdminUser, type AdminUserFormState } from "./actions";

const initialState: AdminUserFormState = {};
const labelClass = "text-xs font-bold uppercase tracking-wider text-fg-muted";
const inputClass =
  "mt-1.5 w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-fg outline-none focus:border-accent";

export function AddAdminForm() {
  const [state, formAction, isPending] = useActionState(createAdminUser, initialState);
  // Uncontrolled inputs, so a successful create is reflected by remounting
  // the <form> (fresh `key`) rather than resetting each field by hand.
  const [formKey, setFormKey] = useState(0);

  // Adjusting state during render (React's documented pattern for reacting
  // to a prop/state change without an effect) — an effect here would fire
  // one render late and trip the "setState in effect" lint rule.
  const [lastHandledSuccess, setLastHandledSuccess] = useState(state.success);
  if (state.success !== lastHandledSuccess) {
    setLastHandledSuccess(state.success);
    if (state.success) setFormKey((k) => k + 1);
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-bg-alt p-6">
      <h2 className="font-display text-lg font-bold text-fg">Gestión de acceso</h2>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <Lock size={12} className="text-accent" /> Contraseña con scrypt
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-accent" /> Sesión firmada (JWT)
        </span>
      </p>

      <form key={formKey} action={formAction} className="mt-5 space-y-3">
        <div>
          <label className={labelClass} htmlFor="username">
            Usuario
          </label>
          <input id="username" name="username" type="text" required minLength={3} maxLength={64} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={12}
            maxLength={256}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="role">
            Rol
          </label>
          <select id="role" name="role" defaultValue="admin" className={inputClass}>
            <option value="admin">Administrador estándar</option>
            <option value="superadmin">Super administrador</option>
          </select>
        </div>

        {state.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? "Creando..." : "Crear usuario"}
        </button>
      </form>
    </div>
  );
}
