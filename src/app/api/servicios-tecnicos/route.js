/* GET: todos los servicios y la configuración.  POST: registrar un servicio nuevo. */
import { obtenerTodo, modificar } from '../../../lib/servicios-tecnicos/store';
import { tieneAcceso, sinAcceso } from '../../../lib/servicios-tecnicos/acceso';
import { validarDatos, limpiarDatos, limpiarPago, uid, code } from '../../../lib/servicios-tecnicos/logic';
import { sincronizarIngresoCaja, sincronizarPagosFaltantes } from '../../../lib/servicios-tecnicos/cajaSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!(await tieneAcceso(req))) return sinAcceso();
  const todo = await obtenerTodo();
  // Sincroniza a Caja cualquier pago existente que aún no tenga ID de transacción
  const hayFaltantes = (todo.servicios || []).some((s) => (s.pagos || []).some((p) => !p.cajaId && +p.monto > 0));
  if (hayFaltantes) {
    await modificar(async (d) => {
      await sincronizarPagosFaltantes(d.servicios, d.cfg);
    });
    return Response.json(await obtenerTodo());
  }
  return Response.json(todo);
}

export async function POST(req) {
  if (!(await tieneAcceso(req))) return sinAcceso();
  const body = await req.json().catch(() => null);
  if (!body || !body.datos) return Response.json({ error: 'Faltan los datos del servicio' }, { status: 400 });
  const errores = validarDatos(body.datos, { nuevo: true, adelanto: body.adelanto });
  if (Object.keys(errores).length) return Response.json({ error: 'Revisa los datos', errores }, { status: 400 });
  const datos = limpiarDatos(body.datos);
  let adelantoPago = null;
  if (body.adelanto && +body.adelanto.monto > 0) {
    const r = limpiarPago({ ...body.adelanto, nota: 'Adelanto' });
    if (r.error) return Response.json({ error: r.error }, { status: 400 });
    adelantoPago = r.pago;
  }
  const res = await modificar(async (d) => {
    const num = d.cfg.next;
    d.cfg.next = num + 1;
    const pagos = adelantoPago ? [adelantoPago] : [];
    const s = {
      ...datos, id: uid(), num, etapa: 'recibido', pagos,
      hist: [{ e: 'recibido', t: datos.fecha }], notas: [], avisos: [], entrega: null, fListo: null, fEntregado: null,
      creado: new Date().toISOString(),
    };
    if (adelantoPago) {
      const cajaId = await sincronizarIngresoCaja({ servicio: s, pago: adelantoPago, cfg: d.cfg });
      if (cajaId) adelantoPago.cajaId = cajaId;
    }
    d.servicios.unshift(s);
    return { servicio: s, cfg: d.cfg, mensaje: 'Servicio ' + code(d.cfg, num) + ' registrado' };
  });
  return Response.json(res, { status: 201 });
}
