/* Pestañas Galería, Pendientes de cobro, Clientes y Configuración. */
import { useMemo, useState } from 'react';
import { Ic, EtapaPill, PagoPill } from './ui';
import { ETQ, clienteKey, code, estadoPago, iniciales, mensaje, money, pagado, pendiente, total, waLink } from '../../lib/servicios-tecnicos/logic';

/* ---------- Galería ---------- */
export function Galeria({ servicios, cfg, abrir, openLb }) {
  const [f, setF] = useState('todas');
  const fotos = [...servicios].sort((a, b) => b.num - a.num).flatMap((s) => [
    ...(f !== 'entrega' ? s.fotos.ingreso.map((src) => ({ src, s, k: 'Ingreso' })) : []),
    ...(f !== 'ingreso' ? s.fotos.entrega.map((src) => ({ src, s, k: 'Entrega' })) : []),
  ]);
  return (
    <section>
      <div className="sec-head">
        <div><h2>Galería</h2><p>Fotos de cómo llegaron y cómo se entregaron los equipos.</p></div>
        <div className="seg">{[['todas', 'Todas'], ['ingreso', 'Ingreso'], ['entrega', 'Entrega']].map(([k, l]) => <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}</div>
      </div>
      {fotos.length ? (
        <div className="gal">
          {fotos.map((x) => (
            <figure className="card" key={x.src}>
              <img src={x.src} alt={x.k + ' ' + code(cfg, x.s.num)} loading="lazy" onClick={() => openLb(x.src, code(cfg, x.s.num) + ' · ' + x.k + ' · ' + x.s.cliente.nombre)} />
              <figcaption>
                <span style={{ minWidth: 0 }}><b className="mono">{code(cfg, x.s.num)}</b> · {x.k}<span className="muted ell" style={{ display: 'block' }}>{x.s.cliente.nombre}</span></span>
                <button type="button" className="btn sm" onClick={() => abrir(x.s.id)}>Ver</button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : <div className="card empty">No hay fotos todavía. Se agregan al registrar un servicio o desde su detalle.</div>}
    </section>
  );
}

/* ---------- Pendientes de cobro ---------- */
export function Pendientes({ servicios, cfg, abrir, acciones }) {
  const rows = servicios.filter((s) => pendiente(s) > 0).sort((a, b) => pendiente(b) - pendiente(a));
  const tot = rows.reduce((a, s) => a + pendiente(s), 0);
  return (
    <section>
      <div className="sec-head">
        <div><h2>Pendientes de cobro</h2><p>{rows.length} servicio{rows.length === 1 ? '' : 's'} con dinero por cobrar · <b style={{ color: 'var(--bad)' }}>{money(tot)}</b> en total.</p></div>
      </div>
      <div className="card pad">
        {rows.length ? (
          <div className="list">
            {rows.map((s) => (
              <div className="li" key={s.id} style={{ cursor: 'default' }}>
                <span className={'avatar ' + (estadoPago(s) === 'parcial' ? 'c-warn' : 'c-bad')}>{iniciales(s.cliente.nombre)}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="nm">{s.cliente.nombre}</span>
                  <span className="sm"><span className="mono">{code(cfg, s.num)}</span> · {s.equipo.tipo} {s.equipo.marca} · {ETQ[s.etapa]} · pagó {money(pagado(s))} de {money(total(s))}</span>
                </span>
                <span className="rt">
                  <span className="amt" style={{ color: 'var(--bad)' }}>Pendiente {money(pendiente(s))}</span>
                  <PagoPill s={s} />
                  <a className="btn sm wa" href={waLink(s.cliente.cel, mensaje('cobro', s, cfg))} target="_blank" rel="noopener noreferrer" onClick={() => acciones.aviso(s.id, 'cobro')}><Ic n="wa" s={15} />Recordar</a>
                  <button type="button" className="btn sm pri" onClick={() => abrir(s.id)}>Registrar pago</button>
                </span>
              </div>
            ))}
          </div>
        ) : <div className="empty">No hay pagos pendientes. Todo cobrado.</div>}
      </div>
    </section>
  );
}

/* ---------- Clientes ---------- */
export function Clientes({ servicios, cfg, abrir }) {
  const [q, setQ] = useState('');
  const lista = useMemo(() => {
    const m = {};
    [...servicios].sort((a, b) => a.num - b.num).forEach((s) => {
      const k = clienteKey(s.cliente);
      const serv = m[k]?.serv || [];
      m[k] = { ...s.cliente, serv: [...serv, s] };
    });
    return Object.values(m).sort((a, b) => b.serv[b.serv.length - 1].num - a.serv[a.serv.length - 1].num);
  }, [servicios]);
  const rows = lista.filter((c) => !q || [c.nombre, c.dni, c.ruc, c.cel].join(' ').toLowerCase().includes(q.toLowerCase()));
  return (
    <section>
      <div className="sec-head">
        <div><h2>Clientes</h2><p>{lista.length} cliente{lista.length === 1 ? '' : 's'}. Se arman solos con los servicios registrados, agrupados por DNI o RUC.</p></div>
      </div>
      <div className="toolbar">
        <label className="search"><Ic n="search" s={17} /><input type="search" placeholder="Buscar por nombre, DNI, RUC o celular" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente" /></label>
      </div>
      {rows.length ? (
        <div className="clients">
          {rows.map((c) => {
            const gast = c.serv.reduce((a, s) => a + pagado(s), 0), pend = c.serv.reduce((a, s) => a + pendiente(s), 0);
            return (
              <div className="card pad" key={clienteKey(c)}>
                <div className="cli-h">
                  <span className="avatar c-blue">{iniciales(c.nombre)}</span>
                  <span style={{ minWidth: 0 }}><b style={{ display: 'block' }}>{c.nombre}</b>
                    <span className="muted mono small">{c.dni ? 'DNI ' + c.dni : ''}{c.dni && c.ruc ? ' · ' : ''}{c.ruc ? 'RUC ' + c.ruc : ''}</span></span>
                </div>
                <div className="sumbox keep3">
                  <div><span>Servicios</span><b>{c.serv.length}</b></div>
                  <div><span>Pagó</span><b className="b14">{money(gast)}</b></div>
                  <div><span>Debe</span><b className="b14" style={{ color: pend > 0 ? 'var(--bad)' : 'var(--muted)' }}>{money(pend)}</b></div>
                </div>
                <div style={{ marginTop: 10 }}>
                  {[...c.serv].reverse().map((s) => (
                    <button type="button" className="mini" key={s.id} onClick={() => abrir(s.id)}>
                      <span className="nm2"><span className="mono">{code(cfg, s.num)}</span> · {s.equipo.tipo} {s.equipo.marca}</span><EtapaPill k={s.etapa} />
                    </button>
                  ))}
                </div>
                <div className="wrap-row" style={{ marginTop: 10, alignItems: 'center' }}>
                  <span className="mono sel">{c.cel}</span>
                  <a className="btn sm wa" href={waLink(c.cel)} target="_blank" rel="noopener noreferrer"><Ic n="wa" s={15} />WhatsApp</a>
                </div>
              </div>
            );
          })}
        </div>
      ) : <div className="card empty">{lista.length ? 'No hay clientes que coincidan.' : 'Todavía no hay clientes. Aparecen solos al registrar servicios.'}</div>}
    </section>
  );
}

/* ---------- Configuración ---------- */
export function Config({ cfg, acciones, servicios, ocupado }) {
  const [c, setC] = useState({ ...cfg, tecnicosTxt: cfg.tecnicos.join('\n') });
  const set = (k, v) => setC((o) => ({ ...o, [k]: v }));
  const guardar = (e) => {
    e.preventDefault();
    const { tecnicosTxt, ...rest } = c;
    acciones.guardarConfig({ ...rest, tecnicos: tecnicosTxt.split('\n').map((x) => x.trim()).filter(Boolean) });
  };
  const campo = (l, k, extra = {}, hint) => (
    <label className="f"><span>{l}</span><input value={c[k]} onChange={(e) => set(k, e.target.value)} {...extra} />{hint && <span className="hint">{hint}</span>}</label>
  );
  return (
    <section>
      <div className="sec-head"><div><h2>Configuración</h2><p>Datos de la empresa, técnicos y plazos.</p></div></div>
      <form onSubmit={guardar} autoComplete="off">
        <div className="cfg-grid">
          <div className="card pad stack">
            <h3>Empresa y técnicos</h3>
            <div className="row">
              {campo('Razón social', 'emp', {}, 'Sale en los mensajes de WhatsApp')}
              {campo('Teléfono / WhatsApp de la tienda', 'tel')}
            </div>
            <label className="f"><span>Técnicos (uno por línea)</span>
              <textarea rows={3} value={c.tecnicosTxt} onChange={(e) => set('tecnicosTxt', e.target.value)} /></label>
          </div>
          <div className="card pad stack">
            <h3>Plazos y numeración</h3>
            <div className="row">
              {campo('Garantía (días)', 'garantia', { type: 'number', min: 0 })}
              {campo('Avisar si no recoge en (días)', 'diasRecoger', { type: 'number', min: 1 })}
              {campo('Abandono después de (días)', 'diasAbandono', { type: 'number', min: 1 })}
              {campo('Prefijo del código', 'pref', { maxLength: 4 }, 'Próximo código: ' + code(c, cfg.next))}
            </div>
          </div>
        </div>
        <div className="right" style={{ marginTop: 16 }}>
          <button type="submit" className="btn pri" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar configuración'}</button>
        </div>
      </form>
      <p className="hint" style={{ marginTop: 16 }}>Hay {servicios.length} servicio{servicios.length === 1 ? '' : 's'} registrado{servicios.length === 1 ? '' : 's'}. Los datos y las fotos se guardan en el servidor de la página, con un respaldo automático por día.</p>
    </section>
  );
}
