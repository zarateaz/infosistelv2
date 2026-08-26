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

const SERVICES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Wrench,
    title: "Mantenimiento preventivo",
    description: "Limpieza interna, cambio de pasta térmica y optimización de software.",
  },
  {
    icon: Laptop,
    title: "Reparación de laptops",
    description: "Pantallas, bisagras, teclados y cortos en placa.",
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
            <Reveal key={service.title} delay={(i % 3) * 0.08}>
              <div className="group h-full rounded-[var(--radius-md)] border border-border bg-bg-alt p-8 transition-colors hover:border-accent/40">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-fg">
                  <service.icon size={20} strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-fg">
                  {service.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                  {service.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
