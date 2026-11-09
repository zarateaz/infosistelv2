/* POST: subir una foto (llega ya comprimida desde la pantalla). */
import { guardarFoto } from '../../../../lib/servicios-tecnicos/store';
import { tieneAcceso, sinAcceso } from '../../../../lib/servicios-tecnicos/acceso';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!(await tieneAcceso(req))) return sinAcceso();
  const b = await req.json().catch(() => null);
  try {
    const url = await guardarFoto(b?.data);
    return Response.json({ url }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message || 'No se pudo guardar la foto' }, { status: 400 });
  }
}
