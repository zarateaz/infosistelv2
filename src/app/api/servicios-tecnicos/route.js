/* GET: todos los servicios y la configuración.  POST: registrar un servicio nuevo. */
import { obtenerTodo, modificar } from '../../../lib/servicios-tecnicos/store';
import { tieneAcceso, sinAcceso } from '../../../lib/servicios-tecnicos/acceso';
import { validarDatos, limpiarDatos, limpiarPago, uid, code } from '../../../lib/servicios-tecnicos/logic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!(await tieneAcceso(req))) return sinAcceso();
  return Response.json(await obtenerTodo());
}

export async function POST(req) {
  if (!(await tieneAcceso(req))) return sinAcceso();
  const body = await req.json().catch(() => null);
  if (!body || !body.datos) return Response.json({ error: 'Faltan los datos del servicio' }, { status: 400 });
  const errores = validarDatos(body.datos, { nuevo: true, adelanto: body.adelanto });
  if (Object.keys(errores).length) return Response.json({ error: 'Revisa los datos', errores }, { status: 400 });
  const datos = limpiarDatos(body.datos);
  let pagos = [];
  if (body.adelanto && +body.adelanto.monto > 0) {
    const r = limpiarPago({ ...body.adelanto, nota: 'Adelanto' });
    if (r.error) return Response.json({ error: r.error }, { status: 400 });
    pagos = [r.pago];
  }
  const res = await modificar((d) => {
    const num = d.cfg.next;
    d.cfg.next = num + 1;
    const s = {
      ...datos, id: uid(), num, etapa: 'recibido', pagos,
      hist: [{ e: 'recibido', t: datos.fecha }], notas: [], avisos: [], entrega: null, fListo: null, fEntregado: null,
      creado: new Date().toISOString(),
    };
    d.servicios.unshift(s);
    return { servicio: s, cfg: d.cfg, mensaje: 'Servicio ' + code(d.cfg, num) + ' registrado' };
  });
  return Response.json(res, { status: 201 });
}
