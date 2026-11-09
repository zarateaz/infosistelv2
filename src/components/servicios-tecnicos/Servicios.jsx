/* Pestaña Servicios: lista (o tablero por etapas) con búsqueda y filtros. */
import { useEffect, useState } from 'react';
import { Ic, EtapaPill, PagoPill, AlertaPill, UrgPill } from './ui';
import { FilaServicio } from './Dashboard';
import { ACTIVAS, SIG, alerta, code, estadoPago, fCorta, money, pendiente, total } from '../../lib/servicios-tecnicos/logic';

const FILTROS = [['todos', 'Todos'], ['taller', 'En el taller'], ['listos', 'Listos / no reparables'], ['entregados', 'Entregados'], ['alerta', 'Con alerta'], ['urgentes', 'Urgentes']];
const COLS = ['recibido', 'diagnostico', 'reparacion', 'repuesto', 'listo', 'noreparable'];
const SIG_CORTO = { diagnostico: 'A diagnóstico', reparacion: 'A reparación', listo: 'Marcar listo', entregado: 'Entregar' };

/* Preferencias del usuario (vista y orden) guardadas en el navegador. */
function usePref(clave, def) {
  const [v, setV] = useState(def);
  useEffect(() => { try { const x = localStorage.getItem(clave); if (x) setV(x); } catch {} }, [clave]);
  const set = (x) => { setV(x); try { localStorage.setItem(clave, x); } catch {} };
  return [v, set];
}

