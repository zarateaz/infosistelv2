'use client';
/* =====================================================================
   Módulo "Servicios técnicos" – INFOSISTEL
   Pantalla principal: carga los datos del servidor y muestra las pestañas.
   ===================================================================== */
import { useCallback, useEffect, useRef, useState } from 'react';
import './servicios-tecnicos.css';
import { api } from './api';
import { Ic } from './ui';
import { pendiente } from '../../lib/servicios-tecnicos/logic';
import Dashboard from './Dashboard';
import Servicios from './Servicios';
import Formulario from './Formulario';
import Detalle from './Detalle';
import { Galeria, Pendientes, Clientes, Config } from './Otros';

const TABS = [
  ['dashboard', 'Dashboard', 'grid'],
  ['servicios', 'Servicios', 'clip'],
  ['galeria', 'Galería', 'image'],
  ['pendientes', 'Pendientes de cobro', 'clock'],
  ['clientes', 'Clientes', 'users'],
  ['config', 'Configuración', 'gear'],
];

export default function ServiciosTecnicos() {
  const [cfg, setCfg] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState({ tab: 'dashboard' });
  const [toast, setToast] = useState(null);
  const [lb, setLb] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const tRef = useRef(null);
  const raiz = useRef(null);

  const flash = useCallback((t) => {
    setToast(t);
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const cargar = useCallback(async () => {
    try {
      const d = await api.todo();
      setCfg(d.cfg);
      setServicios(d.servicios);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  /* Carga al abrir, al volver a la pestaña del navegador y cada minuto (por si otra PC registró algo). */
  useEffect(() => {
    cargar();
    const onFocus = () => cargar();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(cargar, 60000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv); };
  }, [cargar]);

  const ir = (tab, extra) => {
    setVista({ tab, ...(extra || {}) });
    raiz.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const abrir = (id) => ir('servicios', { id });
  const ponerServicio = (s) => setServicios((lst) => (lst.some((x) => x.id === s.id) ? lst.map((x) => (x.id === s.id ? s : x)) : [s, ...lst]));

  /* Ejecuta una llamada al servidor mostrando errores de forma amable. */
  const correr = async (fn) => {
    setOcupado(true);
    try { return await fn(); }
    catch (e) { flash(e.message); if (e.status === 404) cargar(); return null; }
    finally { setOcupado(false); }
  };

  const acciones = {
    async crear(datos, adelanto) {
      const r = await correr(() => api.crear(datos, adelanto));
      if (!r) return false;
      setCfg(r.cfg);
      ponerServicio(r.servicio);
      flash(r.mensaje);
      ir('servicios', { id: r.servicio.id, recien: true });
      return true;
    },
    async editar(id, datos) {
      const r = await correr(() => api.accion(id, 'editar', { datos }));
      if (!r) return false;
      ponerServicio(r.servicio);
      flash(r.mensaje);
      ir('servicios', { id });
      return true;
    },
    async accion(id, accion, datos, mensaje) {
      const r = await correr(() => api.accion(id, accion, datos));
      if (!r) return false;
      ponerServicio(r.servicio);
      if (mensaje !== false && (mensaje || r.mensaje)) flash(mensaje || r.mensaje);
      return true;
    },
    /* Los avisos de WhatsApp se registran sin bloquear la pantalla. */
    aviso(id, tipo) {
      api.accion(id, 'aviso', { tipo }).then((r) => ponerServicio(r.servicio)).catch(() => {});
    },
    async eliminar(id) {
      const r = await correr(() => api.eliminar(id));
      if (!r) return;
      setServicios((lst) => lst.filter((s) => s.id !== id));
      flash(r.mensaje);
      ir('servicios');
    },
    async guardarConfig(c) {
      const r = await correr(() => api.guardarConfig(c));
      if (!r) return;
      setCfg(r.cfg);
      flash(r.mensaje);
    },
    subirFoto: (data) => api.subirFoto(data),
  };

  if (!cfg) {
    return (
      <div className="st-root" ref={raiz}>
        <Encabezado />
        <div className="card empty">
          {error ? (
            <>
              <p style={{ marginTop: 0 }}><b>No se pudieron cargar los servicios.</b><br />{error}</p>
              <button className="btn pri" onClick={cargar}><Ic n="refresh" s={16} />Intentar de nuevo</button>
            </>
          ) : 'Cargando servicios…'}
        </div>
      </div>
    );
  }

  const pendCount = servicios.filter((s) => pendiente(s) > 0).length;
  const P = { cfg, servicios, ir, abrir, acciones, flash, ocupado, vista, openLb: (src, cap) => setLb({ src, cap }) };
  const actual = vista.id && servicios.find((s) => s.id === vista.id);

  let body;
  if (vista.tab === 'dashboard') body = <Dashboard {...P} />;
  else if (vista.tab === 'nuevo') body = <Formulario key={vista.editId || 'nuevo'} {...P} editId={vista.editId} />;
  else if (vista.tab === 'servicios') body = actual
    ? <Detalle key={vista.id} {...P} s={actual} recien={vista.recien} entregar={vista.entregar} />
    : <Servicios {...P} />;
  else if (vista.tab === 'galeria') body = <Galeria {...P} />;
  else if (vista.tab === 'pendientes') body = <Pendientes {...P} />;
  else if (vista.tab === 'clientes') body = <Clientes {...P} />;
  else body = <Config {...P} />;

  return (
    <div className="st-root" ref={raiz}>
      <Encabezado />
      <nav className="tabs" aria-label="Secciones de servicios técnicos">
        {TABS.map(([k, l, ic]) => (
          <button key={k} type="button" aria-current={vista.tab === k || (k === 'servicios' && vista.tab === 'nuevo') ? 'page' : undefined} onClick={() => ir(k)}>
            <Ic n={ic} s={16} />{l}
            {k === 'pendientes' && pendCount > 0 && <span className="badge">{pendCount}</span>}
          </button>
        ))}
      </nav>
      {error && (
        <div className="banner warn" style={{ marginBottom: 16 }}>
          <Ic n="alert" s={18} /><span>Sin conexión con el servidor: {error}. Lo que ves puede no estar actualizado.</span>
          <span className="acts"><button className="btn sm" onClick={cargar}>Reintentar</button></span>
        </div>
      )}
      {body}
      {lb && (
        <div className="modal lightbox" onClick={() => setLb(null)} role="dialog" aria-label="Foto">
          <div><img src={lb.src} alt={lb.cap} /><p>{lb.cap} · toca para cerrar</p></div>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Encabezado() {
  return (
    <header>
      <h1>Servicios técnicos</h1>
      <p className="lead">Control de recepción, reparación, entrega y cobro de equipos.</p>
    </header>
  );
}
