import { Sparkles, Code2, Layers, CheckCircle2 } from "lucide-react";

export default function PruebaExplicacionPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-fg">
              Apartado de Prueba (Demostración)
            </h1>
            <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold text-accent">
              Módulo de Ejemplo
            </span>
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            Espacio en blanco creado como plantilla para explicar cómo se agregan nuevas secciones al panel administrativo de INFOSISTEL.
          </p>
        </div>
      </div>

      {/* Contenedor Vacío de Prueba */}
      <div className="admin-glass flex min-h-[380px] flex-col items-center justify-center rounded-[var(--radius-lg)] p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent shadow-sm">
          <Sparkles size={32} />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold text-fg">
          Lienzo Vacío Listo para Desarrollar
        </h2>
        <p className="mt-2 max-w-lg text-sm text-fg-muted">
          Aquí puedes colocar cualquier tabla, formulario, gráfico o componente nuevo. Esta ruta vive en{" "}
          <code className="rounded bg-bg-raised px-1.5 py-0.5 font-mono text-xs font-bold text-accent">
            src/app/taller-control/(panel)/prueba/page.tsx
          </code>
        </p>

        <div className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-bg-alt/70 p-4">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-accent">
              <Layers size={15} />
              <span>1. Menú Lateral</span>
            </div>
            <p className="mt-1.5 text-xs text-fg-muted">
              Se registra el enlace en <code className="font-mono font-bold text-fg">layout.tsx</code> y se asigna su sección e ícono en <code className="font-mono font-bold text-fg">AdminSidebar.tsx</code>.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-bg-alt/70 p-4">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <Code2 size={15} />
              <span>2. Página (Next.js App Router)</span>
            </div>
            <p className="mt-1.5 text-xs text-fg-muted">
              Se crea una carpeta con su archivo <code className="font-mono font-bold text-fg">page.tsx</code> dentro de <code className="font-mono font-bold text-fg">taller-control/(panel)/</code>.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-bg-alt/70 p-4">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              <CheckCircle2 size={15} />
              <span>3. Base de Datos / Actions</span>
            </div>
            <p className="mt-1.5 text-xs text-fg-muted">
              Si necesita guardar datos, se acompaña de un archivo <code className="font-mono font-bold text-fg">actions.ts</code> conectado a Prisma.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

