/* Detalle de un servicio: avance, diagnóstico, pagos, fotos, historial y entrega. */
import { useEffect, useState } from 'react';
import { Ic, EtapaPill, PagoPill, AlertaPill, UrgPill, Fotos } from './ui';
import {
  ETAPAS, ETQ, SIG, PRUEBAS, METODOS, AVISO_TXT, alerta, avisoBase, clienteKey, code, fCorta, fDia, fHora,
  garantiaHasta, mensaje, money, nombreCorto, pagado, pendiente, total, waLink,
} from '../../lib/servicios-tecnicos/logic';

const SIG_TXT = (s, sig) => ({
  diagnostico: 'Pasar a diagnóstico',
  reparacion: s.etapa === 'repuesto' ? 'Continuar reparación' : 'Pasar a reparación',
  listo: 'Marcar como listo',
  entregado: s.etapa === 'noreparable' ? 'Devolver al cliente' : 'Entregar al cliente',
}[sig]);

export default function Detalle({ s, cfg, acciones, ir, flash, openLb, recien, entregar, servicios, abrir, ocupado }) {
  const [entOpen, setEntOpen] = useState(!!entregar && (s.etapa === 'listo' || s.etapa === 'noreparable'));
  const [dx, setDx] = useState({ diagnostico: s.diagnostico || '', solucion: s.solucion || '' });
  const [co, setCo] = useState({ mo: s.costo.mo || '', rep: s.costo.rep || '' });
  const [np, setNp] = useState({ monto: '', metodo: 'Efectivo', op: '' });
  const [npErr, setNpErr] = useState('');
  const [nota, setNota] = useState('');
  const [borrar, setBorrar] = useState(false);
  const [quitarP, setQuitarP] = useState(null);

  const a = alerta(s, cfg), t = total(s), pg = pagado(s), pend = pendiente(s), gh = garantiaHasta(s, cfg), av = avisoBase(s);
  const idx = s.etapa === 'noreparable' ? 1 : ETAPAS.findIndex((e) => e.k === s.etapa);
  const fechaEtapa = (k) => { const h = [...(s.hist || [])].reverse().find((x) => x.e === k); return h ? h.t : null; };
  const sig = SIG[s.etapa];
  const dxSucio = dx.diagnostico !== (s.diagnostico || '') || dx.solucion !== (s.solucion || '');
  const coSucio = String(co.mo) !== String(s.costo.mo || '') || String(co.rep) !== String(s.costo.rep || '');
  const notaPago = pg === 0 ? 'Adelanto' : (+np.monto >= pend && pend > 0 ? 'Pago final' : 'Pago parcial');
  const historialCliente = servicios.filter((x) => x.id !== s.id && clienteKey(x.cliente) === clienteKey(s.cliente));
  const rec = s.entrega && s.entrega.recoge;

  const cambiar = (k) => {
    if (k === s.etapa || ocupado) return;
    if (k === 'entregado') { setEntOpen(true); return; }
    acciones.accion(s.id, 'etapa', { etapa: k }, 'Etapa: ' + ETQ[k]);
  };
  const regPago = async (e) => {
    e.preventDefault();
    const m = +np.monto;
    if (!(m > 0)) return setNpErr('Escribe un monto mayor a 0');
    if (t > 0 && m > pend + 0.001) return setNpErr('El monto es mayor a lo pendiente (' + money(pend) + ')');
    if (np.metodo === 'Yape' && !/^\d{6,}$/.test(np.op)) return setNpErr('Escribe el N° de operación de Yape');
    setNpErr('');
    const ok = await acciones.accion(s.id, 'pago', { pago: { monto: m, metodo: np.metodo, op: np.op, nota: notaPago } }, 'Pago de ' + money(m) + ' registrado');
    if (ok) setNp({ monto: '', metodo: np.metodo, op: '' });
  };
  const WaBtn = ({ tipo, children }) => (
    <a className="btn sm wa" href={waLink(s.cliente.cel, mensaje(tipo, s, cfg))} target="_blank" rel="noopener noreferrer" onClick={() => acciones.aviso(s.id, tipo)}>
      <Ic n="wa" s={15} />{children}
    </a>
  );

  return (
    <section>
      <div className="det-head">
        <div style={{ minWidth: 0 }}>
          <button type="button" className="btn sm ghost" style={{ marginLeft: -10, marginBottom: 6 }} onClick={() => ir('servicios')}><Ic n="back" s={15} />Todos los servicios</button>
          <div className="pills-row">
            <span className="code">{code(cfg, s.num)}</span>
            {s.urgente && s.etapa !== 'entregado' && <UrgPill />}
            <EtapaPill k={s.etapa} /><PagoPill s={s} /><AlertaPill a={a} />
          </div>
          <h2 className="det-nombre">{s.cliente.nombre}</h2>
          <p className="muted" style={{ margin: '2px 0 0' }}>{s.equipo.tipo} {s.equipo.marca} {s.equipo.modelo} · recibido el {fHora(s.fecha)}</p>
        </div>
        <div className="acts-row">
          <button type="button" className="btn" onClick={() => ir('nuevo', { editId: s.id })}><Ic n="edit" s={16} />Editar datos</button>
          {sig && <button type="button" className="btn pri" disabled={ocupado} onClick={() => cambiar(sig)}><Ic n="arrow" s={16} />{SIG_TXT(s, sig)}</button>}
        </div>
      </div>

      <div className="stack" style={{ marginBottom: 16 }}>
        {recien && s.etapa === 'recibido' && (
          <div className="banner ok"><Ic n="check" s={18} />
            <span><b>Servicio {code(cfg, s.num)} registrado.</b> Envíale el comprobante al cliente por WhatsApp.</span>
            <span className="acts"><WaBtn tipo="recibido">Enviar comprobante</WaBtn></span>
          </div>
        )}
        {a && a.tipo === 'sinaviso' && (
          <div className="banner info"><Ic n="wa" s={18} />
            <span>{s.etapa === 'noreparable' ? 'Se marcó como no reparable' : 'Está listo'} desde el <b>{fDia(s.fListo)}</b> y todavía no se le avisa al cliente. Los días para recoger cuentan desde el aviso.</span>
            <span className="acts"><WaBtn tipo={s.etapa === 'noreparable' ? 'noreparable' : 'listo'}>Avisar ahora</WaBtn></span>
          </div>
        )}
        {a && (a.tipo === 'recoger' || a.tipo === 'abandono') && (
          <div className={'banner ' + a.nivel}><Ic n="box" s={18} />
            <span>Se le avisó el <b>{fDia(av)}</b> y no recoge su equipo hace <b>{a.dias} días</b>.{a.nivel === 'bad' ? ' Ya pasó el plazo de ' + cfg.diasAbandono + ' días.' : ''}</span>
            <span className="acts"><WaBtn tipo="recoger">Recordarle</WaBtn></span>
          </div>
        )}
        {s.etapa === 'noreparable' && av && (
          <div className="banner bad"><Ic n="ban" s={18} /><span><b>No reparable.</b> Devuelve el equipo con el diagnóstico usando <b>Devolver al cliente</b>.</span></div>
        )}
      </div>

      <div className="det-grid">
        <div className="stack">
          <div className="card pad">
            <div className="box-h">
              <h3>Avance del equipo</h3>
              {s.etapa !== 'entregado' && s.etapa !== 'noreparable' && (
                <button type="button" className="btn sm danger" disabled={ocupado} onClick={() => cambiar('noreparable')}><Ic n="ban" s={14} />No tiene reparación</button>
              )}
            </div>
            <div className="steps">
              {ETAPAS.map((e, i) => {
                let st = s.etapa === 'noreparable' ? (i <= 1 ? 'done' : 'up') : s.etapa === 'entregado' || i < idx ? 'done' : i === idx ? 'cur' : 'up';
                const fe = fechaEtapa(e.k);
                if (st === 'done' && e.k === 'repuesto' && !fe) st = 'skip';
                return (
                  <button type="button" key={e.k} className={'step ' + st} onClick={() => cambiar(e.k)} title={'Cambiar a ' + e.l}>
                    <span className="dot">{st === 'skip' ? '–' : st === 'done' ? <Ic n="check" s={15} w={3} /> : i + 1}</span>
                    <span className="lb">{e.l}</span>
                    <span className="dt">{st === 'skip' ? 'No fue necesario' : fe && st !== 'up' ? fCorta(fe) : ''}</span>
                  </button>
                );
              })}
            </div>
            <p className="hint" style={{ margin: '14px 0 0' }}>Toca una etapa para moverlo ahí. Cada cambio queda en el historial con fecha y hora.</p>
          </div>

          <div className="card pad">
            <div className="box-h"><h3>Diagnóstico y solución</h3>{s.tecnico && <span className="muted" style={{ fontSize: 13 }}>Técnico: <b>{s.tecnico}</b></span>}</div>
            <div className="f" style={{ marginBottom: 12 }}><span>Falla que reportó el cliente</span><p className="quote">{s.falla}</p></div>
            <div className="two-col">
              <label className="f"><span>Diagnóstico del dispositivo</span>
                <textarea value={dx.diagnostico} placeholder="Qué tiene realmente el equipo" onChange={(e) => setDx({ ...dx, diagnostico: e.target.value })} /></label>
              <label className="f"><span>Solución del diagnóstico</span>
                <textarea value={dx.solucion} placeholder="Qué se le hizo: cambio de pieza, limpieza, instalación…" onChange={(e) => setDx({ ...dx, solucion: e.target.value })} /></label>
            </div>
            <div className="right" style={{ marginTop: 10 }}>
              <button type="button" className="btn sm pri" disabled={!dxSucio || ocupado} onClick={() => acciones.accion(s.id, 'diagnostico', dx)}>Guardar diagnóstico</button>
            </div>
          </div>

          <div className="card pad">
            <div className="box-h"><h3>Costo y pagos</h3><PagoPill s={s} /></div>
            <div className="row">
              <label className="f"><span>Mano de obra (S/.)</span><input type="number" min="0" step="0.5" value={co.mo} onChange={(e) => setCo({ ...co, mo: e.target.value })} /></label>
              <label className="f"><span>Repuestos (S/.)</span><input type="number" min="0" step="0.5" value={co.rep} onChange={(e) => setCo({ ...co, rep: e.target.value })} /></label>
              <div className="f" style={{ justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                <button type="button" className="btn sm" disabled={!coSucio || ocupado} onClick={() => acciones.accion(s.id, 'costo', co)}>Guardar costo</button>
              </div>
            </div>
            <div className="sumbox">
              <div><span>Total</span><b>{t > 0 ? money(t) : 'Por cotizar'}</b></div>
              <div><span>Pagado</span><b style={{ color: 'var(--ok)' }}>{money(pg)}</b></div>
              <div><span>Pendiente</span><b style={{ color: pend > 0 ? 'var(--bad)' : 'var(--muted)' }}>{money(pend)}</b></div>
            </div>
            <h3 style={{ margin: '18px 0 10px', fontSize: 14 }}>Pagos registrados</h3>
            {s.pagos.length ? (
              <div className="pagos">
                {s.pagos.map((p) => (
                  <div className="pago" key={p.id}>
                    <span className={'mt ' + (p.metodo === 'Yape' ? 'c-vio' : 'c-ok')}>{p.metodo === 'Yape' ? 'YP' : 'S/.'}</span>
                    <span style={{ minWidth: 0 }}>
                      <b>{p.nota || 'Pago'}</b> · {p.metodo}{p.op && <span className="mono muted" style={{ marginLeft: 6 }}>#{p.op}</span>}
                      <span className="muted small" style={{ display: 'block' }}>{fHora(p.fecha)}</span>
                    </span>
                    <b className="amt">{money(p.monto)}</b>
                    {quitarP === p.id
                      ? <button type="button" className="btn sm danger" onClick={() => { setQuitarP(null); acciones.accion(s.id, 'quitarPago', { pagoId: p.id }); }}>¿Quitar?</button>
                      : <button type="button" className="btn sm ghost" aria-label="Quitar pago" onClick={() => { setQuitarP(p.id); setTimeout(() => setQuitarP((x) => (x === p.id ? null : x)), 3000); }}><Ic n="trash" s={15} /></button>}
                  </div>
                ))}
              </div>
            ) : <p className="muted" style={{ margin: 0 }}>Todavía no hay pagos.</p>}
            {(pend > 0 || t === 0) && (
              <form onSubmit={regPago} className="nuevo-pago">
                <div className="row" style={{ alignItems: 'end' }}>
                  <label className="f"><span>Monto del {notaPago.toLowerCase()} (S/.)</span>
                    <input type="number" min="0" step="0.5" placeholder={pend > 0 ? pend.toFixed(2) : '0.00'} value={np.monto} onChange={(e) => setNp({ ...np, monto: e.target.value })} /></label>
                  <div className="f"><span>Método</span>
                    <div className="seg">{METODOS.map((m) => <button key={m} type="button" aria-pressed={np.metodo === m} onClick={() => setNp({ ...np, metodo: m })}>{m}</button>)}</div></div>
                  {np.metodo === 'Yape' && (
                    <label className="f"><span className="req">N° de operación</span>
                      <input inputMode="numeric" value={np.op} placeholder="Del comprobante" onChange={(e) => setNp({ ...np, op: e.target.value.replace(/\D/g, '').slice(0, 12) })} /></label>
                  )}
                  <div className="f" style={{ flexDirection: 'row', gap: 6 }}>
                    {pend > 0 && <button type="button" className="btn sm" onClick={() => setNp({ ...np, monto: pend.toFixed(2) })}>Todo</button>}
                    <button type="submit" className="btn sm pri" disabled={ocupado}><Ic n="plus" s={15} />Registrar pago</button>
                  </div>
                </div>
                {npErr && <p className="err" style={{ margin: '8px 0 0' }}>{npErr}</p>}
              </form>
            )}
            {pend > 0 && <div style={{ marginTop: 12 }}><WaBtn tipo="cobro">Recordar pago por WhatsApp</WaBtn></div>}
          </div>

          <div className="card pad">
            <div className="box-h"><h3>Datos de recepción</h3></div>
            <div className="dl">
              <div><span>N° de serie</span><p className="mono">{s.equipo.serie || '—'}</p></div>
              <div><span>Contraseña</span><p className="mono">{s.equipo.clave || '—'}</p></div>
              <div><span>Accesorios</span><p>{[...s.equipo.acc, s.equipo.accOtros].filter(Boolean).join(', ') || 'Ninguno'}</p></div>
              <div><span>Llegó</span><p>{{ si: 'Enciende', no: 'No enciende', nd: 'No se probó' }[s.llegada.enciende]}{s.llegada.checks.length ? ' · ' + s.llegada.checks.join(', ') : ''}</p></div>
              <div><span>Listo para entregar</span><p>{s.fListo ? fHora(s.fListo) : s.etapa === 'entregado' ? fHora(fechaEtapa('listo') || s.fEntregado) : 'Todavía en el taller'}</p></div>
              {s.llegada.obs && <div style={{ gridColumn: '1/-1' }}><span>Observaciones</span><p>{s.llegada.obs}</p></div>}
            </div>
            <div className="two-col" style={{ marginTop: 16 }}>
              <div className="f"><span>Fotos de ingreso</span>
                <Fotos fotos={s.fotos.ingreso} onChange={(v) => acciones.accion(s.id, 'fotos', { tipo: 'ingreso', fotos: v }, false)} onOpen={openLb} label={code(cfg, s.num) + ' · ingreso'} flash={flash} subir={acciones.subirFoto} /></div>
              <div className="f"><span>Fotos de entrega</span>
                <Fotos fotos={s.fotos.entrega} onChange={(v) => acciones.accion(s.id, 'fotos', { tipo: 'entrega', fotos: v }, false)} onOpen={openLb} label={code(cfg, s.num) + ' · entrega'} flash={flash} subir={acciones.subirFoto} />
                <span className="hint">Una foto del equipo funcionando al entregarlo sirve como prueba.</span></div>
            </div>
          </div>

          <div className="card pad">
            <h3 style={{ marginBottom: 12 }}>Historial y notas</h3>
            <form style={{ marginBottom: 16 }} onSubmit={async (e) => { e.preventDefault(); if (!nota.trim()) return; if (await acciones.accion(s.id, 'nota', { txt: nota.trim(), autor: s.tecnico })) setNota(''); }}>
              <label className="f"><span>Nota interna</span>
                <textarea rows={2} value={nota} placeholder="Ej. En espera: se pidió la pantalla al proveedor, llega el viernes" onChange={(e) => setNota(e.target.value)} /></label>
              <div className="right" style={{ marginTop: 8 }}><button type="submit" className="btn sm" disabled={!nota.trim() || ocupado}><Ic n="plus" s={15} />Agregar nota</button></div>
            </form>
            <Timeline s={s} />
          </div>

          <div className="right">
            {borrar ? (
              <div className="banner bad" style={{ width: '100%' }}><Ic n="trash" s={18} />
                <span>Se borrará el servicio {code(cfg, s.num)} con sus pagos y fotos. Esto no se puede deshacer.</span>
                <span className="acts"><button type="button" className="btn sm" onClick={() => setBorrar(false)}>Cancelar</button>
                  <button type="button" className="btn sm danger" disabled={ocupado} onClick={() => acciones.eliminar(s.id)}>Sí, eliminar</button></span>
              </div>
            ) : <button type="button" className="btn sm danger" onClick={() => setBorrar(true)}><Ic n="trash" s={15} />Eliminar servicio</button>}
          </div>
        </div>

        <aside className="stack det-side">
          <div className="card pad">
            <h3 style={{ marginBottom: 12 }}>Cliente</h3>
            <div className="dl one">
              <div><span>{s.cliente.ruc && !s.cliente.dni ? 'RUC' : 'DNI'}</span><p className="mono">{s.cliente.dni || s.cliente.ruc || '—'}</p></div>
              {s.cliente.dni && s.cliente.ruc && <div><span>RUC</span><p className="mono">{s.cliente.ruc}</p></div>}
              <div><span>Celular</span><p className="mono sel">{s.cliente.cel}</p></div>
            </div>
            <div className="f" style={{ marginTop: 14 }}><span>Otros servicios de este cliente</span>
              {historialCliente.length
                ? historialCliente.map((x) => (
                  <button type="button" className="mini" key={x.id} onClick={() => abrir(x.id)}>
                    <span className="nm2"><span className="mono">{code(cfg, x.num)}</span> · {x.equipo.tipo} {x.equipo.marca}</span><span className="muted">{fCorta(x.fecha)}</span>
                  </button>))
                : <p className="muted" style={{ margin: 0, fontWeight: 500 }}>Es su primer servicio.</p>}
            </div>
          </div>
          <div className="card pad">
            <h3 style={{ marginBottom: 10 }}>Avisar por WhatsApp</h3>
            <div className="wrap-row">
              <WaBtn tipo="recibido">Recibido</WaBtn>
              {s.etapa === 'listo' && <WaBtn tipo="listo">Ya está listo</WaBtn>}
              {s.etapa === 'noreparable' && <WaBtn tipo="noreparable">No reparable</WaBtn>}
              {pend > 0 && <WaBtn tipo="cobro">Pago pendiente</WaBtn>}
            </div>
            <p className="hint" style={{ margin: '10px 0 0' }}>Abre WhatsApp con el mensaje escrito. Cada aviso queda en el historial.</p>
          </div>
          <div className="card pad">
            <h3 style={{ marginBottom: 12 }}>Garantía</h3>
            {gh ? (
              <div className={'banner ' + (gh > new Date() ? 'ok' : 'info')}><Ic n="shield" s={18} />
                <span>{gh > new Date() ? 'Vigente hasta el ' : 'Venció el '}<b>{fDia(gh.toISOString())}</b> ({cfg.garantia} días).</span></div>
            ) : <p className="muted" style={{ margin: 0 }}>{s.etapa === 'entregado' ? 'Sin garantía: el equipo se devolvió sin reparar.' : 'Los ' + cfg.garantia + ' días de garantía empiezan a contar cuando se entregue.'}</p>}
            {s.etapa === 'entregado' && rec && (
              <div className="f" style={{ marginTop: 12 }}><span>Entrega</span>
                <p style={{ margin: 0, color: 'var(--fg)' }}>Recogió {rec.tipo === 'otro' ? rec.nombre + ' · DNI ' + rec.dni : 'el titular'} el {fHora(s.fEntregado)}</p>
                <p className="muted" style={{ margin: '2px 0 0', fontWeight: 500 }}>{s.entrega.pruebas.length ? 'Pruebas: ' + s.entrega.pruebas.join(', ') : 'No se marcaron pruebas de entrega.'}</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {entOpen && (
        <EntregaModal s={s} cfg={cfg} openLb={openLb} flash={flash} ocupado={ocupado} subir={acciones.subirFoto}
          onClose={() => setEntOpen(false)}
          onConfirm={async (d) => { if (await acciones.accion(s.id, 'entregar', d, d.pago ? 'Equipo entregado y cobro de ' + money(d.pago.monto) + ' registrado' : 'Equipo entregado')) setEntOpen(false); }} />
      )}
    </section>
  );
}

function Timeline({ s }) {
  const items = [
    ...(s.hist || []).map((h) => ({ t: h.t, c: h.e === 'noreparable' ? 'var(--bad)' : h.e === 'entregado' ? 'var(--ok)' : 'var(--accent)', tt: ETQ[h.e] })),
    ...(s.notas || []).map((n) => ({ t: n.t, c: 'var(--vio)', tt: 'Nota' + (n.autor ? ' de ' + n.autor : ''), body: n.txt })),
    ...(s.avisos || []).map((a) => ({ t: a.t, c: 'var(--teal)', tt: 'WhatsApp: ' + (AVISO_TXT[a.tipo] || 'mensaje') })),
  ].sort((a, b) => String(b.t).localeCompare(String(a.t)));
  return (
    <ol className="timeline">
      {items.map((h, i) => (
        <li key={i}><i style={{ borderColor: h.c }} />
          <span style={{ minWidth: 0 }}><b>{h.tt}</b><span className="muted small" style={{ display: 'block' }}>{fHora(h.t)}</span>
            {h.body && <p className="quote" style={{ marginTop: 6, padding: '8px 10px', fontSize: 13.5 }}>{h.body}</p>}</span>
        </li>
      ))}
    </ol>
  );
}

function EntregaModal({ s, cfg, onClose, onConfirm, openLb, flash, ocupado, subir }) {
  const pend = pendiente(s), t = total(s), esNR = s.etapa === 'noreparable';
  const lista = esNR ? PRUEBAS.slice(2) : PRUEBAS;
  const [pr, setPr] = useState([]);
  const [rec, setRec] = useState({ tipo: 'titular', nombre: '', dni: '' });
  const [cob, setCob] = useState({ si: pend > 0, monto: pend > 0 ? pend.toFixed(2) : '', metodo: 'Efectivo', op: '' });
  const [fotos, setFotos] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => { setErr(''); }, [rec, cob]);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);

  const confirmar = () => {
    if (rec.tipo === 'otro' && (!rec.nombre.trim() || !/^\d{8}$/.test(rec.dni))) return setErr('Escribe el nombre y el DNI (8 dígitos) de quien recoge.');
    let pago = null;
    if (pend > 0 && cob.si) {
      const m = +cob.monto;
      if (!(m > 0) || m > pend + 0.001) return setErr('El monto a cobrar debe ser mayor a 0 y como máximo ' + money(pend) + '.');
      if (cob.metodo === 'Yape' && !/^\d{6,}$/.test(cob.op)) return setErr('Escribe el N° de operación de Yape.');
      pago = { monto: m, metodo: cob.metodo, op: cob.op, nota: m >= pend - 0.001 ? 'Pago final' : 'Pago parcial' };
    }
    onConfirm({ pago, fotos, entrega: { recoge: rec, pruebas: pr } });
  };
  const queda = Math.max(0, pend - (cob.si ? +cob.monto || 0 : 0));

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={esNR ? 'Devolver equipo' : 'Entregar equipo'} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card">
        <div className="pad modal-h">
          <div style={{ minWidth: 0 }}>
            <h2>{esNR ? 'Devolver equipo sin reparar' : 'Entregar equipo'}</h2>
            <p className="muted" style={{ margin: '2px 0 0' }}><span className="mono">{code(cfg, s.num)}</span> · {s.cliente.nombre} · {s.equipo.tipo} {s.equipo.marca}</p>
          </div>
          <button type="button" className="btn sm ghost" aria-label="Cerrar" onClick={onClose}><Ic n="x" s={18} /></button>
        </div>
        <fieldset>
          <legend><span className="n">1</span>Prueba delante del cliente</legend>
          <div className="checks">
            {lista.map((p) => <label key={p}><input type="checkbox" checked={pr.includes(p)} onChange={() => setPr(pr.includes(p) ? pr.filter((x) => x !== p) : [...pr, p])} />{p}</label>)}
          </div>
          <p className="hint" style={{ margin: '8px 0 0' }}>Lo que marques queda guardado en el servicio. Sirve si después hay un reclamo.</p>
        </fieldset>
        <fieldset>
          <legend><span className="n">2</span>¿Quién recoge?</legend>
          <div className="seg" role="group" aria-label="Quién recoge">
            {[['titular', 'El titular (' + nombreCorto(s.cliente.nombre) + ')'], ['otro', 'Otra persona']].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={rec.tipo === k} onClick={() => setRec({ ...rec, tipo: k })}>{l}</button>
            ))}
          </div>
          {rec.tipo === 'otro' && (
            <div className="row" style={{ marginTop: 12 }}>
              <label className="f"><span className="req">Nombre de quien recoge</span><input value={rec.nombre} onChange={(e) => setRec({ ...rec, nombre: e.target.value })} /></label>
              <label className="f"><span className="req">DNI</span><input inputMode="numeric" maxLength={8} value={rec.dni} onChange={(e) => setRec({ ...rec, dni: e.target.value.replace(/\D/g, '').slice(0, 8) })} /></label>
            </div>
          )}
        </fieldset>
        <fieldset>
          <legend><span className="n">3</span>Cobro</legend>
          {pend > 0 ? (
            <div>
              <div className="sumbox" style={{ marginTop: 0 }}>
                <div><span>Total</span><b>{money(t)}</b></div>
                <div><span>Pagado</span><b style={{ color: 'var(--ok)' }}>{money(pagado(s))}</b></div>
                <div><span>Pendiente</span><b style={{ color: 'var(--bad)' }}>{money(pend)}</b></div>
              </div>
              <div className="checks" style={{ marginTop: 12 }}><label><input type="checkbox" checked={cob.si} onChange={(e) => setCob({ ...cob, si: e.target.checked })} />Cobrar ahora</label></div>
              {cob.si && (
                <div className="row" style={{ marginTop: 12, alignItems: 'end' }}>
                  <label className="f"><span>Monto (S/.)</span><input type="number" min="0" step="0.5" value={cob.monto} onChange={(e) => setCob({ ...cob, monto: e.target.value })} /></label>
                  <div className="f"><span>Método</span>
                    <div className="seg">{METODOS.map((m) => <button key={m} type="button" aria-pressed={cob.metodo === m} onClick={() => setCob({ ...cob, metodo: m })}>{m}</button>)}</div></div>
                  {cob.metodo === 'Yape' && (
                    <label className="f"><span className="req">N° de operación</span>
                      <input inputMode="numeric" value={cob.op} placeholder="Del comprobante" onChange={(e) => setCob({ ...cob, op: e.target.value.replace(/\D/g, '').slice(0, 12) })} /></label>
                  )}
                </div>
              )}
              {queda > 0.001 && <div className="banner warn" style={{ marginTop: 12 }}><Ic n="alert" s={18} /><span>Quedará <b>{money(queda)}</b> pendiente y seguirá en Pendientes de cobro.</span></div>}
            </div>
          ) : (
            <div className="banner ok"><Ic n="check" s={18} /><span>{t > 0 ? 'Todo pagado (' + money(t) + '). No hay nada que cobrar.' : 'Este servicio no tiene costo registrado.'}</span></div>
          )}
        </fieldset>
        <fieldset>
          <legend><span className="n">4</span>Foto de entrega<span className="hint">opcional</span></legend>
          <Fotos fotos={fotos} onChange={setFotos} onOpen={openLb} label="Entrega" flash={flash} subir={subir} />
        </fieldset>
        {err && <p className="err" style={{ margin: '0 20px 14px', fontSize: 13 }}>{err}</p>}
        <div className="form-foot">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn pri" disabled={ocupado} onClick={confirmar}><Ic n="check" s={17} />{ocupado ? 'Guardando…' : 'Confirmar ' + (esNR ? 'devolución' : 'entrega')}</button>
        </div>
      </div>
    </div>
  );
}
