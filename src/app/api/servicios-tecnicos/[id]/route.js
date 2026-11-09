/* PATCH: cambiar un servicio (etapa, pagos, diagnóstico, entrega...).  DELETE: eliminarlo. */
import { modificar, borrarFotos } from '../../../../lib/servicios-tecnicos/store';
import { tieneAcceso, sinAcceso } from '../../../../lib/servicios-tecnicos/acceso';
import {
  validarDatos, limpiarDatos, limpiarPago, cambiarEtapa, pendiente, total, uid, redondear,
  ETAPAS_VALIDAS, PRUEBAS, AVISO_TXT,
} from '../../../../lib/servicios-tecnicos/logic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

class ErrorUsuario extends Error {}
const fallo = (msg) => { throw new ErrorUsuario(msg); };
const soloFotos = (v) => (Array.isArray(v) ? v.filter((u) => typeof u === 'string' && u.startsWith('/api/servicios-tecnicos/fotos/')) : []);

function aplicar(s, b) {
  switch (b.accion) {
    case 'editar': {
      const e = validarDatos(b.datos || {});
      if (Object.keys(e).length) fallo(Object.values(e)[0]);
      const d = limpiarDatos(b.datos);
      Object.assign(s, d);
      return 'Cambios guardados';
    }
    case 'etapa': {
      if (!ETAPAS_VALIDAS.includes(b.etapa) || b.etapa === 'entregado') fallo('Etapa no válida');
      if (b.etapa === s.etapa) return null;
      cambiarEtapa(s, b.etapa);
      return null;
    }
    case 'diagnostico': {
      s.diagnostico = String(b.diagnostico ?? '').trim().slice(0, 2000);
      s.solucion = String(b.solucion ?? '').trim().slice(0, 2000);
      return 'Diagnóstico guardado';
    }
    case 'costo': {
      s.costo = { mo: Math.max(0, redondear(b.mo)), rep: Math.max(0, redondear(b.rep)) };
      return 'Costo actualizado';
    }
    case 'fotos': {
      if (!['ingreso', 'entrega'].includes(b.tipo)) fallo('Tipo de foto no válido');
      s.fotos = { ...s.fotos, [b.tipo]: soloFotos(b.fotos).slice(0, 30) };
      return null;
    }
    case 'pago': {
      const r = limpiarPago(b.pago);
      if (r.error) fallo(r.error);
      if (total(s) > 0 && r.pago.monto > pendiente(s) + 0.001) fallo('El monto es mayor a lo pendiente');
      s.pagos.push(r.pago);
      return 'Pago registrado';
    }
    case 'quitarPago': {
      s.pagos = s.pagos.filter((p) => p.id !== b.pagoId);
      return 'Pago eliminado';
    }
    case 'aviso': {
      if (!AVISO_TXT[b.tipo]) fallo('Aviso no válido');
      s.avisos = [...(s.avisos || []), { tipo: b.tipo, t: new Date().toISOString() }];
      return null;
    }
    case 'nota': {
      const t = String(b.txt || '').trim().slice(0, 1000);
      if (!t) fallo('Escribe la nota');
      s.notas = [...(s.notas || []), { id: uid(), t: new Date().toISOString(), txt: t, autor: String(b.autor || '').slice(0, 120) }];
      return 'Nota agregada';
    }
    case 'entregar': {
      if (s.etapa !== 'listo' && s.etapa !== 'noreparable') fallo('Solo se entrega un equipo listo o no reparable');
      const rec = b.entrega?.recoge || {};
      const recoge = rec.tipo === 'otro'
        ? { tipo: 'otro', nombre: String(rec.nombre || '').trim().toUpperCase().slice(0, 120), dni: String(rec.dni || '') }
        : { tipo: 'titular', nombre: '', dni: '' };
      if (recoge.tipo === 'otro' && (!recoge.nombre || !/^\d{8}$/.test(recoge.dni))) fallo('Escribe el nombre y el DNI de quien recoge');
      if (b.pago) {
        const r = limpiarPago(b.pago);
        if (r.error) fallo(r.error);
        if (r.pago.monto > pendiente(s) + 0.001) fallo('El monto es mayor a lo pendiente');
        s.pagos.push(r.pago);
      }
      s.fotos = { ...s.fotos, entrega: [...(s.fotos?.entrega || []), ...soloFotos(b.fotos)].slice(0, 30) };
      s.entrega = { recoge, pruebas: (b.entrega?.pruebas || []).filter((p) => PRUEBAS.includes(p)) };
      const now = new Date().toISOString();
      s.etapa = 'entregado';
      s.hist.push({ e: 'entregado', t: now });
      s.fEntregado = now;
      return 'Equipo entregado';
    }
    default:
      fallo('Acción no válida');
  }
}

export async function PATCH(req, { params }) {
  if (!(await tieneAcceso(req))) return sinAcceso();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Solicitud vacía' }, { status: 400 });
  try {
    const res = await modificar((d) => {
      const s = d.servicios.find((x) => x.id === id);
      if (!s) fallo('El servicio ya no existe');
      const mensaje = aplicar(s, body);
      s.actualizado = new Date().toISOString();
      return { servicio: s, mensaje };
    });
    return Response.json(res);
  } catch (e) {
    if (e instanceof ErrorUsuario) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

export async function DELETE(req, { params }) {
  if (!(await tieneAcceso(req))) return sinAcceso();
  const { id } = await params;
  const borrado = await modificar((d) => {
    const s = d.servicios.find((x) => x.id === id);
    d.servicios = d.servicios.filter((x) => x.id !== id);
    return s || null;
  });
  if (!borrado) return Response.json({ error: 'El servicio ya no existe' }, { status: 404 });
  await borrarFotos([...(borrado.fotos?.ingreso || []), ...(borrado.fotos?.entrega || [])]);
  return Response.json({ ok: true, mensaje: 'Servicio eliminado' });
}
