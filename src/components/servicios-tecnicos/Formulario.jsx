/* Formulario para registrar un servicio nuevo o editar uno existente. */
import { useMemo, useState } from 'react';
import { Ic, Fotos } from './ui';
import {
  TIPOS, ACCS, CHECKS, MARCAS, METODOS, clienteKey, code, money, pagado, parseD, toLocal, validarDatos,
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

/* Campo con etiqueta, mensaje de error o ayuda. Va fuera del formulario para que los inputs no pierdan el foco. */
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

  const guardar = async (ev) => {
    ev.preventDefault();
    const e = validarDatos(f, { nuevo: !orig, adelanto: orig ? null : adelanto });
    setErr(e);
    if (Object.keys(e).length) {
      flash('Revisa los campos marcados en rojo');
      setTimeout(() => document.querySelector('.st-root .has-err input, .st-root .has-err textarea')?.focus(), 0);
      return;
    }
    const datos = { ...f, fecha: new Date(f.fecha).toISOString() };
    if (orig) await acciones.editar(orig.id, datos);
    else await acciones.crear(datos, adel > 0 ? adelanto : null);
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
          <h2>{orig ? 'Editar servicio ' + code(cfg, orig.num) : 'Nuevo servicio'}</h2>
          <p>{orig ? 'Corrige los datos. Los pagos y las etapas se cambian desde el detalle del servicio.' : 'Llena los datos mientras recibes el equipo. Este servicio será el ' + code(cfg, cfg.next) + '.'}</p>
        </div>
        <button type="button" className="btn" onClick={volver}><Ic n="back" s={16} />Volver</button>
      </div>

      <form className="card form" onSubmit={guardar} autoComplete="off" noValidate>
        <fieldset>
          <legend><span className="n">1</span>Cliente</legend>
          <div className="row">
            <Campo label="DNI" error={err.dni} hint="Si ya vino antes, se completan sus datos">{digitos('cliente.dni', c.dni, 8, '8 dígitos')}</Campo>
            <Campo label="RUC (si es empresa)" error={err.ruc}>{digitos('cliente.ruc', c.ruc, 11, 'Opcional')}</Campo>
            <Campo label="Nombre y apellidos / razón social" error={err.nombre} req>{texto('cliente.nombre', c.nombre, 'Ej. Flores Quispe, María')}</Campo>
            <Campo label="Celular" error={err.cel} req>{digitos('cliente.cel', c.cel, 9, '9XXXXXXXX')}</Campo>
          </div>
          {match && !yaUsado && (
            <div className="found">
              <span><Ic n="users" s={16} /> Cliente registrado: <b>{match.nombre}</b> · {match.n} servicio{match.n > 1 ? 's' : ''} anterior{match.n > 1 ? 'es' : ''}</span>
              <button type="button" className="btn sm" onClick={() => set('cliente', { nombre: match.nombre, dni: match.dni || c.dni, ruc: match.ruc || c.ruc, cel: match.cel })}>Usar sus datos</button>
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend><span className="n">2</span>Equipo</legend>
          <div className="seg" role="group" aria-label="Tipo de equipo" style={{ marginBottom: 14 }}>
            {TIPOS.map((x) => <button key={x} type="button" aria-pressed={f.equipo.tipo === x} onClick={() => set('equipo.tipo', x)}>{x}</button>)}
          </div>
          <div className="row">
            <Campo label="Marca" error={err.marca} req>{texto('equipo.marca', f.equipo.marca, 'HP, Lenovo, Epson…', { list: 'st-marcas' })}</Campo>
            <Campo label="Modelo" error={err.modelo}>{texto('equipo.modelo', f.equipo.modelo, 'Ej. IdeaPad 3')}</Campo>
            <Campo label="N° de serie" error={err.serie}>{texto('equipo.serie', f.equipo.serie, 'S/N de la etiqueta')}</Campo>
            <Campo label="Contraseña / PIN" error={err.clave} hint="Para que el técnico pueda probar el equipo">{texto('equipo.clave', f.equipo.clave, 'Opcional')}</Campo>
          </div>
          <datalist id="st-marcas">{MARCAS.map((m) => <option key={m} value={m} />)}</datalist>
          <div className="f" style={{ marginTop: 14 }}>
            <span>Accesorios que deja</span>
            <div className="checks">
              {ACCS.map((a) => <label key={a}><input type="checkbox" checked={f.equipo.acc.includes(a)} onChange={() => alternar('equipo.acc', a)} />{a}</label>)}
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <Campo label="Otros accesorios" error={err.accOtros}>{texto('equipo.accOtros', f.equipo.accOtros, 'Opcional')}</Campo>
          </div>
        </fieldset>

        <fieldset>
          <legend><span className="n">3</span>Estado en que llega</legend>
          <div className="f">
            <span>¿Enciende?</span>
            <div className="seg" role="group" aria-label="Enciende">
              {[['si', 'Sí enciende'], ['no', 'No enciende'], ['nd', 'No se probó']].map(([k, l]) => (
                <button key={k} type="button" aria-pressed={f.llegada.enciende === k} onClick={() => set('llegada.enciende', k)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="f" style={{ marginTop: 14 }}>
            <span>Daños visibles</span>
            <div className="checks">
              {CHECKS.map((a) => <label key={a}><input type="checkbox" checked={f.llegada.checks.includes(a)} onChange={() => alternar('llegada.checks', a)} />{a}</label>)}
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <Campo label="Observaciones" error={err.obs}>{texto('llegada.obs', f.llegada.obs, 'Ej. Rayones en la tapa, bisagra derecha floja')}</Campo>
          </div>
          <div className="f" style={{ marginTop: 14 }}>
            <span>Fotos de cómo llegó</span>
            <Fotos fotos={f.fotos.ingreso} onChange={(v) => set('fotos.ingreso', v)} onOpen={openLb} label="Ingreso" flash={flash} subir={acciones.subirFoto} />
            <span className="hint">Toma fotos de los lados, la pantalla y cualquier golpe. Te protegen ante reclamos.</span>
          </div>
        </fieldset>

        <fieldset>
          <legend><span className="n">4</span>Falla, diagnóstico y técnico</legend>
          <div className="row">
            <Campo label="Falla que reporta el cliente" error={err.falla} req full hint="Lo que dice el cliente, con sus palabras">
              <textarea value={f.falla} placeholder="Ej. No prende, se apagó de golpe" onChange={(e) => set('falla', e.target.value)} />
            </Campo>
          </div>
          <div className="two-col" style={{ marginTop: 12 }}>
            <Campo label="Diagnóstico del dispositivo" error={err.diagnostico} hint="Lo que el técnico encontró. Si aún no lo revisa, se llena después.">
              <textarea value={f.diagnostico} placeholder="Ej. Fuente de poder quemada" onChange={(e) => set('diagnostico', e.target.value)} />
            </Campo>
            <Campo label="Solución del diagnóstico" error={err.solucion} hint="Lo que se le hará o se le hizo al equipo">
              <textarea value={f.solucion} placeholder="Ej. Cambio de fuente y mantenimiento interno" onChange={(e) => set('solucion', e.target.value)} />
            </Campo>
          </div>
          <div className="two-col" style={{ marginTop: 12 }}>
            <Campo label="Fecha y hora de recepción" error={err.fecha} req>
              <input type="datetime-local" value={f.fecha} onChange={(e) => set('fecha', e.target.value)} />
            </Campo>
            <Campo label="Técnico asignado" error={err.tecnico}>
              <select value={f.tecnico} onChange={(e) => set('tecnico', e.target.value)}>
                <option value="">Sin asignar</option>
                {[...new Set([...cfg.tecnicos, ...(f.tecnico ? [f.tecnico] : [])])].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Campo>
          </div>
          <div className="checks" style={{ marginTop: 12 }}>
            <label><input type="checkbox" checked={!!f.urgente} onChange={(e) => set('urgente', e.target.checked)} />Es urgente: se atiende primero</label>
          </div>
        </fieldset>

        <fieldset>
          <legend><span className="n">5</span>{orig ? 'Costo' : 'Costo y adelanto'}</legend>
          <div className="row">
            <Campo label="Mano de obra (S/.)" error={err.mo} hint="Déjalo vacío si aún no se cotiza">{numero(f.costo.mo, (v) => set('costo.mo', v))}</Campo>
            <Campo label="Repuestos (S/.)" error={err.rep}>{numero(f.costo.rep, (v) => set('costo.rep', v))}</Campo>
          </div>
          {!orig && (
            <div className="row" style={{ marginTop: 12 }}>
              <Campo label="Adelanto (S/.)" error={err.adel} hint="Opcional">{numero(adelanto.monto, (v) => setAdelanto({ ...adelanto, monto: v }))}</Campo>
              <div className="f">
                <span>Método de pago</span>
                <div className="seg" role="group" aria-label="Método de pago">
                  {METODOS.map((m) => <button key={m} type="button" aria-pressed={adelanto.metodo === m} onClick={() => setAdelanto({ ...adelanto, metodo: m })}>{m}</button>)}
                </div>
              </div>
              {adelanto.metodo === 'Yape' && (
                <Campo label="N° de operación Yape" error={err.op} req={adel > 0}>
                  <input value={adelanto.op} inputMode="numeric" placeholder="Del comprobante de Yape" onChange={(e) => setAdelanto({ ...adelanto, op: e.target.value.replace(/\D/g, '').slice(0, 12) })} />
                </Campo>
              )}
            </div>
          )}
          <div className="sumbox">
            <div><span>Total</span><b>{t > 0 ? money(t) : 'Por cotizar'}</b></div>
            <div><span>Pagado</span><b>{money(yaPagado)}</b></div>
            <div><span>Pendiente</span><b style={{ color: 'var(--bad)' }}>{money(Math.max(0, t - yaPagado))}</b></div>
          </div>
        </fieldset>

        <div className="form-foot">
          <button type="button" className="btn" onClick={volver}>Cancelar</button>
          <button type="submit" className="btn pri" disabled={ocupado}><Ic n="check" s={17} />{ocupado ? 'Guardando…' : orig ? 'Guardar cambios' : 'Registrar servicio'}</button>
        </div>
      </form>
    </section>
  );
}
