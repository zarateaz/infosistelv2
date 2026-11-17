/* Formulario ultra simple y rápido para registrar servicios técnicos.
   Enfocado en lo esencial: Nombre del cliente, Problema del equipo, Presupuesto y Caja. */
import { useMemo, useState } from 'react';
import { Ic } from './ui';
import {
  TIPOS, MARCAS, METODOS, esYape, clienteKey, code, money, pagado, parseD, toLocal, validarDatos,
  normalizarMetodo,
} from '../../lib/servicios-tecnicos/logic';

function vacio(cfg) {
  return {
    fecha: toLocal(new Date()),
    cliente: { nombre: '', dni: '', ruc: '', cel: '' },
    equipo: { tipo: 'Laptop', marca: '', modelo: '', serie: '', acc: [], accOtros: '', clave: '' },
    llegada: { enciende: 'si', checks: [], obs: '' },
    falla: '', diagnostico: '', solucion: '',
    tecnico: cfg.tecnicos[0] || '',
    costo: { mo: '', rep: '' },
    fotos: { ingreso: [], entrega: [] },
    urgente: false,
  };
}
const copia = (o) => JSON.parse(JSON.stringify(o));

function Campo({ label, error, req, hint, children, full }) {
  return (
    <label className={'f' + (error ? ' has-err' : '') + (full ? ' full' : '')}>
      <span className={req ? 'req' : ''}>{label}</span>
      {children}
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export default function Formulario({ cfg, servicios, editId, acciones, ir, abrir, flash, ocupado }) {
  const orig = editId ? servicios.find((s) => s.id === editId) : null;
  const [f, setF] = useState(() => (orig
    ? { ...copia(orig), diagnostico: orig.diagnostico || '', solucion: orig.solucion || '', fecha: toLocal(parseD(orig.fecha)), costo: { mo: orig.costo.mo || '', rep: orig.costo.rep || '' } }
    : vacio(cfg)));
  const [adelanto, setAdelanto] = useState({ monto: '', metodo: 'Efectivo', op: '' });
  const [err, setErr] = useState({});
  const [confirmando, setConfirmando] = useState(false);

  const set = (ruta, val) => setF((o) => {
    const n = copia(o); let x = n; const ks = ruta.split('.');
    ks.slice(0, -1).forEach((k) => { x = x[k]; });
    x[ks[ks.length - 1]] = val;
    return n;
  });

  /* Autocompletar clientes frecuentes */
  const clientes = useMemo(() => {
    const m = {};
    [...servicios].sort((a, b) => a.num - b.num).forEach((s) => {
      const k = clienteKey(s.cliente); if (!k) return;
      m[k] = { ...(m[k] || { n: 0 }), ...s.cliente, n: (m[k]?.n || 0) + 1 };
    });
    return m;
  }, [servicios]);

  const c = f.cliente;
  const match = !orig && ((c.cel.length === 9 && Object.values(clientes).find((x) => x.cel === c.cel)) || (c.dni.length === 8 && clientes[c.dni]));
  const yaUsado = match && match.nombre === c.nombre && match.cel === c.cel;

  const t = (+f.costo.mo || 0) + (+f.costo.rep || 0);
  const adel = orig ? 0 : +adelanto.monto || 0;
  const yaPagado = orig ? pagado(orig) : adel;

  const solicitarGuardar = (ev) => {
    ev.preventDefault();
    const e = validarDatos(f, { nuevo: !orig, adelanto: orig ? null : adelanto });
    setErr(e);
    if (Object.keys(e).length) {
      flash('Revisa los campos obligatorios');
      setTimeout(() => document.querySelector('.st-root .has-err input, .st-root .has-err textarea')?.focus(), 0);
      return;
    }
    setConfirmando(true);
  };

  const ejecutarGuardar = async () => {
    const datos = { ...f, fecha: new Date(f.fecha).toISOString() };
    if (orig) {
      const ok = await acciones.editar(orig.id, datos);
      if (ok) setConfirmando(false);
    } else {
      const ok = await acciones.crear(datos, adel > 0 ? adelanto : null);
      if (ok) setConfirmando(false);
    }
  };

  const texto = (ruta, v, ph, extra = {}) => <input value={v} placeholder={ph || ''} onChange={(e) => set(ruta, e.target.value)} {...extra} />;
  const digitos = (ruta, v, max, ph) => (
    <input value={v} placeholder={ph} inputMode="numeric" maxLength={max} onChange={(e) => set(ruta, e.target.value.replace(/\D/g, '').slice(0, max))} />
  );
  const numero = (v, onChange) => <input type="number" min="0" step="0.5" inputMode="decimal" placeholder="0.00" value={v} onChange={(e) => onChange(e.target.value)} />;
  const volver = () => (orig ? abrir(orig.id) : ir('servicios'));

  return (
    <section>
      <div className="sec-head">
        <div>
          <h2>{orig ? 'Editar servicio ' + code(cfg, orig.num) : 'Nuevo servicio técnico'}</h2>
          <p>{orig ? 'Modifica los datos del servicio.' : 'Recepción rápida: registra cliente, equipo, falla y adelanto a Caja.'}</p>
        </div>
        <button type="button" className="btn" onClick={volver}><Ic n="back" s={16} />Volver</button>
      </div>

      <form className="card form" onSubmit={solicitarGuardar} autoComplete="off" noValidate style={{ maxWidth: 840, margin: '0 auto' }}>
        {/* 1. CLIENTE */}
        <fieldset>
          <legend><span className="n">1</span>Cliente</legend>
          <div className="row">
            <Campo label="Nombre del cliente" error={err.nombre} req full>
              {texto('cliente.nombre', c.nombre, 'Ej. Juan Pérez / Computienda')}
            </Campo>
          </div>
          <div className="two-col" style={{ marginTop: 12 }}>
            <Campo label="Celular / WhatsApp" error={err.cel} hint="Para avisos de entrega">
              {digitos('cliente.cel', c.cel, 9, '964 648 202')}
            </Campo>
            <Campo label="DNI / RUC (opcional)" error={err.dni}>
              {digitos('cliente.dni', c.dni, 11, 'Opcional')}
            </Campo>
          </div>
          {match && !yaUsado && (
            <div className="found" style={{ marginTop: 10 }}>
              <span><Ic n="users" s={16} /> Cliente frecuente: <b>{match.nombre}</b> · {match.n} servicio(s) anterior(es)</span>
              <button type="button" className="btn sm" onClick={() => set('cliente', { nombre: match.nombre, dni: match.dni || c.dni, ruc: match.ruc || c.ruc, cel: match.cel })}>Usar datos</button>
            </div>
          )}
        </fieldset>

        {/* 2. EQUIPO Y PROBLEMA REPORTADO */}
        <fieldset>
          <legend><span className="n">2</span>Equipo y Problema reportado</legend>
          <div className="f" style={{ marginBottom: 12 }}>
            <span>Tipo de equipo</span>
            <div className="seg" role="group" aria-label="Tipo de equipo">
              {TIPOS.map((x) => (
                <button key={x} type="button" aria-pressed={f.equipo.tipo === x} onClick={() => set('equipo.tipo', x)}>
                  {x}
                </button>
              ))}
            </div>
          </div>

          <div className="row">
            <Campo label="Marca" error={err.marca}>
              {texto('equipo.marca', f.equipo.marca, 'HP, Lenovo, Epson…', { list: 'st-marcas' })}
            </Campo>
            <Campo label="Modelo">
              {texto('equipo.modelo', f.equipo.modelo, 'Ej. IdeaPad 3, L3210…')}
            </Campo>
            <Campo label="Contraseña / PIN (si aplica)" hint="Para probar el equipo">
              {texto('equipo.clave', f.equipo.clave, 'Opcional')}
            </Campo>
          </div>
          <datalist id="st-marcas">{MARCAS.map((m) => <option key={m} value={m} />)}</datalist>

          {/* PROBLEMA O FALLA DEL EQUIPO */}
          <div className="row" style={{ marginTop: 12 }}>
            <Campo label="Problema o falla del equipo" error={err.falla} req full hint="¿Qué le ocurre al equipo según el cliente?">
              <textarea
                value={f.falla}
                rows={3}
                style={{ fontSize: 14 }}
                placeholder="Ej. No enciende, pantalla azul, recalienta y se apaga de golpe, formateo y mantenimiento..."
                onChange={(e) => set('falla', e.target.value)}
              />
            </Campo>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <Campo label="Accesorios que deja / Nota de ingreso" full hint="Cargador, cables, funda, etc.">
              {texto('equipo.accOtros', f.equipo.accOtros, 'Ej. Trae cargador original y funda negra')}
            </Campo>
          </div>
        </fieldset>

        {/* 3. PRESUPUESTO, ADELANTO Y CAJA */}
        <fieldset>
          <legend><span className="n">3</span>Presupuesto, Adelanto y Caja</legend>
          <div className="two-col">
            <Campo label="Presupuesto estimado (S/.)" error={err.mo} hint="Deja vacío si está por cotizar">
              {numero(f.costo.mo, (v) => set('costo.mo', v))}
            </Campo>
            <Campo label="Técnico asignado">
              <select value={f.tecnico} onChange={(e) => set('tecnico', e.target.value)}>
                <option value="">Sin asignar</option>
                {[...new Set([...cfg.tecnicos, ...(f.tecnico ? [f.tecnico] : [])])].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Campo>
          </div>

          {!orig && (
            <div className="row" style={{ marginTop: 14 }}>
              <Campo label="Adelanto a cobrar (S/.)" error={err.adel} hint="Deja 0 si no abona">
                {numero(adelanto.monto, (v) => setAdelanto({ ...adelanto, monto: v }))}
              </Campo>

              <div className="f">
                <span className="req">Método de pago (Caja)</span>
                <div className="seg" role="group" aria-label="Método de pago">
                  {METODOS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={adelanto.metodo === m}
                      onClick={() => setAdelanto({ ...adelanto, metodo: m })}
                    >
                      {m === 'Yape 1' ? 'Yape 1 (Edgar)' : m === 'Yape 2' ? 'Yape 2 (Caja)' : 'Efectivo'}
                    </button>
                  ))}
                </div>
              </div>

              {esYape(adelanto.metodo) && (
                <Campo label={'N° de operación ' + adelanto.metodo} error={err.op} req={adel > 0} hint="Del comprobante">
                  <input
                    value={adelanto.op}
                    inputMode="numeric"
                    placeholder={'N° de op. ' + adelanto.metodo}
                    onChange={(e) => setAdelanto({ ...adelanto, op: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                  />
                </Campo>
              )}
            </div>
          )}

          {adel > 0 && !orig && (
            <div className="banner ok" style={{ marginTop: 12, padding: 10 }}>
              <Ic n="check" s={16} />
              <span style={{ fontSize: 12.5 }}>
                ✓ Al confirmar, se ingresará automáticamente <b>{money(adel)}</b> a Caja Chica bajo <b>{normalizarMetodo(adelanto.metodo)}</b> con la descripción del servicio técnico.
              </span>
            </div>
          )}

          <div className="sumbox" style={{ marginTop: 14 }}>
            <div><span>Total</span><b>{t > 0 ? money(t) : 'Por cotizar'}</b></div>
            <div><span>Pagado</span><b>{money(yaPagado)}</b></div>
            <div><span>Pendiente</span><b style={{ color: 'var(--bad)' }}>{money(Math.max(0, t - yaPagado))}</b></div>
          </div>
        </fieldset>

        <div className="form-foot">
          <button type="button" className="btn" onClick={volver}>Cancelar</button>
          <button type="submit" className="btn pri" disabled={ocupado}>
            <Ic n="check" s={17} />
            {ocupado ? 'Procesando…' : orig ? 'Guardar cambios' : 'Registrar servicio técnico'}
          </button>
        </div>
      </form>

      {/* MODAL DE CONFIRMACIÓN ANTES DE REGISTRAR */}
      {confirmando && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Confirmar servicio técnico" onClick={(e) => { if (e.target === e.currentTarget && !ocupado) setConfirmando(false); }}>
          <div className="card" style={{ maxWidth: 540 }}>
            <div className="pad modal-h">
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Confirmar recepción de servicio técnico</h3>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12.5 }}>
                  Orden <b>{code(cfg, orig ? orig.num : cfg.next)}</b> · Revisa los datos antes de ingresar a Caja
                </p>
              </div>
              <button type="button" className="btn icon" onClick={() => setConfirmando(false)} disabled={ocupado}>
                <Ic n="x" s={18} />
              </button>
            </div>

            <div className="pad stack" style={{ gap: 12 }}>
              {/* Cliente */}
              <div style={{ background: 'var(--bg-sub, #f8fafc)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Cliente</span>
                <p style={{ margin: '2px 0 0', fontWeight: 800, fontSize: 14 }}>{f.cliente.nombre}</p>
                {f.cliente.cel && (
                  <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--muted)' }}>WhatsApp: {f.cliente.cel}</p>
                )}
              </div>

              {/* Equipo & Problema */}
              <div style={{ background: 'var(--bg-sub, #f8fafc)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Equipo & Problema reportado</span>
                <p style={{ margin: '2px 0 0', fontWeight: 800, fontSize: 13.5 }}>
                  {f.equipo.tipo} {f.equipo.marca} {f.equipo.modelo}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg)', fontStyle: 'italic', fontWeight: 600 }}>
                  “{f.falla}”
                </p>
              </div>

              {/* Totales y Adelanto */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Presupuesto</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 800, fontSize: 16 }}>{t > 0 ? money(t) : 'Por cotizar'}</p>
                </div>
                <div style={{ padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Adelanto a Cobrar</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 800, fontSize: 16, color: adel > 0 ? 'var(--ok, #16a34a)' : 'var(--muted)' }}>
                    {adel > 0 ? money(adel) : 'Sin adelanto'}
                  </p>
                </div>
              </div>

              {/* Sincronización a Caja */}
              {adel > 0 ? (
                <div className="banner ok" style={{ margin: 0, padding: 12 }}>
                  <Ic n="check" s={18} />
                  <span style={{ fontSize: 12.5 }}>
                    <b>✓ Ingreso a Caja Chica:</b> Se creará un movimiento por <b>{money(adel)}</b> bajo <b>{normalizarMetodo(adelanto.metodo)}</b>{adelanto.op ? ` (Op. #${adelanto.op})` : ''} con la descripción <i>Servicio Técnico {code(cfg, orig ? orig.num : cfg.next)} — {f.cliente.nombre}</i>.
                  </span>
                </div>
              ) : (
                <div className="banner info" style={{ margin: 0, padding: 12 }}>
                  <Ic n="clip" s={18} />
                  <span style={{ fontSize: 12.5 }}>
                    <b>Sin ingreso a Caja:</b> La orden se registrará con saldo pendiente total de <b>{t > 0 ? money(t) : 'S/. 0.00'}</b>.
                  </span>
                </div>
              )}
            </div>

            <div className="pad modal-f" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--line)' }}>
              <button type="button" className="btn" onClick={() => setConfirmando(false)} disabled={ocupado}>
                Corregir
              </button>
              <button type="button" className="btn pri" onClick={ejecutarGuardar} disabled={ocupado}>
                <Ic n="check" s={16} />
                {ocupado ? 'Registrando…' : orig ? 'Confirmar y Guardar' : 'Confirmar y Registrar Servicio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
