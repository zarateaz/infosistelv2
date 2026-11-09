/* Piezas pequeñas que se usan en varias pantallas: íconos, etiquetas de estado y fotos. */
import { useRef, useState } from 'react';
import { ETQ, ETCOLOR, PAGO, estadoPago } from '../../lib/servicios-tecnicos/logic';

const I = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  clip: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  coin: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  wa: '<path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
};

export function Ic({ n, s = 18, w = 2 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: I[n] }} />
  );
}

const PLAIN = { background: 'var(--panel2)', color: 'var(--muted)' };

export function EtapaPill({ k }) {
  const c = ETCOLOR[k];
  return <span className={'pill ' + (c === 'c-plain' ? '' : c)} style={c === 'c-plain' ? PLAIN : undefined}>{ETQ[k]}</span>;
}
export function PagoPill({ s }) {
  const [l, c] = PAGO[estadoPago(s)];
  return <span className={'pill plain ' + (c === 'c-plain' ? '' : c)} style={c === 'c-plain' ? PLAIN : undefined}>{l}</span>;
}
export function AlertaPill({ a }) {
  if (!a) return null;
  return <span className={'pill plain ' + { bad: 'c-bad', warn: 'c-warn', info: 'c-blue' }[a.nivel]}><Ic n="alert" s={12} w={2.4} /> {a.txt}</span>;
}
export function UrgPill() {
  return <span className="pill plain" style={{ background: 'var(--bad)', color: '#fff' }}>Urgente</span>;
}

/* Reduce la foto a 1100 px y JPG antes de subirla, para que pese poco. */
export function comprimir(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const m = 1100, sc = Math.min(1, m / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = rej;
      img.src = fr.result;
    };
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

/** Lista de fotos con botón para agregar (sube cada foto al servidor). */
export function Fotos({ fotos, onChange, onOpen, label, flash, subir }) {
  const ref = useRef(null);
  const [subiendo, setSubiendo] = useState(0);
  const add = async (e) => {
    const files = [...e.target.files].slice(0, 8);
    e.target.value = '';
    if (!files.length) return;
    setSubiendo(files.length);
    const urls = [];
    for (const f of files) {
      try { urls.push(await subir(await comprimir(f))); }
      catch (err) { flash(err.message || 'No se pudo subir la foto. Prueba con una JPG o PNG.'); }
      setSubiendo((n) => n - 1);
    }
    setSubiendo(0);
    if (urls.length) onChange([...fotos, ...urls]);
  };
  return (
    <div className="fotos">
      {fotos.map((src, i) => (
        <div className="foto" key={src}>
          <img src={src} alt={label + ' ' + (i + 1)} onClick={() => onOpen(src, label)} loading="lazy" />
          {onChange && (
            <button type="button" className="rm" aria-label="Quitar foto" onClick={() => onChange(fotos.filter((_, j) => j !== i))}>
              <Ic n="x" s={14} />
            </button>
          )}
        </div>
      ))}
      {onChange && (
        <>
          <button type="button" className="add-foto" disabled={subiendo > 0} onClick={() => ref.current?.click()}>
            <Ic n="camera" s={20} />{subiendo > 0 ? 'Subiendo…' : 'Agregar foto'}
          </button>
          <input ref={ref} type="file" accept="image/*" capture="environment" multiple hidden onChange={add} />
        </>
      )}
    </div>
  );
}
