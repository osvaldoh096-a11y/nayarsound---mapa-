// Lectura de los textos de recordatorios que ya generan los DASHBOARD de tus
// hojas. El panel no recalcula las reglas: toma lo que la hoja muestra y lo
// convierte en datos. Cualquier línea que no se reconozca se reporta.

import {
  normalizar, inferirFecha, mesDesdeNombre, diaSemanaDesdeNombre,
} from './fechas.js?v=202611092128';
import { leerMontoTexto } from './formato.js?v=202611092128';

const DIAS_RE = 'DOMINGO|LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO';
const TITULO_RE = new RegExp(
  `^(HOY|MANANA|PASADO MANANA|EN (\\d+) DIAS)?\\s*(${DIAS_RE})\\s+(\\d{1,2})\\s+DE\\s+([A-Z]+)$`,
);

function lineas(texto) {
  return String(texto ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

function sinAsteriscos(texto) {
  return texto.replace(/\*/g, '').trim();
}

const ERROR_CELDA = /^#(REF!|N\/A|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|ERROR!|SPILL!|CALC!)/i;

/** Estado de una celda de recordatorio antes de leerla. */
export function estadoCelda(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return 'vacia';
  if (ERROR_CELDA.test(t)) return 'error';
  if (/^(loading|cargando)\.*$/i.test(t)) return 'cargando';
  return 'ok';
}

/**
 * Título de día: "📅 *HOY SÁBADO 7 DE NOVIEMBRE*", "📅 *EN 3 DÍAS MARTES 10 DE NOVIEMBRE*".
 * Devuelve { etiqueta, desfase, idx } o null.
 */
export function leerTituloDia(linea, hoyIdx) {
  if (!linea.startsWith('📅')) return null;
  const t = normalizar(sinAsteriscos(linea.replace(/^📅/u, '')));
  const m = t.match(TITULO_RE);
  if (!m) return null;
  const etiqueta = m[1] || '';
  let desfase = null;
  if (etiqueta === 'HOY') desfase = 0;
  else if (etiqueta === 'MANANA') desfase = 1;
  else if (etiqueta === 'PASADO MANANA') desfase = 2;
  else if (m[2]) desfase = Number(m[2]);
  const idx = inferirFecha(Number(m[4]), mesDesdeNombre(m[5]), hoyIdx, {
    diaSemana: diaSemanaDesdeNombre(m[3]),
  });
  return { etiqueta, desfase, idx };
}

/**
 * Recordatorio de eventos (🐯NAYARSOUND › DASHBOARD › RECORDATORIOS).
 * Formato de la hoja:
 *   📅 *HOY SÁBADO 7 DE MARZO*
 *   📌 3 EVENTOS
 *   🟣 GUADALAJARA: DJ UNO, DJ DOS (2), ...
 */
export function leerAgenda(texto, hoyIdx) {
  const resultado = { estado: estadoCelda(texto), dias: [], noReconocidas: [] };
  if (resultado.estado !== 'ok') return resultado;
  let dia = null;
  for (const linea of lineas(texto)) {
    if (/^😴/u.test(linea) || /no hay eventos/i.test(linea)) {
      resultado.estado = 'sin-eventos';
      continue;
    }
    const titulo = leerTituloDia(linea, hoyIdx);
    if (titulo) {
      dia = { ...titulo, titulo: sinAsteriscos(linea.replace(/^📅/u, '')), eventos: null,
        ciudades: [], sinDjAsignado: false, lineas: [linea] };
      resultado.dias.push(dia);
      continue;
    }
    if (!dia) { resultado.noReconocidas.push(linea); continue; }
    dia.lineas.push(linea);
    const conteo = linea.match(/^📌\s*(\d+)\s+EVENTOS?$/iu);
    if (conteo) { dia.eventos = Number(conteo[1]); continue; }
    if (/^🎧\s*sin dj asignado/iu.test(linea)) { dia.sinDjAsignado = true; continue; }
    const ciudad = linea.match(/^([^\p{L}\p{N}\s]+)\s*([^:]+?)\s*:\s*(.+)$/u);
    if (ciudad) {
      const djs = ciudad[3].split(/\s*,\s*/).filter(Boolean).map((parte) => {
        const n = parte.match(/^(.*?)\s*\((\d+)\)$/);
        return n ? { nombre: n[1].trim(), eventos: Number(n[2]) } : { nombre: parte.trim(), eventos: 1 };
      });
      dia.ciudades.push({ marca: ciudad[1], ciudad: ciudad[2].trim(), djs, linea });
      continue;
    }
    resultado.noReconocidas.push(linea);
  }
  for (const d of resultado.dias) {
    const conDj = d.ciudades.reduce((s, c) => s + c.djs.reduce((a, dj) => a + dj.eventos, 0), 0);
    d.eventosConDj = conDj;
    d.eventosSinDj = d.eventos === null ? null : Math.max(0, d.eventos - conDj);
    d.cuadra = d.eventos !== null && conDj <= d.eventos;
  }
  if (!resultado.dias.length && resultado.estado === 'ok') resultado.estado = 'sin-formato';
  return resultado;
}

/**
 * Recordatorio de deuda (🐯NAYARSOUND › DASHBOARD › RECORDATORIO DE DEUDA).
 *   🎧 NOMBRE | 📌 1 eventos | 💰 $2,000
 *   📅 06 marzo - viernes
 *   💰 TOTAL DE DEUDA: $2,000
 */
export function leerDeuda(texto, hoyIdx) {
  const resultado = { estado: estadoCelda(texto), personas: [], total: null, noReconocidas: [] };
  if (resultado.estado !== 'ok') return resultado;
  let persona = null;
  for (const linea of lineas(texto)) {
    if (/^💸/u.test(linea)) continue;
    if (/sin deudas/i.test(linea)) { resultado.estado = 'sin-deudas'; continue; }
    const total = linea.match(/^💰\s*TOTAL DE DEUDA\s*:\s*(.+)$/iu);
    if (total) { resultado.total = leerMontoTexto(total[1]); persona = null; continue; }
    const p = linea.match(/^🎧\s*(.+?)\s*\|\s*📌\s*(\d+)\s*eventos?\s*\|\s*💰\s*(.+)$/iu);
    if (p) {
      persona = { nombre: p[1].trim(), eventos: Number(p[2]), monto: leerMontoTexto(p[3]),
        fechas: [], lineas: [linea] };
      resultado.personas.push(persona);
      continue;
    }
    const f = linea.match(/^📅\s*(\d{1,2})\s+(\p{L}+)\s*-\s*(\p{L}+)$/u);
    if (f && persona) {
      persona.fechas.push({
        idx: inferirFecha(Number(f[1]), mesDesdeNombre(f[2]), hoyIdx, {
          diaSemana: diaSemanaDesdeNombre(f[3]), modo: 'pasado',
        }),
        texto: linea.replace(/^📅\s*/u, ''),
      });
      persona.lineas.push(linea);
      continue;
    }
    resultado.noReconocidas.push(linea);
  }
  const suma = resultado.personas.reduce((s, p) => s + (p.monto ?? 0), 0);
  resultado.suma = suma;
  resultado.cuadraTotal = resultado.total === null ? null : suma === resultado.total;
  resultado.cuadraFechas = resultado.personas.every((p) => p.fechas.length === p.eventos);
  if (!resultado.personas.length && resultado.estado === 'ok') resultado.estado = 'sin-formato';
  return resultado;
}

/**
 * Recordatorio de 5 días (💵REGISTRO DE PRESTAMOS › DASHBOARD › RESUMEN GENERAL).
 *   📅 *EN 3 DÍAS MARTES 10 DE MARZO*
 *   🟢 COBRAR | NOMBRE | $10.000
 *   🟣 PAGAR | NOMBRE | $900 MXN (50 USDT)
 *   💰 *CAPITAL POR LIQUIDAR*
 *   🔴 *NOMBRE*  /  💵 Capital: $50.000  /  ⏳ Faltan 3 días | 📅 10-mar
 */
export function leerPrestamos(texto, hoyIdx) {
  const resultado = { estado: estadoCelda(texto), dias: [], liquidaciones: [], noReconocidas: [] };
  if (resultado.estado === 'vacia') { resultado.estado = 'sin-recordatorios'; return resultado; }
  if (resultado.estado !== 'ok') return resultado;
  let dia = null;
  let enLiquidaciones = false;
  let liq = null;
  for (const linea of lineas(texto)) {
    if (/RECORDATORIO \d+ D[IÍ]AS/iu.test(linea)) continue;
    if (/CAPITAL POR LIQUIDAR/iu.test(linea)) { enLiquidaciones = true; dia = null; continue; }
    if (!enLiquidaciones) {
      const titulo = leerTituloDia(linea, hoyIdx);
      if (titulo) {
        dia = { ...titulo, titulo: sinAsteriscos(linea.replace(/^📅/u, '')), movimientos: [] };
        resultado.dias.push(dia);
        continue;
      }
      const mov = linea.match(/^(\S+)\s*(COBRAR|PAGAR)\s*\|\s*(.+?)\s*\|\s*(.+)$/u);
      if (mov && dia) {
        const importe = mov[4];
        const usdt = importe.match(/\(\s*([\d.,]+)\s*USDT\s*\)/i);
        dia.movimientos.push({
          accion: mov[2],
          nombre: mov[3].trim(),
          monto: leerMontoTexto(importe),
          moneda: 'MXN',
          monedaIndicada: /MXN/i.test(importe),
          usdt: usdt ? leerMontoTexto(usdt[1]) : null,
          marca: mov[1],
          linea,
        });
        continue;
      }
      resultado.noReconocidas.push(linea);
      continue;
    }
    const nombre = linea.match(/^🔴\s*\*?(.+?)\*?$/u);
    if (nombre) {
      liq = { nombre: nombre[1].trim(), capital: null, idx: null, faltan: null, lineas: [linea] };
      resultado.liquidaciones.push(liq);
      continue;
    }
    if (!liq) { resultado.noReconocidas.push(linea); continue; }
    liq.lineas.push(linea);
    const capital = linea.match(/^💵\s*Capital\s*:\s*(.+)$/iu);
    if (capital) { liq.capital = leerMontoTexto(capital[1]); continue; }
    const fecha = linea.match(/📅\s*(\d{1,2})-(\p{L}+)\.?/u);
    if (fecha) {
      liq.idx = inferirFecha(Number(fecha[1]), mesDesdeNombre(fecha[2]), hoyIdx);
      const faltan = linea.match(/Faltan\s+(\d+)/i);
      liq.faltan = /LIQUIDAR HOY/i.test(linea) ? 0 : (faltan ? Number(faltan[1]) : null);
      continue;
    }
    resultado.noReconocidas.push(linea);
  }
  if (!resultado.dias.length && !resultado.liquidaciones.length && resultado.estado === 'ok') {
    resultado.estado = 'sin-formato';
  }
  return resultado;
}

/** Celdas de control tipo "HAY 2 BUSCAR ❌" / "EN ORDEN ✅". */
export function leerControl(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return null;
  if (ERROR_CELDA.test(t)) return { estado: 'error', texto: t, cantidad: null };
  const mal = t.includes('❌');
  const bien = t.includes('✅');
  if (!mal && !bien) return null;
  const n = t.match(/(\d+)/);
  return { estado: mal ? 'falla' : 'ok', texto: t, cantidad: n ? Number(n[1]) : null };
}