export default function Servicios({ servicios, cfg, ir, abrir, acciones, vista, ocupado }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState(vista.filtro || 'todos');
  const [fp, setFp] = useState('');
  const [modo, setModo] = usePref('st_modo', 'lista');
  const [orden, setOrden] = usePref('st_orden', 'asc');

  const busca = (s) => {
    if (fp && estadoPago(s) !== fp) return false;
    if (q) {
      const t = [code(cfg, s.num), s.cliente.nombre, s.cliente.dni, s.cliente.ruc, s.cliente.cel, s.equipo.tipo, s.equipo.marca, s.equipo.modelo, s.equipo.serie, s.falla].join(' ').toLowerCase();
      if (!t.includes(q.toLowerCase())) return false;
    }
    return true;
  };
  const ok = (s) => {
    if (f === 'taller' && !ACTIVAS.includes(s.etapa)) return false;
    if (f === 'listos' && !(s.etapa === 'listo' || s.etapa === 'noreparable')) return false;
    if (f === 'entregados' && s.etapa !== 'entregado') return false;
    if (f === 'alerta' && !alerta(s, cfg)) return false;
    if (f === 'urgentes' && !(s.urgente && s.etapa !== 'entregado')) return false;
    return busca(s);
  };
  const rows = [...servicios].sort((a, b) => (orden === 'asc' ? a.num - b.num : b.num - a.num)).filter(ok);
  const vacio = servicios.length ? 'Ningún servicio coincide con la búsqueda o el filtro.' : 'Aún no hay servicios registrados.';

  const avanzar = (e, s) => {
    e.stopPropagation();
    const k = SIG[s.etapa];
    if (k === 'entregado') ir('servicios', { id: s.id, entregar: true });
    else acciones.accion(s.id, 'etapa', { etapa: k }, 'Pasó a: ' + ({ diagnostico: 'En diagnóstico', reparacion: 'En reparación', listo: 'Listo para entregar' }[k]));
  };

  return (
    <section>
      <div className="sec-head">
        <div>
          <h2>Servicios</h2>
          <p>{modo === 'tablero' ? 'Cada columna es una etapa. Mueve los equipos con el botón de cada tarjeta.' : 'Toca un servicio para ver su avance, pagos y fotos.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="seg" role="group" aria-label="Vista">
            {[['lista', 'Lista'], ['tablero', 'Tablero']].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={modo === k} onClick={() => setModo(k)}>{l}</button>
            ))}
          </div>
          <button type="button" className="btn pri" onClick={() => ir('nuevo')}><Ic n="plus" s={17} />Nuevo servicio</button>
        </div>
      </div>

      <div className="toolbar">
        <label className="search">
          <Ic n="search" s={17} />
          <input type="search" placeholder="Buscar por cliente, DNI, celular, código o equipo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        </label>
        <select value={fp} onChange={(e) => setFp(e.target.value)} className="auto" aria-label="Estado de pago">
          <option value="">Todos los pagos</option><option value="pendiente">Pendiente</option><option value="parcial">Parcial</option>
          <option value="pagado">Pagado</option><option value="cotizar">Por cotizar</option>
        </select>
        {modo !== 'tablero' && (
          <select value={orden} onChange={(e) => setOrden(e.target.value)} className="auto" aria-label="Orden">
            <option value="asc">Desde {code(cfg, 1)}</option><option value="desc">Más recientes primero</option>
          </select>
        )}
      </div>

      {modo === 'tablero' ? (
        <div>
          <div className="kanban">
            {COLS.map((k) => {
              const items = servicios.filter((s) => s.etapa === k && busca(s))
                .sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0) || String(a.fecha).localeCompare(String(b.fecha)));
              return (
                <div className="kcol" key={k}>
                  <div className="kcol-h"><EtapaPill k={k} /><b className="mono">{items.length}</b></div>
                  {items.length ? items.map((s) => {
                    const a = alerta(s, cfg), sg = SIG[s.etapa];
                    return (
                      <div className="kcard" key={s.id} role="button" tabIndex={0} onClick={() => abrir(s.id)} onKeyDown={(e) => { if (e.key === 'Enter') abrir(s.id); }}>
                        <div className="kcard-top"><b className="mono">{code(cfg, s.num)}</b>{s.urgente && <UrgPill />}</div>
                        <b className="kcard-nm">{s.cliente.nombre}</b>
                        <span className="muted kcard-eq">{s.equipo.tipo} {s.equipo.marca}</span>
                        {a && <div style={{ marginTop: 6 }}><AlertaPill a={a} /></div>}
                        <div className="kcard-foot">
                          <span className="amt" style={{ fontSize: 13, color: pendiente(s) > 0 ? 'var(--bad)' : 'var(--muted)' }}>
                            {pendiente(s) > 0 ? 'Debe ' + money(pendiente(s)) : total(s) > 0 ? 'Pagado' : 'Por cotizar'}
                          </span>
                          {sg && <button type="button" className="btn sm" disabled={ocupado} onClick={(e) => avanzar(e, s)}>{SIG_CORTO[sg]} <Ic n="arrow" s={13} /></button>}
                        </div>
                      </div>
                    );
                  }) : <p className="faint" style={{ fontSize: 13, textAlign: 'center', margin: '14px 0' }}>Sin equipos</p>}
                </div>
              );
            })}
          </div>
          <p className="hint" style={{ marginTop: 8 }}>Los entregados no salen en el tablero. Míralos en la vista Lista.</p>
        </div>
      ) : (
        <div>
          <div className="chips" style={{ marginBottom: 14 }}>
            {FILTROS.map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}
          </div>
          <div className="card tbl-wrap desk">
            {rows.length ? (
              <table className="tbl">
                <thead><tr><th>Código</th><th>Cliente</th><th>Equipo</th><th>Etapa</th><th>Recibido</th><th className="r">Total</th><th className="r">Pendiente</th><th>Pago</th></tr></thead>
                <tbody>
                  {rows.map((s) => {
                    const a = alerta(s, cfg);
                    return (
                      <tr className="trow" key={s.id} onClick={() => abrir(s.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') abrir(s.id); }}>
                        <td><b className="mono" style={{ color: 'var(--accent)' }}>{code(cfg, s.num)}</b>{s.urgente && s.etapa !== 'entregado' && <div style={{ marginTop: 4 }}><UrgPill /></div>}</td>
                        <td><b>{s.cliente.nombre}</b><div className="muted small">{s.cliente.dni ? 'DNI ' + s.cliente.dni : s.cliente.ruc ? 'RUC ' + s.cliente.ruc : ''} · {s.cliente.cel}</div></td>
                        <td>{s.equipo.tipo} {s.equipo.marca}<div className="muted small ell">{s.falla}</div></td>
                        <td><div className="col-pills"><EtapaPill k={s.etapa} />{a && <AlertaPill a={a} />}</div></td>
                        <td className="muted nowrap">{fCorta(s.fecha)}</td>
                        <td className="amt r">{total(s) > 0 ? money(total(s)) : '—'}</td>
                        <td className="amt r" style={{ color: pendiente(s) > 0 ? 'var(--bad)' : 'var(--muted)' }}>{money(pendiente(s))}</td>
                        <td><PagoPill s={s} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <div className="empty">{vacio}</div>}
          </div>
          <div className="card pad mob-list">
            {rows.length ? <div className="list">{rows.map((s) => <FilaServicio key={s.id} s={s} cfg={cfg} onClick={() => abrir(s.id)} />)}</div> : <div className="empty">{vacio}</div>}
          </div>
        </div>
      )}
    </section>
  );
}
