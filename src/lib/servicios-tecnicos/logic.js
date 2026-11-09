/* =====================================================================
   Servicios técnicos – INFOSISTEL
   Lógica compartida: la usan la pantalla (navegador) y la API (servidor).
   No importar aquí nada de Node (fs, path...), porque también corre en el navegador.
   ===================================================================== */

/* ---------- Catálogos ---------- */
export const ETAPAS = [
  { k: 'recibido', l: 'Recibido' },
  { k: 'diagnostico', l: 'En diagnóstico' },
  { k: 'reparacion', l: 'Mantenimiento / reparación' },
  { k: 'repuesto', l: 'En espera' },
  { k: 'listo', l: 'Listo para entregar' },
  { k: 'entregado', l: 'Entregado' },
];
export const ETQ = {
  recibido: 'Recibido', diagnostico: 'En diagnóstico', reparacion: 'En reparación', repuesto: 'En espera',
  listo: 'Listo para entregar', entregado: 'Entregado', noreparable: 'No reparable',
};
export const ETAPAS_VALIDAS = Object.keys(ETQ);
export const ETCOLOR = {
  recibido: 'c-blue', diagnostico: 'c-vio', reparacion: 'c-warn', repuesto: 'c-teal',
  listo: 'c-ok', entregado: 'c-plain', noreparable: 'c-bad',
};
export const ACTIVAS = ['recibido', 'diagnostico', 'reparacion', 'repuesto'];
export const SIG = { recibido: 'diagnostico', diagnostico: 'reparacion', reparacion: 'listo', repuesto: 'reparacion', listo: 'entregado', noreparable: 'entregado' };
export const TIPOS = ['Laptop', 'PC / CPU', 'Impresora', 'All in One', 'Monitor', 'Otro'];
export const ACCS = ['Cargador', 'Cable de poder', 'Batería', 'Mouse', 'Teclado', 'Funda / maletín', 'Cartuchos / tóner', 'Cable USB'];
export const CHECKS = ['Golpes', 'Rayones', 'Pantalla rota', 'Teclado dañado', 'Bisagra floja', 'Faltan tornillos', 'Signos de humedad'];
export const PRUEBAS = ['Enciende y funciona bien', 'Se probó la falla reportada', 'Accesorios devueltos', 'El cliente revisó el equipo'];
export const MARCAS = ['HP', 'LENOVO', 'DELL', 'ASUS', 'ACER', 'TOSHIBA', 'APPLE', 'SAMSUNG', 'MSI', 'EPSON', 'CANON', 'BROTHER', 'GENÉRICO'];
export const METODOS = ['Efectivo', 'Yape 1', 'Yape 2'];

/** Mapea el método de pago al formato canónico de Caja ("EFECTIVO", "YAPE 1", "YAPE 2") */
export function aMetodoCaja(m) {
  if (!m) return 'EFECTIVO';
  const up = String(m).trim().toUpperCase();
  if (up === 'YAPE 2' || up === 'YAPE2') return 'YAPE 2';
  if (up === 'YAPE 1' || up === 'YAPE1' || up === 'YAPE') return 'YAPE 1';
  return 'EFECTIVO';
}

/** Normaliza el método al estándar de Servicios Técnicos ('Efectivo', 'Yape 1', 'Yape 2') */
export function normalizarMetodo(m) {
  if (!m) return 'Efectivo';
  const c = aMetodoCaja(m);
  if (c === 'YAPE 2') return 'Yape 2';
  if (c === 'YAPE 1') return 'Yape 1';
  return 'Efectivo';
}

/** Determina si el método corresponde a cualquiera de las cuentas de Yape */
export const esYape = (m) => {
  const norm = normalizarMetodo(m);
  return norm === 'Yape 1' || norm === 'Yape 2';
};

/** Devuelve la información visual para badges e iconos de pago */
export function metodoBadge(m) {
  const norm = normalizarMetodo(m);
  if (norm === 'Yape 2') return { label: 'YP2', color: 'c-vio', nombre: 'Yape 2 (Caja)' };
  if (norm === 'Yape 1') return { label: 'YP1', color: 'c-vio', nombre: 'Yape 1 (Edgar)' };
  return { label: 'EF', color: 'c-ok', nombre: 'Efectivo' };
}
export const AVISO_TXT = {
  recibido: 'comprobante de recepción', listo: 'aviso de equipo listo', noreparable: 'aviso de no reparable',
  cobro: 'recordatorio de pago', recoger: 'recordatorio para recoger',
};
export const PAGO = { pendiente: ['Pendiente', 'c-bad'], parcial: ['Parcial', 'c-warn'], pagado: ['Pagado', 'c-blue'], cotizar: ['Por cotizar', 'c-plain'] };

export function cfgPorDefecto() {
  return {
    emp: 'INFOSISTEL E.I.R.L',
    tel: '',
    pref: 'OS',
    next: 1,
    tecnicos: ['CABALLERO PECHO EDGAR WENCESLAO'],
    garantia: 30,
    diasRecoger: 30,
    diasAbandono: 60,
  };
}

