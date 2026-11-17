/* Formulario simplificado y optimizado para registrar o editar un servicio técnico.
   Mantiene solo los apartados principales y de mayor relevancia, con sincronización
   automática a Caja (Efectivo, Yape 1, Yape 2) y modal de confirmación antes de guardar. */
import { useMemo, useState } from 'react';
import { Ic, Fotos } from './ui';
import {
  TIPOS, ACCS, CHECKS, MARCAS, METODOS, esYape, clienteKey, code, money, pagado, parseD, toLocal, validarDatos,
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

export default function Formulario({ cfg, servicios, editId, acciones, ir, abrir, flash, openLb, ocupado }) {
  const orig = editId ? servicios.find((s) => s.id === editId) : null;
  const [f, setF] = useState(() => (orig
    ? { ...copia(orig), diagnostico: orig.diagnostico || '', solucion: orig.solucion || '', fecha: toLocal(parseD(orig.fecha)), costo: { mo: orig.costo.mo || '', rep: orig.costo.rep || '' } }
    : vacio(cfg)));
  const [adelanto, setAdelanto] = useState({ monto: '', metodo: 'Efectivo', op: '' });
  const [err, setErr] = useState({});
  const [verMasOpciones, setVerMasOpciones] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const set = (ruta, val) => setF((o) => {
    const n = copia(o); let x = n; const ks = ruta.split('.');
    ks.slice(0, -1).forEach((k) => { x = x[k]; });
    x[ks[ks.length - 1]] = val;
    return n;
  });
  const alternar = (ruta, v) => { const arr = ruta.split('.').reduce((o, k) => o[k], f); set(ruta, arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]); };

  /* Clientes ya registrados, para autocompletar por DNI, RUC o celular. */
  const clientes = useMemo(() => {
    const m = {};
    [...servicios].sort((a, b) => a.num - b.num).forEach((s) => {
      const k = clienteKey(s.cliente); if (!k) return;
      m[k] = { ...(m[k] || { n: 0 }), ...s.cliente, n: (m[k]?.n || 0) + 1 };
    });
    return m;
  }, [servicios]);
  const c = f.cliente;
  const match = !orig && ((c.dni.length === 8 && clientes[c.dni]) || (c.ruc.length === 11 && clientes[c.ruc]) || (c.cel.length === 9 && Object.values(clientes).find((x) => x.cel === c.cel)));
  const yaUsado = match && match.nombre === c.nombre && match.cel === c.cel;

  const t = (+f.costo.mo || 0) + (+f.costo.rep || 0);
  const adel = orig ? 0 : +adelanto.monto || 0;
  const yaPagado = orig ? pagado(orig) : adel;

  /* Valida y si todo está correcto, abre el modal de confirmación */
  const solicitarGuardar = (ev) => {
    ev.preventDefault();
    const e = validarDatos(f, { nuevo: !orig, adelanto: orig ? null : adelanto });
    setErr(e);
    if (Object.keys(e).length) {
      flash('Revisa los campos obligatorios en rojo');
      setTimeout(() => document.querySelector('.st-root .has-err input, .st-root .has-err textarea')?.focus(), 0);
      return;
    }
    setConfirmando(true);
  };

  /* Ejecución real una vez confirmado en el modal */
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
          <p>{orig ? 'Corrige los datos del servicio. Los pagos y etapas se gestionan desde el detalle.' : 'Llena los datos esenciales de recepción. Este servicio será el ' + code(cfg, cfg.next) + '.'}</p>
        </div>
        <button type="button" className="btn" onClick={volver}><Ic n="back" s={16} />Volver</button>
      </div>

      <form className="card form" onSubmit={solicitarGuardar} autoComplete="off" noValidate>
        {/* 1. DATOS DEL CLIENTE */}
        <fieldset>
          <legend><span className="n">1</span>Cliente</legend>
          <div className="row">
            <Campo label="Nombre y apellidos / razón social" error={err.nombre} req full>
              {texto('cliente.nombre', c.nombre, 'Ej. Flores Quispe, María')}
            </Campo>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <Campo label="Celular (WhatsApp)" error={err.cel} req hint="9 dígitos">
              {digitos('cliente.cel', c.cel, 9, '9XXXXXXXX')}
            </Campo>
            <Campo label="DNI" error={err.dni} hint="8 dígitos (opcional)">
              {digitos('cliente.dni', c.dni, 8, '8 dígitos')}
            </Campo>
            <Campo label="RUC (si es empresa)" error={err.ruc} hint="Opcional">
              {digitos('cliente.ruc', c.ruc, 11, '11 dígitos')}
            </Campo>
          </div>
          {match && !yaUsado && (
            <div className="found" style={{ marginTop: 10 }}>
              <span><Ic n="users" s={16} /> Cliente registrado: <b>{match.nombre}</b> · {match.n} servicio{match.n > 1 ? 's' : ''} anterior{match.n > 1 ? 'es' : ''}</span>
              <button type="button" className="btn sm" onClick={() => set('cliente', { nombre: match.nombre, dni: match.dni || c.dni, ruc: match.ruc || c.ruc, cel: match.cel })}>Usar sus datos</button>
            </div>
          )}
        </fieldset>

        {/* 2. EQUIPO Y FALLA REPORTADA */}
        <fieldset>
          <legend><span className="n">2</span>Equipo y Falla reportada</legend>
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
            <Campo label="Marca" error={err.marca} req>
              {texto('equipo.marca', f.equipo.marca, 'HP, Lenovo, Epson…', { list: 'st-marcas' })}
            </Campo>
            <Campo label="Modelo" error={err.modelo}>
              {texto('equipo.modelo', f.equipo.modelo, 'Ej. IdeaPad 3, Core i5')}
            </Campo>
            <Campo label="Contraseña / PIN de desbloqueo" error={err.clave} hint="Para probar el equipo">
              {texto('equipo.clave', f.equipo.clave, 'Opcional')}
            </Campo>
          </div>
          <datalist id="st-marcas">{MARCAS.map((m) => <option key={m} value={m} />)}</datalist>

          {/* Falla que reporta el cliente (campo clave) */}
          <div className="row" style={{ marginTop: 12 }}>
            <Campo label="Falla que reporta el cliente" error={err.falla} req full hint="Lo que indica el cliente (ej. No prende, pantalla azul, recalienta y se apaga)">
              <textarea value={f.falla} rows={2} placeholder="Ej. No prende, se apagó de golpe mientras trabajaba" onChange={(e) => set('falla', e.target.value)} />
            </Campo>
          </div>

          {/* Accesorios y si enciende */}
          <div className="two-col" style={{ marginTop: 12 }}>
            <div className="f">
              <span>¿Enciende el equipo?</span>
              <div className="seg" role="group" aria-label="Enciende">
                {[['si', 'Sí enciende'], ['no', 'No enciende'], ['nd', 'No se probó']].map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={f.llegada.enciende === k} onClick={() => set('llegada.enciende', k)}>{l}</button>
                ))}
              </div>
            </div>
            <Campo label="Otros accesorios / observaciones de equipo" error={err.accOtros}>
              {texto('equipo.accOtros', f.equipo.accOtros, 'Ej. Cargador original, funda')}
            </Campo>
          </div>

          <div className="f" style={{ marginTop: 12 }}>
            <span>Accesorios que deja:</span>
            <div className="checks">
              {ACCS.slice(0, 5).map((a) => (
                <label key={a}>
                  <input type="checkbox" checked={f.equipo.acc.includes(a)} onChange={() => alternar('equipo.acc', a)} />
                  {a}
                </label>
              ))}
            </div>
          </div>

          {/* Botón para desplegar fotos y observaciones si se desean registrar */}
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn sm"
              style={{ fontSize: 12, borderStyle: 'dashed' }}
              onClick={() => setVerMasOpciones(!verMasOpciones)}
            >
              <Ic n={verMasOpciones ? 'chevron-up' : 'chevron-down'} s={14} />
              {verMasOpciones ? 'Ocultar fotos y detalles adicionales' : '+ Agregar fotos o detalles de ingreso (opcional)'}
            </button>
          </div>

          {verMasOpciones && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--line)' }} className="stack">
              <div className="row">
                <Campo label="N° de serie (S/N)" error={err.serie}>
                  {texto('equipo.serie', f.equipo.serie, 'S/N de la etiqueta')}
                </Campo>
                <Campo label="Observaciones de golpes / estado físico" error={err.obs}>
                  {texto('llegada.obs', f.llegada.obs, 'Ej. Rayones en tapa, bisagra floja')}
                </Campo>
              </div>
              <div className="f" style={{ marginTop: 8 }}>
                <span>Fotos de cómo llegó el equipo</span>
                <Fotos fotos={f.fotos.ingreso} onChange={(v) => set('fotos.ingreso', v)} onOpen={openLb} label="Ingreso" flash={flash} subir={acciones.subirFoto} />
              </div>
            </div>
          )}
        </fieldset>

        {/* 3. PRESUPUESTO, ADELANTO Y CAJA */}
        <fieldset>
          <legend><span className="n">3</span>Presupuesto, Adelanto y Caja</legend>
          <div className="row">
            <Campo label="Presupuesto / Mano de obra (S/.)" error={err.mo} hint="Déjalo vacío si aún está por cotizar">
              {numero(f.costo.mo, (v) => set('costo.mo', v))}
            </Campo>
            <Campo label="Repuestos estimados (S/.)" error={err.rep} hint="Opcional">
              {numero(f.costo.rep, (v) => set('costo.rep', v))}
            </Campo>
            <Campo label="Técnico asignado" error={err.tecnico}>
              <select value={f.tecnico} onChange={(e) => set('tecnico', e.target.value)}>
                <option value="">Sin asignar</option>
                {[...new Set([...cfg.tecnicos, ...(f.tecnico ? [f.tecnico] : [])])].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Campo>
          </div>

          {!orig && (
            <div className="row" style={{ marginTop: 14 }}>
              <Campo label="Adelanto cobrado (S/.)" error={err.adel} hint="Deja 0 si no abona">
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
                <Campo label={'N° de operación ' + adelanto.metodo} error={err.op} req={adel > 0} hint="Del comprobante de Yape">
                  <input
                    value={adelanto.op}
                    inputMode="numeric"
                    placeholder={'N° de operación ' + adelanto.metodo}
                    onChange={(e) => setAdelanto({ ...adelanto, op: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                  />
                </Campo>
              )}
            </div>
          )}

          {adel > 0 && !orig && (
            <div className="banner ok" style={{ marginTop: 12, padding: 10 }}>
              <Ic n="check" s={16} />
              <span style={{ fontSize: 12 }}>
                ✓ Al registrar, se enviará automáticamente un <b>INGRESO de {money(adel)}</b> a Caja Chica bajo <b>{normalizarMetodo(adelanto.metodo)}</b> con la descripción del servicio técnico.
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
            {ocupado ? 'Procesando…' : orig ? 'Guardar cambios' : 'Registrar servicio'}
          </button>
        </div>
      </form>

      {/* MODAL DE CONFIRMACIÓN OBLIGATORIO ANTES DE GUARDAR */}
      {confirmando && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Confirmar servicio técnico" onClick={(e) => { if (e.target === e.currentTarget && !ocupado) setConfirmando(false); }}>
          <div className="card" style={{ maxWidth: 560 }}>
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

            <div className="pad stack" style={{ gap: 14 }}>
              {/* Cliente */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--bg-sub, #f8fafc)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Cliente</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 800, fontSize: 14 }}>{f.cliente.nombre}</p>
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Contacto</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 13.5 }}>
                    Cel: {f.cliente.cel} {f.cliente.dni ? `· DNI: ${f.cliente.dni}` : ''}
                  </p>
                </div>
              </div>

              {/* Equipo & Falla */}
              <div style={{ background: 'var(--bg-sub, #f8fafc)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Equipo & Falla</span>
                <p style={{ margin: '2px 0 0', fontWeight: 800, fontSize: 13.5 }}>
                  {f.equipo.tipo} {f.equipo.marca} {f.equipo.modelo} {f.equipo.clave ? `(PIN: ${f.equipo.clave})` : ''}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--fg)', fontStyle: 'italic' }}>
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
                    <b>✓ Ingreso automático a Caja Chica:</b> Se creará un movimiento por <b>{money(adel)}</b> bajo <b>{normalizarMetodo(adelanto.metodo)}</b>{adelanto.op ? ` (Op. #${adelanto.op})` : ''} con la descripción <i>Servicio Técnico {code(cfg, orig ? orig.num : cfg.next)} — {f.cliente.nombre}</i>.
                  </span>
                </div>
              ) : (
                <div className="banner info" style={{ margin: 0, padding: 12 }}>
                  <Ic n="clip" s={18} />
                  <span style={{ fontSize: 12.5 }}>
                    <b>Sin ingreso a Caja:</b> La orden se registrará con saldo pendiente total de <b>{t > 0 ? money(t) : 'S/. 0.00'}</b>. No generará movimiento en Caja hasta que se registre un cobro.
                  </span>
                </div>
              )}
            </div>

            <div className="pad modal-f" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--line)' }}>
              <button type="button" className="btn" onClick={() => setConfirmando(false)} disabled={ocupado}>
                Corregir datos
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
