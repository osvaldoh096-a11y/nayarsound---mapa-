// Lectura de Google Sheets con la API oficial y el token de la sesión.
// Solo lectura: el panel nunca llama a métodos que escriben.

import { normalizar } from './fechas.js';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export class ErrorLectura extends Error {
  constructor(mensaje, { estado = null, tipo = 'lectura' } = {}) {
    super(mensaje);
    this.estado = estado;
    this.tipo = tipo;
  }
}

async function pedir(url, token) {
  let respuesta;
  try {
    respuesta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new ErrorLectura('Sin conexión con Google Sheets. Revisa tu internet.', { tipo: 'red' });
  }
  if (respuesta.ok) return respuesta.json();
  let detalle = '';
  try { detalle = (await respuesta.json())?.error?.message ?? ''; } catch { /* sin cuerpo */ }
  const s = respuesta.status;
  if (s === 401) throw new ErrorLectura('La sesión de Google expiró. Toca «Actualizar» para entrar de nuevo.', { estado: s, tipo: 'sesion' });
  if (s === 403) throw new ErrorLectura('Tu cuenta de Google no tiene acceso a este archivo, o falta habilitar la API de Google Sheets.', { estado: s, tipo: 'permiso' });
  if (s === 404) throw new ErrorLectura('No encontré el archivo. Revisa el enlace en «Fuentes».', { estado: s, tipo: 'archivo' });
  if (s === 400) throw new ErrorLectura(`Rango no válido: ¿cambió el nombre de una pestaña? ${detalle}`.trim(), { estado: s, tipo: 'rango' });
  if (s === 429) throw new ErrorLectura('Google limitó las lecturas por un momento. Intenta en un minuto.', { estado: s, tipo: 'limite' });
  throw new ErrorLectura(`Error ${s} de Google Sheets. ${detalle}`.trim(), { estado: s });
}

/** Título, zona horaria y pestañas (con su gid) de un archivo. */
export async function leerMetadatos(token, id) {
  const campos = 'properties(title,timeZone),sheets.properties(sheetId,title)';
  const datos = await pedir(`${API}/${encodeURIComponent(id)}?fields=${encodeURIComponent(campos)}`, token);
  return {
    titulo: datos.properties?.title ?? '',
    zona: datos.properties?.timeZone ?? '',
    pestanas: Object.fromEntries((datos.sheets ?? []).map((s) => [s.properties.title, s.properties.sheetId])),
  };
}

/** Varios rangos de un archivo, con valores sin formato (números y fechas como número de serie). */
export async function leerRangos(token, id, rangos) {
  const params = new URLSearchParams({
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
    majorDimension: 'ROWS',
  });
  for (const r of rangos) params.append('ranges', r);
  const datos = await pedir(`${API}/${encodeURIComponent(id)}/values:batchGet?${params}`, token);
  return (datos.valueRanges ?? []).map((v) => v.values ?? []);
}

// ---------- utilidades sobre la cuadrícula leída ----------

export function letraColumna(indice) {
  let n = indice + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function indiceColumna(letras) {
  return [...letras.toUpperCase()].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
}

/** Fila y columna inicial de un rango A1 como "'AGENDA'!A9:T" */
export function inicioRango(rango) {
  const m = rango.replace(/^.*!/, '').match(/^([A-Z]+)(\d+)?/i);
  return { col: indiceColumna(m[1]), fila: m[2] ? Number(m[2]) : 1 };
}

export function urlHoja(id, gid, a1) {
  let url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit`;
  if (gid !== undefined && gid !== null) url += `#gid=${gid}${a1 ? `&range=${encodeURIComponent(a1)}` : ''}`;
  return url;
}

const ERROR_CELDA = /^#(REF!|N\/A|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|ERROR!|SPILL!|CALC!)/i;

export function esErrorCelda(valor) {
  return typeof valor === 'string' && ERROR_CELDA.test(valor.trim());
}

/**
 * Valor numérico de una celda. Nunca convierte una celda vacía o con error en
 * cero: devuelve { valor: null, estado: 'vacia' | 'error' | 'texto' }.
 */
export function numeroCelda(valor) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return { valor, estado: 'ok' };
  if (valor === undefined || valor === null || valor === '') return { valor: null, estado: 'vacia' };
  if (esErrorCelda(valor)) return { valor: null, estado: 'error', texto: valor };
  return { valor: null, estado: 'texto', texto: String(valor) };
}

/**
 * Busca un encabezado en la cuadrícula y devuelve el primer texto no vacío
 * debajo de él (en la misma columna), como hacen los DASHBOARD de tus hojas.
 */
export function textoBajoEncabezado(cuadricula, encabezado, inicio, { maxFilas = 4 } = {}) {
  const buscado = normalizar(encabezado);
  for (let f = 0; f < cuadricula.length; f++) {
    const fila = cuadricula[f] ?? [];
    for (let c = 0; c < fila.length; c++) {
      if (normalizar(fila[c]) !== buscado) continue;
      for (let k = 1; k <= maxFilas; k++) {
        const valor = cuadricula[f + k]?.[c];
        if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
          return { encontrado: true, texto: String(valor), a1: `${letraColumna(inicio.col + c)}${inicio.fila + f + k}` };
        }
      }
      return { encontrado: true, texto: '', a1: `${letraColumna(inicio.col + c)}${inicio.fila + f + 1}` };
    }
  }
  return { encontrado: false, texto: '', a1: null };
}

/**
 * Convierte filas de una tabla en objetos usando la fila de encabezados.
 * columnas: { clave: 'ENCABEZADO' | ['ENCABEZADO', ocurrencia] }
 */
export function tablaPorEncabezados(filas, filaEncabezado, columnas, inicio) {
  const encabezados = (filas[filaEncabezado] ?? []).map(normalizar);
  const indices = {};
  const faltan = [];
  for (const [clave, def] of Object.entries(columnas)) {
    const [nombre, ocurrencia = 1] = Array.isArray(def) ? def : [def];
    const objetivo = normalizar(nombre);
    let vistos = 0;
    let indice = -1;
    for (let i = 0; i < encabezados.length; i++) {
      if (encabezados[i] === objetivo && ++vistos === ocurrencia) { indice = i; break; }
    }
    if (indice < 0) faltan.push(nombre);
    indices[clave] = indice;
  }
  const registros = [];
  for (let f = filaEncabezado + 1; f < filas.length; f++) {
    const fila = filas[f] ?? [];
    const registro = { fila: inicio.fila + f };
    let vacia = true;
    for (const [clave, i] of Object.entries(indices)) {
      const v = i >= 0 ? fila[i] : undefined;
      registro[clave] = v === undefined ? '' : v;
      if (v !== undefined && v !== '') vacia = false;
    }
    if (!vacia) registros.push(registro);
  }
  return { registros, faltan, indices };
}

/** Busca la fila cuyo contenido (normalizado) coincide con todos los encabezados dados. */
export function buscarFilaEncabezado(filas, encabezados) {
  const buscados = encabezados.map(normalizar);
  return filas.findIndex((fila) => {
    const valores = (fila ?? []).map(normalizar);
    return buscados.every((b) => valores.includes(b));
  });
}
