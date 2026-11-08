// Servidor local de la carpeta del repositorio y simulador de Google
// (inicio de sesión y API de Sheets) para probar el panel en Chromium.
// Con --snapshot usa una copia real guardada FUERA del repositorio.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHIVOS, ORDEN_ARCHIVOS } from '../js/fuentes.js';

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

// IDs de los archivos que lee el panel (el simulador responde por ellos).
export const IDS = Object.fromEntries(ORDEN_ARCHIVOS.map((k) => [k, ARCHIVOS[k].id]));

/**
 * Simula el inicio de sesión de Google y la API de Sheets (values:batchGet).
 * datos: { [clave]: { meta: {titulo, zona, pestanas}, valores: [rango1, rango2, ...] } }
 * fallas: { [clave]: estadoHttp | () => estadoHttp } para simular errores.
 */
export async function simularGoogle(contexto, datos, { fallas = {} } = {}) {
  await contexto.addInitScript(() => {
    window.google = { accounts: { oauth2: {
      initTokenClient: (cfg) => ({
        requestAccessToken: () => setTimeout(() => cfg.callback({ access_token: 'token-de-prueba', expires_in: 3600, scope: cfg.scope }), 20),
      }),
      hasGrantedAllScopes: () => true,
      revoke: (_t, cb) => cb?.(),
    } } };
  });
  await contexto.route('https://accounts.google.com/**', (ruta) => ruta.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  const porId = Object.fromEntries(Object.entries(IDS).map(([k, id]) => [id, k]));
  const lecturas = [];
  const num = (l) => [...l].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
  const partir = (r) => {
    const m = r.match(/^'?(.+?)'?!([A-Z]+)(\d+)(?::([A-Z]+)(\d+)?)?$/);
    return { hoja: m[1], c1: num(m[2]), f1: Number(m[3]), c2: m[4] ? num(m[4]) : num(m[2]), f2: m[5] ? Number(m[5]) : (m[4] ? null : Number(m[3])) };
  };
  // Cuadrícula completa de una pestaña y su esquina superior izquierda.
  const cuadricula = (clave, hoja) => {
    const rangos = Object.values(ARCHIVOS[clave].rangos);
    const i = rangos.findIndex((r) => partir(r).hoja === hoja);
    if (i < 0) return null;
    const base = partir(rangos[i]);
    return { filas: datos[clave].valores[i] ?? (datos[clave].valores[i] = []), base };
  };
  const recorte = (clave, rango) => {
    const esperados = Object.values(ARCHIVOS[clave].rangos);
    const exacto = esperados.indexOf(rango);
    if (exacto >= 0) return datos[clave].valores[exacto] ?? [];
    const r = partir(rango);
    const g = cuadricula(clave, r.hoja);
    if (!g) return [];
    const salida = [];
    for (let f = r.f1; f <= (r.f2 ?? r.f1 + g.filas.length); f++) {
      const fila = g.filas[f - g.base.f1] ?? [];
      salida.push(Array.from({ length: r.c2 - r.c1 + 1 }, (_, k) => fila[r.c1 - g.base.c1 + k] ?? ''));
    }
    return salida;
  };
  await contexto.route('https://sheets.googleapis.com/**', async (ruta) => {
    const url = new URL(ruta.request().url());
    const metodo = ruta.request().method();
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, PUT' };
    if (metodo === 'OPTIONS') return ruta.fulfill({ status: 204, headers: cors });
    const m = url.pathname.match(/\/v4\/spreadsheets\/([^/:]+)\/values(?::batchGet|\/(.+))$/);
    const clave = m && porId[decodeURIComponent(m[1])];
    if (ruta.request().headers().authorization !== 'Bearer token-de-prueba') return ruta.fulfill({ status: 401, headers: cors, body: '{}' });
    if (!clave) return ruta.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: '{"error":{"message":"no existe"}}' });
    if (metodo === 'PUT' && m[2]) {
      const celda = decodeURIComponent(m[2]);
      const valor = JSON.parse(ruta.request().postData() ?? '{}').values?.[0]?.[0];
      lecturas.push({ metodo, clave, celda, valor });
      const r = partir(celda);
      const g = cuadricula(clave, r.hoja);
      const fila = g.filas[r.f1 - g.base.f1] ?? (g.filas[r.f1 - g.base.f1] = []);
      fila[r.c1 - g.base.c1] = valor;
      return ruta.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ updatedCells: 1 }) });
    }
    lecturas.push({ metodo, clave });
    if (metodo !== 'GET') return ruta.fulfill({ status: 405, headers: cors, body: 'no permitido' });
    const falla = typeof fallas[clave] === 'function' ? fallas[clave]() : fallas[clave];
    if (falla) return ruta.fulfill({ status: falla, headers: cors, contentType: 'application/json', body: '{"error":{"message":"simulado"}}' });
    const valueRanges = url.searchParams.getAll('ranges').map((r) => ({ range: r, values: recorte(clave, r) }));
    return ruta.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ valueRanges }) });
  });
  return lecturas;
}

/** Convierte las fuentes de demo.js al formato del simulador. */
export function datosDesdeFuentes(fuentes) {
  return Object.fromEntries(Object.entries(fuentes).map(([k, f]) => [k, {
    meta: f.meta, valores: Object.keys(ARCHIVOS[k].rangos).map((r) => f.rangos[r]),
  }]));
}
