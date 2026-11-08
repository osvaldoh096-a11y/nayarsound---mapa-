// Lectura de hojas compartidas por enlace con la consulta gviz de Google
// Sheets, por JSONP (el mismo método que usa el mapa). No requiere inicio de
// sesión: la hoja debe estar como «Cualquier persona con el enlace: Lector».
//
// gviz da un solo tipo de dato por columna; por eso cada rango se pide en
// tramos (controles, encabezados, datos) y luego se vuelve a unir en una sola
// cuadrícula igual a la de la API de Sheets: números, textos y fechas como
// número de serie.

const ESPERA_MS = 15000;
let contador = 0;

export class ErrorLectura extends Error {
  constructor(mensaje, tipo = 'lectura') {
    super(mensaje);
    this.tipo = tipo;
  }
}

/** Divide "'PESTAÑA'!A11:U" en { pestana, colIni, colFin, filaIni, filaFin|null } */
export function partirRango(rango) {
  const m = rango.match(/^'?(.+?)'?!([A-Z]+)(\d+):([A-Z]+)(\d+)?$/);
  if (!m) throw new Error(`Rango no válido: ${rango}`);
  return { pestana: m[1], colIni: m[2], filaIni: Number(m[3]), colFin: m[4], filaFin: m[5] ? Number(m[5]) : null };
}

/** Tramos de filas: [11, 12, 13] -> A11:U11, A12:U12, A13:U */
export function rangosDeTramos(rango, tramos) {
  const r = partirRango(rango);
  const inicios = tramos?.length ? tramos : [r.filaIni];
  return inicios.map((ini, i) => {
    const fin = i < inicios.length - 1 ? inicios[i + 1] - 1 : r.filaFin;
    return { a1: `${r.colIni}${ini}:${r.colFin}${fin ?? ''}`, filaIni: ini, filaFin: fin };
  });
}

const DIA_MS = 86400000;

/** Valor de una celda gviz al formato de la API de Sheets (UNFORMATTED_VALUE). */
export function valorCelda(celda, tipo) {
  if (!celda || celda.v === null || celda.v === undefined) return '';
  const v = celda.v;
  if (typeof v === 'string') {
    const f = v.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/);
    if (f && (tipo === 'date' || tipo === 'datetime')) {
      const ms = Date.UTC(+f[1], +f[2], +f[3], +(f[4] ?? 0), +(f[5] ?? 0), +(f[6] ?? 0));
      return ms / DIA_MS + 25569;
    }
    return v;
  }
  if (Array.isArray(v) && tipo === 'timeofday') {
    const [h = 0, mi = 0, s = 0] = v;
    return (h * 3600 + mi * 60 + s) / 86400;
  }
  return v;
}

/** Respuesta gviz -> filas (arreglos de valores). */
export function filasDesdeGviz(respuesta, columnas) {
  if (respuesta?.status === 'error') {
    const detalle = (respuesta.errors ?? []).map((e) => e.detailed_message || e.message).join(' ');
    throw new ErrorLectura(`Google Sheets respondió con un error: ${detalle || 'sin detalle'}`, 'rango');
  }
  const tabla = respuesta?.table;
  if (!tabla) throw new ErrorLectura('Respuesta de Google Sheets sin datos.');
  const tipos = (tabla.cols ?? []).map((c) => c.type);
  return (tabla.rows ?? []).map((fila) => {
    const valores = Array.from({ length: columnas }, (_, i) => valorCelda(fila?.c?.[i], tipos[i]));
    while (valores.length && valores[valores.length - 1] === '') valores.pop();
    return valores;
  });
}

function anchoColumnas(rango) {
  const { colIni, colFin } = partirRango(rango);
  const n = (l) => [...l].reduce((s, c) => s * 26 + c.charCodeAt(0) - 64, 0);
  return n(colFin) - n(colIni) + 1;
}

/** Una consulta JSONP. */
function consultar(id, pestana, a1) {
  return new Promise((resolve, reject) => {
    const nombre = `__panelGviz${Date.now()}_${contador++}`;
    const script = document.createElement('script');
    let terminado = false;
    const terminar = () => {
      terminado = true;
      clearTimeout(reloj);
      delete window[nombre];
      script.remove();
    };
    const reloj = setTimeout(() => {
      if (terminado) return;
      terminar();
      reject(new ErrorLectura('Google Sheets no respondió a tiempo. Revisa tu conexión.', 'red'));
    }, ESPERA_MS);
    window[nombre] = (respuesta) => {
      if (terminado) return;
      terminar();
      resolve(respuesta);
    };
    script.onerror = () => {
      if (terminado) return;
      terminar();
      reject(new ErrorLectura('No se pudo leer la hoja. Revisa que esté compartida como «Cualquier persona con el enlace» y tu conexión.', 'permiso'));
    };
    script.src = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/gviz/tq?sheet=${encodeURIComponent(pestana)}`
      + `&range=${encodeURIComponent(a1)}&headers=0&tqx=out:json;responseHandler:${nombre}`;
    document.head.appendChild(script);
  });
}

/**
 * Lee un rango completo (en tramos) y devuelve la cuadrícula unida, con las
 * filas en su posición real aunque un tramo venga con menos filas.
 */
export async function leerRango(id, rango, tramos) {
  const { pestana } = partirRango(rango);
  const columnas = anchoColumnas(rango);
  const partes = rangosDeTramos(rango, tramos);
  const respuestas = await Promise.all(partes.map((p) => consultar(id, pestana, p.a1)));
  const cuadricula = [];
  const filaBase = partes[0].filaIni;
  partes.forEach((p, i) => {
    const filas = filasDesdeGviz(respuestas[i], columnas);
    const alto = p.filaFin ? p.filaFin - p.filaIni + 1 : filas.length;
    for (let k = 0; k < alto; k++) cuadricula[p.filaIni - filaBase + k] = filas[k] ?? [];
  });
  while (cuadricula.length && !(cuadricula[cuadricula.length - 1] ?? []).length) cuadricula.pop();
  return Array.from(cuadricula, (f) => f ?? []);
}
