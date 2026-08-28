"use client";

import {
  Wrench,
  Laptop,
  Printer,
  PackageSearch,
  Gauge,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/scroll/Reveal";

const SERVICES: { icon: LucideIcon; title: string; description: string; featured?: boolean }[] = [
  {
    icon: Laptop,
    title: "Reparación de laptops",
    description: "Pantallas, bisagras, teclados y cortos en placa — el servicio que más nos piden en Huancayo.",
    featured: true,
  },
  {
    icon: Wrench,
    title: "Mantenimiento preventivo",
    description: "Limpieza interna, cambio de pasta térmica y optimización de software.",
  },
  {
    icon: Printer,
    title: "Servicio de impresoras",
    description: "Reset de almohadillas, limpieza de cabezales, reparación mecánica.",
  },
  {
    icon: PackageSearch,
    title: "Venta de repuestos",
    description: "Cargadores originales, baterías, pantallas y periféricos.",
  },
  {
    icon: Gauge,
    title: "Repotenciación SSD/RAM",
    description: "Nueva vida a equipos antiguos con SSD y más memoria.",
  },
  {
    icon: Building2,
    title: "Soporte corporativo",
    description: "Contratos de mantenimiento para empresas y colegios.",
  },
];

export function Services() {
  return (
    <section id="servicios" className="relative py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <Reveal>
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-accent">
            <span className="h-px w-6 bg-accent" />
            Servicios
          </span>
          <h2 className="mt-4 max-w-xl font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-tight text-fg">
            Todo lo que tu equipo necesita, bajo un mismo techo
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service, i) => (
            <Reveal key={service.title} delay={(i % 3) * 0.08} className={service.featured ? "sm:col-span-2 lg:col-span-1" : undefined}>
              {service.featured ? (
                <div className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] bg-gradient-to-br from-accent to-accent-pressed p-8 text-accent-fg shadow-lg shadow-accent/25">
                  <div
                    aria-hidden
                    className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl transition-transform duration-500 group-hover:scale-125"
                  />
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider">
                    Más solicitado
                  </span>
                  <div className="mt-6 flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                    <service.icon size={20} strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold">{service.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-accent-fg/85">{service.description}</p>
                </div>
              ) : (
                <div className="group h-full rounded-[var(--radius-md)] border border-border bg-bg-alt p-8 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/10">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-fg">
                    <service.icon size={20} strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold text-fg">{service.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">{service.description}</p>
                </div>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
