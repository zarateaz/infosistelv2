/* GET: mostrar una foto guardada. */
import { leerFoto, MIME } from '../../../../../lib/servicios-tecnicos/store';
import { tieneAcceso, sinAcceso } from '../../../../../lib/servicios-tecnicos/acceso';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  if (!(await tieneAcceso(req))) return sinAcceso();
  const { nombre } = await params;
  const buf = await leerFoto(nombre);
  if (!buf) return new Response('Foto no encontrada', { status: 404 });
  return new Response(buf, {
    headers: { 'Content-Type': MIME[nombre.split('.').pop()], 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
}
