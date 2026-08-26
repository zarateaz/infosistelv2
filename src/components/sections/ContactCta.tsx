"use client";

import { MapPin, Phone, Clock, Mail, ArrowRight } from "lucide-react";
import { Reveal } from "@/components/scroll/Reveal";

const DETAILS = [
  { icon: MapPin, label: "Dirección", value: "Av. Giráldez 274, Huancayo" },
  { icon: Phone, label: "WhatsApp", value: "+51 964 648 202" },
  { icon: Clock, label: "Horario", value: "Lun. a sáb., 9:00 am – 7:00 pm" },
  { icon: Mail, label: "Correo", value: "ecaballero@hotmail.com" },
];

export function ContactCta() {
  return (
    <section id="contacto" className="py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <Reveal>
          <div className="rounded-[var(--radius-lg)] border border-border bg-bg-alt px-8 py-14 md:px-16 md:py-20">
            <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:items-center">
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-accent">
                  <span className="h-px w-6 bg-accent" />
                  Hablemos
                </span>
                <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-tight text-fg">
                  Cuéntanos qué se dañó
                </h2>
                <p className="mt-5 max-w-md text-fg-muted">
                  Respuesta directa por WhatsApp, sin bots de por medio.
                  Diagnóstico honesto antes de cualquier cotización.
                </p>
                <a
                  href="https://wa.me/51964648202"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-accent px-7 py-3.5 text-sm font-bold text-accent-fg transition-transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  Escribir por WhatsApp
                  <ArrowRight size={16} />
                </a>
              </div>

              <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {DETAILS.map((d) => (
                  <div key={d.label} className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <d.icon size={16} strokeWidth={1.75} />
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-fg-muted">
                        {d.label}
                      </dt>
                      <dd className="mt-0.5 text-sm font-medium text-fg">{d.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
