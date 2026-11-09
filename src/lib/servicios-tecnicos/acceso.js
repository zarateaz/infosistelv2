/* =====================================================================
   Control de acceso para la API de servicios técnicos.
   Conectado al sistema de sesión admin de INFOSISTEL (SESSION_COOKIE / JWT).
   ===================================================================== */
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

export async function tieneAcceso(request) {
  if (process.env.SERVICIOS_TECNICOS_ABIERTO === '1') return true;
  try {
    let token = request?.cookies?.get?.(SESSION_COOKIE)?.value;
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE)?.value;
    }
    if (!token) return false;
    const session = await verifySessionToken(token);
    return !!(session && session.sub);
  } catch {
    return false;
  }
}

export function sinAcceso() {
  return Response.json({ error: 'No tienes acceso. Inicia sesión en la página.' }, { status: 401 });
}
