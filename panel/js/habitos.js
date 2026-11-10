// Hábitos diarios del Inicio. Se guardan en la pestaña HABITOS de tu hoja
// «TO DO · Dashboard personal»: columna A = FECHA, una columna por hábito
// (encabezado = nombre del hábito) y «SI» el día que lo cumpliste. Para
// agregar otro hábito basta con escribir su nombre en la fila 1.

import { TAREAS } from './fuentes.js?v=202611100136';
import { leerRangos, agregarFila, escribirRango } from './api.js?v=202611100136';
import { idxDesdeSerial, idxDesdeYMD, ymdDesdeIdx, normalizar } from './fechas.js?v=202611100136';
import { esc } from './formato.js?v=202611100136';

const H = "'HABITOS'";
export const URL_HABITOS = `https://docs.google.com/spreadsheets/d/${TAREAS.id}/edit#gid=779`;

/** Estado: habitos (nombres, en orden de columnas), dias: Map idx → { fila, hechos: Set(columna) } */
export const HB = { estado: 'sin-leer', habitos: [], dias: new Map(), error: null, guardando: 0, demo: false };

const hecho = (v) => v === true || ['SI', 'SÍ', 'X', '✓', '✅', 'TRUE', '1'].includes(String(v ?? '').trim().toUpperCase());

