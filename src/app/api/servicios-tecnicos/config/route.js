/* PUT: guardar la configuración (empresa, técnicos, plazos). */
import { modificar } from '../../../../lib/servicios-tecnicos/store';
import { tieneAcceso, sinAcceso } from '../../../../lib/servicios-tecnicos/acceso';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const entero = (v, min, def) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= min ? n : def; };

export async function PUT(req) {
  if (!(await tieneAcceso(req))) return sinAcceso();
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: 'Solicitud vacía' }, { status: 400 });
  const tecnicos = (Array.isArray(b.tecnicos) ? b.tecnicos : []).map((t) => String(t).trim().toUpperCase().slice(0, 120)).filter(Boolean).slice(0, 30);
  const cfg = await modificar((d) => {
    d.cfg = {
      ...d.cfg,
      emp: String(b.emp || d.cfg.emp).trim().toUpperCase().slice(0, 120),
      tel: String(b.tel || '').trim().slice(0, 30),
      pref: (String(b.pref || 'OS').trim().toUpperCase().replace(/[^A-Z]/g, '') || 'OS').slice(0, 4),
      tecnicos: tecnicos.length ? tecnicos : d.cfg.tecnicos,
      garantia: entero(b.garantia, 0, 30),
      diasRecoger: entero(b.diasRecoger, 1, 30),
      diasAbandono: entero(b.diasAbandono, 1, 60),
    };
    return d.cfg;
  });
  return Response.json({ cfg, mensaje: 'Configuración guardada' });
}
