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

// IDs falsos para la configuración de prueba (20+ caracteres, como los reales).
export const IDS = Object.fromEntries(ORDEN_ARCHIVOS.map((k, i) => [k, `PRUEBA${String.fromCharCode(65 + i)}${'x'.repeat(24)}`]));
export const CLIENTE = '123456789012-pruebapanel.apps.googleusercontent.com';

/**
 * datos: { [clave]: { meta: {titulo, zona, pestanas}, valores: [rango1, rango2, ...] } }
 * fallas: { [clave]: estadoHttp } para simular errores.
 */
export async function simularGoogle(contexto, datos, { fallas = {} } = {}) {
  await contexto.addInitScript(() => {
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (cfg) => ({
            requestAccessToken: () => setTimeout(() => cfg.callback({ access_token: 'token-de-prueba', expires_in: 3600, scope: cfg.scope }), 20),
          }),
          hasGrantedAllScopes: () => true,
          revoke: (_t, cb) => cb?.(),
        },
      },
    };
  });
  await contexto.route('https://accounts.google.com/**', (ruta) => ruta.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  const porId = Object.fromEntries(Object.entries(IDS).map(([k, id]) => [id, k]));
  const lecturas = [];
  await contexto.route('https://sheets.googleapis.com/**', (ruta) => {
    const url = new URL(ruta.request().url());
    const metodo = ruta.request().method();
    const m = url.pathname.match(/\/v4\/spreadsheets\/([^/:]+)(\/values:batchGet)?$/);
    const clave = m && porId[decodeURIComponent(m[1])];
    lecturas.push({ metodo, clave, ruta: url.pathname });
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization' };
    if (metodo === 'OPTIONS') return ruta.fulfill({ status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET' } });
    if (metodo !== 'GET') return ruta.fulfill({ status: 405, headers: cors, body: 'solo lectura' });
    if (ruta.request().headers().authorization !== 'Bearer token-de-prueba') return ruta.fulfill({ status: 401, headers: cors, body: '{}' });
    if (!clave) return ruta.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: '{"error":{"message":"no existe"}}' });
    const falla = typeof fallas[clave] === 'function' ? fallas[clave]() : fallas[clave];
    if (falla) return ruta.fulfill({ status: falla, headers: cors, contentType: 'application/json', body: '{"error":{"message":"simulado"}}' });
    const d = datos[clave];
    if (m[2]) {
      const rangos = url.searchParams.getAll('ranges');
      const esperados = Object.values(ARCHIVOS[clave].rangos);
      const valueRanges = rangos.map((r) => ({ range: r, values: d.valores[esperados.indexOf(r)] ?? [] }));
      return ruta.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ valueRanges }) });
    }
    const sheets = Object.entries(d.meta.pestanas).map(([title, sheetId]) => ({ properties: { title, sheetId } }));
    return ruta.fulfill({
      status: 200, headers: cors, contentType: 'application/json',
      body: JSON.stringify({ properties: { title: d.meta.titulo, timeZone: d.meta.zona }, sheets }),
    });
  });
  return lecturas;
}

/** Convierte las fuentes de demo.js al formato del simulador. */
export function datosDesdeFuentes(fuentes) {
  return Object.fromEntries(Object.entries(fuentes).map(([k, f]) => [k, {
    meta: f.meta, valores: Object.keys(ARCHIVOS[k].rangos).map((r) => f.rangos[r]),
  }]));
}
