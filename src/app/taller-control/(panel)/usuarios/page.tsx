import { AlertTriangle, CheckCircle2, KeyRound, Mail, User } from "lucide-react";
import { requireSuperAdmin } from "@/lib/requireSuperAdmin";
import {
  getAdminUsers,
  deleteAdminUser,
  getRecentPasswordResetRequests,
  getEmailConfigStatus,
} from "./actions";
import { AddAdminForm } from "./AddAdminForm";
import { DeleteAdminButton } from "./DeleteAdminButton";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { EditEmailButton } from "./EditEmailButton";

export default async function AdminUsersPage() {
  await requireSuperAdmin();
  const [admins, resetRequests, emailStatus] = await Promise.all([
    getAdminUsers(),
    getRecentPasswordResetRequests(),
    getEmailConfigStatus(),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Usuarios</h1>
      <p className="mt-1 text-sm text-fg-muted">{admins.length} cuentas con acceso al panel.</p>

      {/* Estado de envío de OTP por correo (.env) */}
      <div
        className={`mt-5 rounded-2xl border p-4 text-xs ${
          emailStatus.provider === "none"
            ? "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-200"
            : "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
        }`}
      >
        <div className="flex items-start gap-2.5">
          {emailStatus.provider === "none" ? (
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          ) : (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          )}
          <div>
            {emailStatus.provider === "resend" ? (
              <p className="font-bold">
                Envío automático de OTP por correo activo (Resend API). Cada usuario con correo asignado podrá recuperar su clave con un código de 6 dígitos.
              </p>
            ) : emailStatus.provider === "smtp" ? (
              <p className="font-bold">
                Envío automático de OTP por correo activo (Gmail / SMTP). Cada usuario con correo asignado podrá recuperar su clave con un código de 6 dígitos.
              </p>
            ) : (
              <>
                <p className="font-bold">
                  Pendiente activar envío de correo en tu archivo <code className="font-mono">.env</code> del VPS para los códigos OTP de 6 dígitos.
                </p>
                <p className="mt-1 opacity-90">
                  Agrega <strong>Gmail SMTP</strong> (<code>SMTP_USER</code> y <code>SMTP_PASS</code> de contraseña de aplicación) o <strong>Resend</strong> (<code>RESEND_API_KEY</code>) en tu <code>.env</code> y reinicia PM2.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <AddAdminForm />

        <div className="admin-glass rounded-[var(--radius-lg)] p-6">
          <h2 className="font-display text-lg font-bold text-fg">Administradores</h2>
          <div className="mt-5 space-y-3">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className="flex items-center justify-between rounded-xl border border-border bg-bg-raised/60 p-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-inner ${
                      admin.role === "superadmin"
                        ? "bg-accent/10 text-accent shadow-[0_0_16px_-4px_rgba(10,95,219,0.35)]"
                        : "bg-bg text-fg-muted"
                    }`}
                  >
                    <User size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-fg">{admin.username}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                      {admin.role === "superadmin" ? "Super administrador" : "Administrador"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-fg-muted">
                      <Mail size={11} className="shrink-0" />
                      <span>{admin.email ?? "Sin correo asignado"}</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <EditEmailButton
                    adminId={admin.id}
                    username={admin.username}
                    currentEmail={admin.email}
                  />
                  <ResetPasswordButton adminId={admin.id} username={admin.username} />
                  <DeleteAdminButton
                    username={admin.username}
                    action={async () => {
                      "use server";
                      await deleteAdminUser(admin.id);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {resetRequests.length > 0 && (
        <div className="mt-8 admin-glass rounded-[var(--radius-lg)] p-6">
          <div className="flex items-center gap-2">
            <KeyRound size={17} className="text-amber-600 dark:text-amber-400" />
            <h2 className="font-display text-lg font-bold text-fg">
              Solicitudes recientes de recuperación de contraseña (últimos 7 días)
            </h2>
          </div>
          <p className="mt-1 text-xs text-fg-muted">
            Cuando un colaborador usa &quot;¿Olvidaste tu contraseña?&quot; en el login, su solicitud queda registrada aquí para que valides su identidad y le asignes una nueva clave.
          </p>
          <div className="mt-4 divide-y divide-border/60">
            {resetRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"
              >
                <div>
                  <span className="font-bold text-fg">{req.username}</span>
                  {req.details && <span className="ml-2 text-fg-muted">· {req.details}</span>}
                </div>
                <div className="font-mono text-fg-muted">
                  {new Date(req.createdAt).toLocaleString("es-PE", {
                    timeZone: "America/Lima",
                    dateStyle: "short",
                    timeStyle: "short",
                  })}{" "}
                  · IP {req.ipAddress}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
