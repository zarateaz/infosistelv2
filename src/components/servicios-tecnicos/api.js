/* Llamadas de la pantalla a la API del servidor. */
const BASE = '/api/servicios-tecnicos';

async function pedir(url, opciones = {}) {
  const r = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...(opciones.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error || 'No se pudo conectar con el servidor (' + r.status + ')');
    e.errores = j.errores;
    e.status = r.status;
    throw e;
  }
  return j;
}

export const api = {
  todo: () => pedir(BASE),
  crear: (datos, adelanto) => pedir(BASE, { method: 'POST', body: JSON.stringify({ datos, adelanto }) }),
  accion: (id, accion, datos = {}) => pedir(BASE + '/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ accion, ...datos }) }),
  eliminar: (id) => pedir(BASE + '/' + encodeURIComponent(id), { method: 'DELETE' }),
  guardarConfig: (cfg) => pedir(BASE + '/config', { method: 'PUT', body: JSON.stringify(cfg) }),
  subirFoto: (data) => pedir(BASE + '/fotos', { method: 'POST', body: JSON.stringify({ data }) }).then((r) => r.url),
};
