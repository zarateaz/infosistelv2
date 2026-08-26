"use client";

import { Users, ShieldCheck, Clock } from "lucide-react";
import { Reveal } from "@/components/scroll/Reveal";

const STATS = [
  { icon: Users, value: "500+", label: "Clientes atendidos" },
  { icon: ShieldCheck, value: "100%", label: "Garantía por escrito" },
  { icon: Clock, value: "5+", label: "Años en Huancayo" },
];

export function Stats() {
  return (
    <section className="border-y border-border py-16">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          {STATS.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 0.08}>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <stat.icon size={22} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-display text-3xl font-bold text-fg">{stat.value}</p>
                  <p className="text-sm text-fg-muted">{stat.label}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