/* ---------- Utilidades ---------- */
export const DAY = 864e5;
const pad = (n) => String(n).padStart(2, '0');
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const toLocal = (d) => ymd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
export const parseD = (s) => (s && s.length === 10 ? new Date(s + 'T00:00') : new Date(s));
export const fDia = (s) => { if (!s) return ''; const d = parseD(s); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); };
export const fHora = (s) => { if (!s) return ''; const d = parseD(s); return fDia(s) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
export const fCorta = (s) => { if (!s) return ''; const d = parseD(s); return d.getDate() + ' ' + MES[d.getMonth()] + ' ' + d.getFullYear(); };
export const money = (n) => 'S/. ' + (Number(n) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const code = (cfg, n) => (cfg.pref || 'OS') + '-' + String(n).padStart(4, '0');
export const total = (s) => (+s.costo?.mo || 0) + (+s.costo?.rep || 0);
export const pagado = (s) => (s.pagos || []).reduce((a, p) => a + (+p.monto || 0), 0);
export const pendiente = (s) => Math.max(0, redondear(total(s) - pagado(s)));
export const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const estadoPago = (s) => {
  const t = total(s), p = pagado(s);
  if (t === 0) return p > 0 ? 'parcial' : 'cotizar';
  if (p >= t) return 'pagado';
  return p > 0 ? 'parcial' : 'pendiente';
};
export const iniciales = (n) => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('');
export const nombreCorto = (n) => { const p = (n || '').split(/\s+/)[0] || ''; return p.charAt(0) + p.slice(1).toLowerCase(); };
export const fueNoReparable = (s) => (s.hist || []).some((h) => h.e === 'noreparable');
export const garantiaHasta = (s, cfg) =>
  s.etapa === 'entregado' && s.fEntregado && !fueNoReparable(s) ? new Date(parseD(s.fEntregado).getTime() + cfg.garantia * DAY) : null;
export const clienteKey = (c) => c.dni || c.ruc || c.cel;

/** Primer aviso de "listo" enviado después de que el equipo quedó listo. Desde ahí cuentan los días para recoger. */
export function avisoBase(s) {
  if (!s.fListo) return null;
  const a = (s.avisos || [])
    .filter((x) => ['listo', 'noreparable', 'recoger'].includes(x.tipo) && x.t >= s.fListo)
    .sort((x, y) => String(x.t).localeCompare(String(y.t)));
  return a.length ? a[0].t : null;
}
export function alerta(s, cfg) {
  if ((s.etapa === 'listo' || s.etapa === 'noreparable') && s.fListo) {
    const av = avisoBase(s);
    if (!av) return { tipo: 'sinaviso', nivel: 'info', txt: 'Falta avisar', dias: 0 };
    const d = Math.floor((Date.now() - parseD(av)) / DAY);
    if (d >= cfg.diasAbandono) return { tipo: 'abandono', nivel: 'bad', txt: 'Sin recoger ' + d + ' días', dias: d };
    if (d >= cfg.diasRecoger) return { tipo: 'recoger', nivel: 'warn', txt: 'Sin recoger ' + d + ' días', dias: d };
  }
  return null;
}

/* ---------- WhatsApp ---------- */
export const waLink = (cel, txt) => 'https://wa.me/51' + cel + (txt ? '?text=' + encodeURIComponent(txt) : '');
export function mensaje(tipo, s, cfg) {
  const n = nombreCorto(s.cliente.nombre), eq = (s.equipo.tipo + ' ' + s.equipo.marca).trim(), c = code(cfg, s.num), p = pendiente(s);
  const hola = 'Hola ' + n + ', le saluda ' + cfg.emp + '. ';
  if (tipo === 'recibido') return hola + 'Recibimos su ' + eq + ' con la orden ' + c + ' el ' + fDia(s.fecha) + '. Falla reportada: ' + s.falla + '. Le avisaremos cuando esté listo.';
  if (tipo === 'listo') return hola + 'Su ' + eq + ' (orden ' + c + ') ya está listo para recoger.' + (p > 0 ? ' Pendiente por pagar: ' + money(p) + ' (efectivo o Yape).' : '') + ' Traiga su DNI.';
  if (tipo === 'noreparable') return hola + 'Revisamos su ' + eq + ' (orden ' + c + ') y lamentablemente no tiene reparación' + (s.diagnostico ? ': ' + s.diagnostico : '') + '. Puede recogerlo en tienda' + (p > 0 ? '. Pendiente por el diagnóstico: ' + money(p) : '') + '.';
  if (tipo === 'cobro') return hola + 'Le recordamos que tiene un pendiente de ' + money(p) + ' por el servicio de su ' + eq + ' (orden ' + c + '). Puede pagar en efectivo o Yape.';
  if (tipo === 'recoger') return hola + 'Su ' + eq + ' (orden ' + c + ') está listo desde el ' + fDia(s.fListo) + '. Le recordamos recogerlo: pasados ' + cfg.diasAbandono + ' días desde el aviso la empresa no se responsabiliza por el equipo.';
  return hola;
}

/* ---------- Validación (misma regla en pantalla y servidor) ---------- */
export function validarDatos(d, { nuevo, adelanto } = {}) {
  const e = {};
  const c = d.cliente || {};
  if (!String(c.nombre || '').trim()) e.nombre = 'Escribe el nombre del cliente';
  if (c.dni && !/^\d{8}$/.test(c.dni)) e.dni = 'El DNI tiene 8 dígitos';
  if (c.ruc && !/^(10|15|17|20)\d{9}$/.test(c.ruc)) e.ruc = 'El RUC tiene 11 dígitos y empieza en 10 o 20';
  if (!c.dni && !c.ruc) e.dni = 'Escribe el DNI (o el RUC si es empresa)';
  if (!/^9\d{8}$/.test(c.cel || '')) e.cel = 'El celular tiene 9 dígitos y empieza en 9';
  if (!String(d.equipo?.marca || '').trim()) e.marca = 'Escribe la marca';
  if (!String(d.falla || '').trim()) e.falla = 'Escribe qué falla dice el cliente';
  if (!d.fecha || isNaN(new Date(d.fecha))) e.fecha = 'Indica la fecha de recepción';
  if (nuevo && adelanto) {
    const m = +adelanto.monto || 0, t = (+d.costo?.mo || 0) + (+d.costo?.rep || 0);
    if (m < 0) e.adel = 'El adelanto no puede ser negativo';
    if (m > 0 && esYape(adelanto.metodo) && !/^\d{6,}$/.test(adelanto.op || '')) e.op = 'Escribe el N° de operación de ' + normalizarMetodo(adelanto.metodo);
    if (t > 0 && m > t) e.adel = 'El adelanto no puede ser mayor que el total';
  }
  return e;
}

/* Deja solo los campos permitidos y en el formato correcto (lo usa el servidor). */
const txt = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const up = (v, max) => txt(v, max).toUpperCase();
const lista = (v, permitidos) => (Array.isArray(v) ? v.filter((x) => permitidos.includes(x)) : []);
const urlsFoto = (v) => (Array.isArray(v) ? v.filter((u) => typeof u === 'string' && u.startsWith('/api/servicios-tecnicos/fotos/')).slice(0, 30) : []);
export function limpiarDatos(d) {
  return {
    fecha: new Date(d.fecha).toISOString(),
    cliente: { nombre: up(d.cliente?.nombre, 120), dni: txt(d.cliente?.dni, 8), ruc: txt(d.cliente?.ruc, 11), cel: txt(d.cliente?.cel, 9) },
    equipo: {
      tipo: TIPOS.includes(d.equipo?.tipo) ? d.equipo.tipo : 'Otro',
      marca: up(d.equipo?.marca, 60), modelo: txt(d.equipo?.modelo, 80), serie: up(d.equipo?.serie, 60),
      acc: lista(d.equipo?.acc, ACCS), accOtros: txt(d.equipo?.accOtros, 200), clave: txt(d.equipo?.clave, 60),
    },
    llegada: { enciende: ['si', 'no', 'nd'].includes(d.llegada?.enciende) ? d.llegada.enciende : 'nd', checks: lista(d.llegada?.checks, CHECKS), obs: txt(d.llegada?.obs, 500) },
    urgente: !!d.urgente,
    falla: up(d.falla, 1000),
    diagnostico: txt(d.diagnostico, 2000),
    solucion: txt(d.solucion, 2000),
    tecnico: txt(d.tecnico, 120),
    costo: { mo: Math.max(0, redondear(d.costo?.mo)), rep: Math.max(0, redondear(d.costo?.rep)) },
    fotos: { ingreso: urlsFoto(d.fotos?.ingreso), entrega: urlsFoto(d.fotos?.entrega) },
  };
}
export function limpiarPago(p) {
  const monto = redondear(p?.monto);
  const mNorm = normalizarMetodo(p?.metodo);
  const metodoValido = METODOS.includes(mNorm);
  if (!(monto > 0)) return { error: 'Escribe un monto mayor a 0' };
  if (!metodoValido) return { error: 'Elige Efectivo, Yape 1 o Yape 2' };
  const yape = esYape(mNorm);
  const op = yape ? txt(p.op, 20).replace(/\D/g, '') : '';
  if (yape && op.length < 6) return { error: 'Escribe el N° de operación de ' + mNorm };
  return {
    pago: {
      id: uid(),
      fecha: new Date().toISOString(),
      monto,
      metodo: mNorm,
      op,
      nota: txt(p.nota, 40) || 'Pago',
      ...(p?.cajaId ? { cajaId: p.cajaId } : {}),
    },
  };
}

/* ---------- Cambios sobre un servicio (los aplica el servidor) ---------- */
export function cambiarEtapa(s, k) {
  const now = new Date().toISOString();
  s.etapa = k;
  s.hist.push({ e: k, t: now });
  if (k === 'listo' || k === 'noreparable') { if (!s.fListo) s.fListo = now; } else if (k !== 'entregado') s.fListo = null;
  if (k === 'entregado') s.fEntregado = now; else s.fEntregado = null;
  return s;
}
