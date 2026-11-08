// Configuración ya descifrada (IDs de tus hojas y sus pestañas). Si eliges
// «Recordar en este dispositivo», se guarda solo en este navegador para no
// pedir la contraseña cada vez. «Salir» la borra.

import { ORDEN_ARCHIVOS } from './fuentes.js';

const CLAVE = 'panel.acceso.v1';
const CLAVE_PREF = 'panel.preferencias.v1';
const RE_ID = /^[A-Za-z0-9_-]{20,}$/;

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

/** { archivos: { nayarsound: { id, pestanas: { DASHBOARD: gid, … }, zona }, … } } */
export function validarConfig(cfg) {
  if (!cfg || typeof cfg !== 'object' || !cfg.archivos) return ['Configuración vacía.'];
  return ORDEN_ARCHIVOS
    .filter((clave) => !RE_ID.test(String(cfg.archivos[clave]?.id ?? '')))
    .map((clave) => `Falta el archivo «${clave}».`);
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

const PREF_INICIAL = { autoMinutos: 15 };

export function leerPreferencias() {
  return { ...PREF_INICIAL, ...(leerLocal(CLAVE_PREF) ?? {}) };
}

export function guardarPreferencias(pref) {
  guardarLocal(CLAVE_PREF, pref);
}
