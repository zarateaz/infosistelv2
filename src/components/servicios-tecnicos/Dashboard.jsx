/* Pestaña Dashboard: resumen del taller. */
import { Ic, EtapaPill, PagoPill, AlertaPill, UrgPill } from './ui';
import {
  ACTIVAS, ETAPAS, ETQ, ETCOLOR, alerta, code, fCorta, fHora, iniciales, money, parseD, pendiente, total, ymd,
} from '../../lib/servicios-tecnicos/logic';

const BAR = { recibido: 'var(--accent)', diagnostico: 'var(--vio)', reparacion: 'var(--warn)', repuesto: 'var(--teal)', listo: 'var(--ok)', noreparable: 'var(--bad)' };
const AL_IC = { sinaviso: 'wa', recoger: 'box', abandono: 'box' };
const AL_CL = { bad: 'c-bad', warn: 'c-warn', info: 'c-blue' };
const RANK = { bad: 0, warn: 1, info: 2 };
const suma = (arr) => arr.reduce((a, p) => a + (+p.monto || 0), 0);

export default function Dashboard({ servicios, cfg, ir, abrir }) {
  const enTaller = servicios.filter((s) => ACTIVAS.includes(s.etapa));
  const listos = servicios.filter((s) => s.etapa === 'listo' || s.etapa === 'noreparable');
  const hoy = new Date();
  const entregadosMes = servicios.filter((s) => s.etapa === 'entregado' && s.fEntregado
    && parseD(s.fEntregado).getMonth() === hoy.getMonth() && parseD(s.fEntregado).getFullYear() === hoy.getFullYear());
  const pagos = servicios.flatMap((s) => s.pagos || []);
  const cobrado = suma(pagos);
  const efectivo = suma(pagos.filter((p) => p.metodo === 'Efectivo'));
  const conPend = servicios.filter((s) => pendiente(s) > 0);
  const porCobrar = conPend.reduce((a, s) => a + pendiente(s), 0);
  const alertas = servicios.map((s) => ({ s, a: alerta(s, cfg) })).filter((x) => x.a)
    .sort((x, y) => RANK[x.a.nivel] - RANK[y.a.nivel] || y.a.dias - x.a.dias);
  const ult = [...servicios].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 6);
  const porEtapa = [...ETAPAS.filter((e) => e.k !== 'entregado'), { k: 'noreparable', l: 'No reparable' }]
    .map((e) => ({ ...e, n: servicios.filter((s) => s.etapa === e.k).length }));
  const max = Math.max(1, ...porEtapa.map((e) => e.n));
  const hoyStr = ymd(hoy);
  const caja = servicios.flatMap((s) => (s.pagos || []).filter((p) => ymd(parseD(p.fecha)) === hoyStr).map((p) => ({ p, s })))
    .sort((a, b) => String(b.p.fecha).localeCompare(String(a.p.fecha)));
  const cajaTot = suma(caja.map((x) => x.p));
  const cajaEf = suma(caja.filter((x) => x.p.metodo === 'Efectivo').map((x) => x.p));
  const tecs = [...cfg.tecnicos];
  if (servicios.some((s) => !s.tecnico && ACTIVAS.includes(s.etapa))) tecs.push('');
  const carga = tecs.map((t) => ({
    t,
    act: servicios.filter((s) => (s.tecnico || '') === t && ACTIVAS.includes(s.etapa)).length,
    lis: servicios.filter((s) => (s.tecnico || '') === t && s.etapa === 'listo').length,
    ent: entregadosMes.filter((s) => (s.tecnico || '') === t).length,
  }));
  const maxC = Math.max(1, ...carga.map((c) => c.act));
  const pl = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

  return (
    <section>
      <div className="sec-head">
        <div><h2>Resumen</h2><p>Cómo va el taller hoy, {fCorta(hoy.toISOString())}.</p></div>
        <button type="button" className="btn pri" onClick={() => ir('nuevo')}><Ic n="plus" s={17} />Nuevo servicio</button>
      </div>

      <div className="kpis">
        <K ic="wrench" c="c-blue" v={enTaller.length} t="En el taller" s="equipos en proceso" go={() => ir('servicios', { filtro: 'taller' })} />
        <K ic="box" c="c-ok" v={listos.length} t="Listos para entregar" s="esperando que el cliente recoja" go={() => ir('servicios', { filtro: 'listos' })} />
        <K ic="alert" c="c-warn" v={alertas.length} t="Requieren atención" s="listos sin avisar o sin recoger" go={() => ir('servicios', { filtro: 'alerta' })} />
        <K ic="coin" c="c-teal" v={money(cobrado)} t="Total cobrado" s={'Efectivo ' + money(efectivo) + ' · Yape ' + money(cobrado - efectivo)} go={() => ir('pendientes')} />
        <K ic="clock" c="c-bad" v={money(porCobrar)} t="Total pendiente" s={'por cobrar en ' + pl(conPend.length, 'servicio', 'servicios')} go={() => ir('pendientes')} />
        <K ic="check" c="c-vio" v={entregadosMes.length} t="Entregados este mes" s={'de ' + servicios.filter((s) => s.etapa === 'entregado').length + ' entregados en total'} go={() => ir('servicios', { filtro: 'entregados' })} />
      </div>

      <div className="two">
        <div className="card pad">
          <div className="box-h"><h3>Requieren atención</h3><span className="faint" style={{ fontSize: 13 }}>Aviso a los {cfg.diasRecoger} días sin recoger · abandono a los {cfg.diasAbandono}</span></div>
          {alertas.length ? (
            <div className="list">
              {alertas.slice(0, 6).map(({ s, a }) => (
                <button type="button" className="li" key={s.id} onClick={() => abrir(s.id)}>
                  <span className={'avatar ' + AL_CL[a.nivel]}><Ic n={AL_IC[a.tipo]} s={18} /></span>
                  <span style={{ minWidth: 0 }}>
                    <span className="nm">{s.cliente.nombre}</span>
                    <span className="sm"><span className="mono">{code(cfg, s.num)}</span> · {s.equipo.tipo} {s.equipo.marca} · {ETQ[s.etapa]}</span>
                  </span>
                  <span className="rt">{s.urgente && <UrgPill />}<AlertaPill a={a} /></span>
                </button>
              ))}
            </div>
          ) : <div className="empty" style={{ padding: '28px 10px' }}>Todo al día. No hay equipos sin avisar ni sin recoger.</div>}
        </div>

        <div className="card pad">
          <div className="box-h"><h3>Caja de hoy</h3><span className="muted" style={{ fontSize: 13 }}>{pl(caja.length, 'cobro', 'cobros')}</span></div>
          <div className="sumbox" style={{ marginTop: 0 }}>
            <div><span>Total</span><b>{money(cajaTot)}</b></div>
            <div><span>Efectivo</span><b style={{ color: 'var(--ok)' }}>{money(cajaEf)}</b></div>
            <div><span>Yape</span><b style={{ color: 'var(--vio)' }}>{money(cajaTot - cajaEf)}</b></div>
          </div>
          {caja.length ? (
            <div className="list" style={{ marginTop: 8 }}>
              {caja.slice(0, 5).map(({ p, s }) => (
                <button type="button" className="li" key={p.id} onClick={() => abrir(s.id)}>
                  <span className={'avatar mt ' + (p.metodo === 'Yape' ? 'c-vio' : 'c-ok')}>{p.metodo === 'Yape' ? 'YP' : 'S/.'}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="nm">{s.cliente.nombre}</span>
                    <span className="sm">{fHora(p.fecha).slice(11)} · <span className="mono">{code(cfg, s.num)}</span> · {p.nota}{p.op ? ' · #' + p.op : ''}</span>
                  </span>
                  <span className="rt"><span className="amt">{money(p.monto)}</span></span>
                </button>
              ))}
            </div>
          ) : <div className="empty" style={{ padding: '24px 10px' }}>Aún no hay cobros hoy.</div>}
          <p className="hint" style={{ margin: '10px 0 0' }}>Sirve para el cierre de caja: cuadra el efectivo del cajón y los Yape del celular.</p>
        </div>
      </div>

      <div className="two">
        <div className="card pad">
          <div className="box-h"><h3>Equipos por etapa</h3></div>
          <div className="bars">
            {porEtapa.map((e) => (
              <div className="bar" key={e.k}>
                <span>{e.l}</span>
                <span className="tr"><i style={{ width: (e.n / max) * 100 + '%', background: BAR[e.k] }} /></span>
                <b className="mono" style={{ textAlign: 'right' }}>{e.n}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="card pad">
          <div className="box-h"><h3>Carga por técnico</h3><span className="faint" style={{ fontSize: 13 }}>equipos en el taller</span></div>
          <div className="bars">
            {carga.map((c) => (
              <div className="bar" key={c.t || '-'}>
                <span style={{ lineHeight: 1.25, minWidth: 0 }}>
                  <b style={{ display: 'block', overflowWrap: 'anywhere' }}>{c.t || 'Sin asignar'}</b>
                  <span className="faint" style={{ fontSize: 12 }}>{pl(c.lis, 'listo', 'listos')} · {pl(c.ent, 'entregado', 'entregados')} este mes</span>
                </span>
                <span className="tr"><i style={{ width: (c.act / maxC) * 100 + '%', background: 'var(--accent)' }} /></span>
                <b className="mono" style={{ textAlign: 'right' }}>{c.act}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card pad">
        <div className="box-h">
          <h3>Últimos servicios registrados</h3>
          <button type="button" className="btn sm ghost" onClick={() => ir('servicios')}>Ver todos <Ic n="arrow" s={15} /></button>
        </div>
        {ult.length ? (
          <div className="list">{ult.map((s) => <FilaServicio key={s.id} s={s} cfg={cfg} onClick={() => abrir(s.id)} />)}</div>
        ) : (
          <div className="empty">
            Aún no hay servicios. El primero será el <b className="mono">{code(cfg, cfg.next)}</b>.
            <div style={{ marginTop: 12 }}><button type="button" className="btn pri" onClick={() => ir('nuevo')}><Ic n="plus" s={17} />Registrar el primero</button></div>
          </div>
        )}
      </div>
    </section>
  );
}

function K({ ic, c, v, t, s, go }) {
  return (
    <button type="button" className="card kpi" onClick={go}>
      <span className={'ic ' + c}><Ic n={ic} s={21} /></span>
      <span><b>{v}</b><span className="t">{t}</span><span className="s">{s}</span></span>
    </button>
  );
}

export function FilaServicio({ s, cfg, onClick }) {
  const c = ETCOLOR[s.etapa];
  return (
    <button type="button" className="li" onClick={onClick}>
      <span className={'avatar ' + (c === 'c-plain' ? '' : c)} style={c === 'c-plain' ? { background: 'var(--panel2)', color: 'var(--muted)' } : undefined}>{iniciales(s.cliente.nombre)}</span>
      <span style={{ minWidth: 0 }}>
        <span className="nm">{s.cliente.nombre}</span>
        <span className="sm"><span className="mono">{code(cfg, s.num)}</span> · {s.equipo.tipo} {s.equipo.marca} · {s.falla}</span>
      </span>
      <span className="rt">
        {s.urgente && s.etapa !== 'entregado' && <UrgPill />}
        {s.tecnico && <span className="muted" style={{ fontSize: 13 }}>{s.tecnico}</span>}
        <span className="muted" style={{ fontSize: 13 }}>{fCorta(s.fecha)}</span>
        <EtapaPill k={s.etapa} />
        <AlertaPill a={alerta(s, cfg)} />
        <span className="amt">{pendiente(s) > 0 ? 'Pendiente ' + money(pendiente(s)) : money(total(s))}</span>
        <PagoPill s={s} />
      </span>
    </button>
  );
}
