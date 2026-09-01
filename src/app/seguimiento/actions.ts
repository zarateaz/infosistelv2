"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { blindIndex } from "@/lib/crypto";
import { digitsOnly } from "@/lib/sanitize";
import { checkRateLimit, getClientIP, rateLimitKey } from "@/lib/rateLimit";

export interface PublicRepairStatus {
  code: string;
  equipment: string;
  problem: string;
  progress: number;
  statusText: string;
  lastUpdate: Date;
}

export interface TrackRepairsResult {
  repairs?: PublicRepairStatus[];
  error?: string;
}

/** Public, unauthenticated lookup — anyone with a DNI number can call
 *  this, so it's deliberately narrow: exact-match only via the same
 *  blind HMAC index the admin panel uses (never decrypts or compares a
 *  raw DNI), a strict per-IP rate limit (this is the one place on the
 *  public site that could be used to enumerate DNIs otherwise), and the
 *  returned fields exclude the DNI itself and the row id — a customer
 *  already knows their own DNI, and nothing here needs to echo it back
 *  or expose an internal identifier. */
export async function trackRepairsByDni(dniInput: string): Promise<TrackRepairsResult> {
  const ip = getClientIP(await headers());
  const rateCheck = checkRateLimit(rateLimitKey("track-repair", ip), 8, 5 * 60 * 1000);
  if (!rateCheck.allowed) {
    return { error: "Demasiadas búsquedas seguidas. Intenta de nuevo en unos minutos." };
  }

  const dni = digitsOnly(dniInput);
  if (dni.length !== 8) {
    return { error: "Ingresa tu DNI completo (8 dígitos)." };
  }

  const rows = await prisma.repair.findMany({
    where: { dniIndex: blindIndex(dni) },
    orderBy: { createdAt: "desc" },
    select: { code: true, equipment: true, problem: true, progress: true, statusText: true, lastUpdate: true },
  });

  if (rows.length === 0) {
    return { error: "No encontramos ninguna reparación registrada con ese DNI." };
  }

  return { repairs: rows };
}
