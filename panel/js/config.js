// Configuración privada: ID de cliente de Google y los IDs de tus hojas.
// No vive en el repositorio: llega con un enlace de configuración
// (…/panel/#config=…) o se escribe en «Fuentes», y se guarda solo en este
// navegador. Lo que va después de "#" nunca se envía a ningún servidor.

import { ORDEN_ARCHIVOS } from './fuentes.js';

const CLAVE = 'panel.config.v1';
const CLAVE_PREF = 'panel.preferencias.v1';

const RE_ID = /^[A-Za-z0-9_-]{20,}$/;
const RE_CLIENTE = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

function leerLocal(clave) {
  try { return JSON.parse(localStorage.getItem(clave) ?? 'null'); } catch { return null; }
}

function guardarLocal(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); return true; } catch { return false; }
}

/** Extrae el ID de un enlace de Google Sheets o lo devuelve si ya es un ID. */
export function idDesdeEnlace(texto) {
  const t = String(texto ?? '').trim();
  const m = t.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  const id = m ? m[1] : t;
  return RE_ID.test(id) ? id : null;
}

export function validarConfig(cfg) {
  const errores = [];
  if (!cfg || typeof cfg !== 'object') return ['Configuración vacía.'];
  if (!RE_CLIENTE.test(String(cfg.clienteId ?? '').trim())) {
    errores.push('El ID de cliente de Google debe terminar en .apps.googleusercontent.com.');
  }
  for (const clave of ORDEN_ARCHIVOS) {
    if (!RE_ID.test(String(cfg.archivos?.[clave] ?? ''))) errores.push(`Falta el enlace de «${clave}».`);
  }
  return errores;
}

export function leerConfig() {
  const cfg = leerLocal(CLAVE);
  return cfg && validarConfig(cfg).length === 0 ? cfg : null;
}

export function guardarConfig(cfg) {
  return guardarLocal(CLAVE, cfg);
}

export function borrarConfig() {
  try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
}

function base64UrlADecodificado(texto) {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
}

export function codificarConfig(cfg) {
  const bytes = new TextEncoder().encode(JSON.stringify(cfg));
  let binario = '';
  bytes.forEach((b) => { binario += String.fromCharCode(b); });
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Lee "#config=…" del enlace. Devuelve { cfg, errores } o null si no hay. */
export function configDesdeHash(hash) {
  const m = String(hash ?? '').match(/[#&]config=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const cfg = JSON.parse(base64UrlADecodificado(m[1]));
    return { cfg, errores: validarConfig(cfg) };
  } catch {
    return { cfg: null, errores: ['El enlace de configuración está incompleto.'] };
  }
}

const PREF_INICIAL = { autoMinutos: 15 };

export function leerPreferencias() {
  return { ...PREF_INICIAL, ...(leerLocal(CLAVE_PREF) ?? {}) };
}

export function guardarPreferencias(pref) {
  guardarLocal(CLAVE_PREF, pref);
}
