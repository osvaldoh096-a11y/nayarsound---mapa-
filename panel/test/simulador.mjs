// Servidor local de la carpeta del repositorio y simulador de Google Sheets
// (consulta gviz por JSONP) para probar el panel en Chromium.
// Con --snapshot usa una copia real guardada FUERA del repositorio.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHIVOS, ORDEN_ARCHIVOS } from '../js/fuentes.js';
import { partirRango } from '../js/gviz.js';
import { cifrar } from '../js/acceso.js';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};

export function servir() {
  return new Promise((resolve) => {
    const servidor = createServer(async (req, res) => {
      const ruta = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
      let archivo = join(RAIZ, ruta);
      if (archivo.endsWith('/')) archivo += 'index.html';
      try {
        const cuerpo = await readFile(archivo);
        res.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream' });
        res.end(cuerpo);
      } catch {
        res.writeHead(404); res.end('no encontrado');
      }
    });
    servidor.listen(0, '127.0.0.1', () => resolve({ servidor, url: `http://127.0.0.1:${servidor.address().port}` }));
  });
}

// IDs falsos para la configuración de prueba (20+ caracteres, como los reales).
export const IDS = Object.fromEntries(ORDEN_ARCHIVOS.map((k, i) => [k, `PRUEBA${String.fromCharCode(65 + i)}${'x'.repeat(24)}`]));
export const CONTRASENA = 'prueba-de-panel-123';

export function configPrueba(datos) {
  return {
    archivos: Object.fromEntries(ORDEN_ARCHIVOS.map((k) => [k, {
      id: IDS[k], pestanas: datos[k]?.meta?.pestanas ?? {}, zona: datos[k]?.meta?.zona ?? '',
    }])),
  };
}

/** Imita a gviz: un tipo por columna; los valores del tipo minoritario llegan vacíos. */
function tablaGviz(filas, columnas, colIni) {
  const tipos = Array.from({ length: columnas }, (_, c) => {
    let numeros = 0; let textos = 0;
    for (const f of filas) {
      const v = f?.[c];
      if (v === undefined || v === null || v === '') continue;
      if (typeof v === 'number') numeros += 1; else textos += 1;
    }
    return numeros > textos ? 'number' : 'string';
  });
  const rows = filas.map((f) => ({
    c: tipos.map((tipo, c) => {
      const v = f?.[c];
      if (v === undefined || v === null || v === '') return null;
      if (tipo === 'number' && typeof v !== 'number') return null;
      if (tipo === 'string' && typeof v === 'number') return null;
      return { v };
    }),
  }));
  while (rows.length && rows[rows.length - 1].c.every((x) => x === null)) rows.pop();
  const letra = (n) => { let t = ''; for (let k = n; k > 0; k = Math.floor((k - 1) / 26)) t = String.fromCharCode(65 + ((k - 1) % 26)) + t; return t; };
  return { cols: tipos.map((type, i) => ({ id: letra(letraANum(colIni) + i), label: '', type })), rows };
}

const letraANum = (l) => [...l].reduce((s, c) => s * 26 + c.charCodeAt(0) - 64, 0);

/**
 * datos: { [clave]: { meta: {titulo, zona, pestanas}, valores: [rango1, rango2, ...] } }
 * fallas: { [clave]: estadoHttp | () => estadoHttp } para simular errores.
 */
export async function simularGoogle(contexto, datos, { fallas = {}, contrasena = CONTRASENA } = {}) {
  const paquete = await cifrar(configPrueba(datos), contrasena);
  await contexto.route('**/panel/acceso.json', (ruta) => ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paquete) }));
  const porId = Object.fromEntries(Object.entries(IDS).map(([k, id]) => [id, k]));
  const lecturas = [];
  await contexto.route('https://docs.google.com/**', (ruta) => {
    const url = new URL(ruta.request().url());
    const m = url.pathname.match(/\/spreadsheets\/d\/([^/]+)\/gviz\/tq$/);
    const clave = m && porId[decodeURIComponent(m[1])];
    const pestana = url.searchParams.get('sheet');
    const a1 = url.searchParams.get('range');
    const manejador = (url.searchParams.get('tqx') ?? '').match(/responseHandler:([\w$]+)/)?.[1];
    lecturas.push({ metodo: ruta.request().method(), clave, pestana, a1 });
    if (!clave || !manejador) return ruta.fulfill({ status: 404, body: 'no encontrado' });
    const falla = typeof fallas[clave] === 'function' ? fallas[clave]() : fallas[clave];
    if (falla) return ruta.fulfill({ status: falla, body: 'simulado' });
    const entradas = Object.entries(ARCHIVOS[clave].rangos);
    const i = entradas.findIndex(([, r]) => partirRango(r).pestana === pestana);
    let respuesta;
    if (i < 0) {
      respuesta = { version: '0.6', status: 'error', errors: [{ reason: 'invalid_query', message: 'INVALID_QUERY', detailed_message: `Invalid sheet ${pestana}` }] };
    } else {
      const completo = partirRango(entradas[i][1]);
      const pedido = a1.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)?$/);
      const desde = Number(pedido[2]) - completo.filaIni;
      const hasta = pedido[4] ? Number(pedido[4]) - completo.filaIni + 1 : undefined;
      const filas = (datos[clave].valores[i] ?? []).slice(desde, hasta);
      respuesta = { version: '0.6', status: 'ok', table: tablaGviz(filas, letraANum(pedido[3]) - letraANum(pedido[1]) + 1, pedido[1]) };
    }
    return ruta.fulfill({ status: 200, contentType: 'text/javascript', body: `/*O_o*/\n${manejador}(${JSON.stringify(respuesta)});` });
  });
  return lecturas;
}

/** Convierte las fuentes de demo.js al formato del simulador. */
export function datosDesdeFuentes(fuentes) {
  return Object.fromEntries(Object.entries(fuentes).map(([k, f]) => [k, {
    meta: f.meta, valores: Object.keys(ARCHIVOS[k].rangos).map((r) => f.rangos[r]),
  }]));
}