function fechaDe(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return idxDesdeSerial(v);
  const m = String(v ?? '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return m ? idxDesdeYMD(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

export function leerHabitos(valores) {
  const encabezados = (valores?.[0] ?? []).slice(1).map((t) => String(t ?? '').trim());
  const habitos = encabezados.map((nombre, i) => ({ nombre, col: i + 1 })).filter((h) => h.nombre);
  const dias = new Map();
  (valores ?? []).slice(1).forEach((f, i) => {
    const idx = fechaDe(f?.[0]);
    if (idx === null) return;
    const previo = dias.get(idx);
    const hechos = previo?.hechos ?? new Set();
    habitos.forEach((h) => { if (hecho(f?.[h.col])) hechos.add(h.col); });
    dias.set(idx, { fila: previo?.fila ?? i + 2, hechos });
  });
  return { habitos, dias };
}

export async function cargarHabitos(token) {
  if (HB.demo) return;
  try {
    const [v] = await leerRangos(token, TAREAS.id, [`${H}!A1:Z1500`]);
    Object.assign(HB, leerHabitos(v), { estado: 'ok', error: null });
  } catch (error) {
    HB.estado = HB.habitos.length ? 'ok' : 'error';
    HB.error = error.message;
  }
}

export function usarDemoHabitos(hoyIdx) {
  const dias = new Map();
  for (let d = 1; d <= 12; d++) dias.set(hoyIdx - d, { fila: 14 - d, hechos: new Set(d <= 4 ? [1, 2] : d % 2 ? [2] : [1, 2]) });
  Object.assign(HB, { demo: true, estado: 'ok', error: null, habitos: [{ nombre: 'IR AL GYM', col: 1 }, { nombre: 'CAMINAR 30 MINUTOS', col: 2 }], dias });
}

/** Racha, días del mes, total y los últimos 7 días de un hábito. */
export function estadisticas(col, hoyIdx) {
  const hizo = (idx) => HB.dias.get(idx)?.hechos.has(col) ?? false;
  // Racha: días seguidos hasta hoy (si hoy aún no lo marcas, cuenta hasta ayer).
  let racha = 0;
  let d = hizo(hoyIdx) ? hoyIdx : hoyIdx - 1;
  while (hizo(d)) { racha += 1; d -= 1; }
  const fechas = [...HB.dias.keys()].sort((a, b) => a - b);
  let mejor = 0; let seguidos = 0;
  if (fechas.length) {
    for (let i = fechas[0]; i <= Math.max(fechas.at(-1), hoyIdx); i++) {
      seguidos = hizo(i) ? seguidos + 1 : 0;
      mejor = Math.max(mejor, seguidos);
    }
  }
  const { y, m, d: diaHoy } = ymdDesdeIdx(hoyIdx);
  const inicioMes = idxDesdeYMD(y, m, 1);
  let mes = 0;
  for (let i = inicioMes; i <= hoyIdx; i++) if (hizo(i)) mes += 1;
  const total = fechas.filter(hizo).length;
  const semana = Array.from({ length: 7 }, (_, i) => ({ idx: hoyIdx - 6 + i, hecho: hizo(hoyIdx - 6 + i) }));
  return { hoy: hizo(hoyIdx), racha, mejor, mes, diasMes: diaHoy, total, semana };
}

function hoyTexto() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
}

/** Marca o desmarca un hábito de hoy (primero en pantalla; si falla, se deshace). */
export async function alternarHabito(col, hoyIdx, obtenerToken, repintar) {
  const dia = HB.dias.get(hoyIdx) ?? { fila: null, hechos: new Set() };
  HB.dias.set(hoyIdx, dia);
  const antes = dia.hechos.has(col);
  if (antes) dia.hechos.delete(col); else dia.hechos.add(col);
  HB.error = null;
  repintar();
  if (HB.demo) return;
  HB.guardando += 1;
  try {
    const token = await obtenerToken();
    const ancho = Math.max(...HB.habitos.map((h) => h.col));
    if (dia.fila) {
      // Comprueba que la fila sigue siendo la de hoy antes de escribir.
      const [v] = await leerRangos(token, TAREAS.id, [`${H}!A${dia.fila}`]);
      if (fechaDe(v?.[0]?.[0]) !== hoyIdx) throw new Error('La fila de hoy cambió en tu hoja. Toca «Actualizar» y vuelve a marcar.');
      const letra = String.fromCharCode(65 + col);
      await escribirRango(token, TAREAS.id, `${H}!${letra}${dia.fila}`, [[antes ? '' : 'SI']]);
    } else {
      const fila = [hoyTexto(), ...Array.from({ length: ancho }, (_, i) => (dia.hechos.has(i + 1) ? 'SI' : ''))];
      dia.fila = await agregarFila(token, TAREAS.id, `${H}!A1:${String.fromCharCode(65 + ancho)}1`, fila, { entrada: 'USER_ENTERED' });
    }
  } catch (error) {
    if (antes) dia.hechos.add(col); else dia.hechos.delete(col);
    HB.error = error.message;
  } finally {
    HB.guardando -= 1;
    repintar();
  }
}

const nombreBonito = (t) => {
  const s = String(t ?? '').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const DIA_CORTO = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

/** Tarjeta de hábitos (se repinta sola). */
export function htmlHabitos(hoyIdx) {
  if (HB.estado === 'sin-leer') return '<div class="hb-cab"><h2 class="etq-cab">Hábitos de hoy</h2></div><p class="sin-dato">Leyendo tus hábitos…</p>';
  if (HB.estado === 'error') return `<div class="hb-cab"><h2 class="etq-cab">Hábitos de hoy</h2></div><p class="tareas-error">${esc(HB.error ?? 'No pude leer la pestaña HABITOS.')}</p>`;
  const filas = HB.habitos.map((h) => {
    const e = estadisticas(h.col, hoyIdx);
    return `<div class="hb-fila ${e.hoy ? 'hecho' : ''}">
      <button class="hb-check" data-accion="habito" data-col="${h.col}" aria-pressed="${e.hoy}" aria-label="${esc(nombreBonito(h.nombre))}: ${e.hoy ? 'hecho hoy' : 'pendiente hoy'}">
        <span class="hb-caja" aria-hidden="true">${e.hoy ? '✓' : ''}</span>
        <span class="hb-nombre">${esc(nombreBonito(h.nombre))}</span>
      </button>
      <div class="hb-semana" aria-label="Últimos 7 días">${e.semana.map((s) => `<i class="${s.hecho ? 'si' : ''} ${s.idx === hoyIdx ? 'hoy' : ''}" title="${s.hecho ? 'Hecho' : 'No'}"><b>${DIA_CORTO[new Date(s.idx * 86400000).getUTCDay()]}</b></i>`).join('')}</div>
      <div class="hb-datos">
        <span class="hb-racha ${e.racha ? 'activa' : ''}"><b>${e.racha}</b> ${e.racha === 1 ? 'día seguido' : 'días seguidos'}</span>
        <span><b>${e.mes}</b> de ${e.diasMes} este mes</span>
        <span><b>${e.total}</b> en total${e.mejor > 1 ? ` · mejor racha ${e.mejor}` : ''}</span>
      </div>
    </div>`;
  }).join('');
  return `<div class="hb-cab"><h2 class="etq-cab">Hábitos de hoy</h2><span class="tareas-estado">${HB.guardando ? 'Guardando…' : ''}</span>
      <a class="enlace-vista" href="${URL_HABITOS}" target="_blank" rel="noopener">Abrir hoja</a></div>
    ${HB.error ? `<p class="tareas-error">${esc(HB.error)}</p>` : ''}
    ${filas || '<p class="vacio">Escribe tus hábitos en la fila 1 de la pestaña HABITOS.</p>'}`;
}
