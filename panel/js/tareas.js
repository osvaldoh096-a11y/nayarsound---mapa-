// Lista de tareas del Inicio. Se guarda en su propia hoja de Google
// («TO DO · Dashboard personal», pestaña TAREAS), así que la ves y editas
// también desde Sheets. Antes de cambiar o borrar una fila se comprueba que
// sigue siendo la misma tarea.

import { TAREAS } from './fuentes.js?v=202611090327';
import { leerRangos, agregarFila, escribirRango, borrarRango } from './api.js?v=202611090327';
import { esc, plural } from './formato.js?v=202611090327';
import { icono } from './iconos.js?v=202611090327';

const H = `'${TAREAS.pestana}'`;
const RANGO = `${H}!A2:D`;

/** Estado: { estado: 'sin-leer'|'leyendo'|'ok'|'error', lista, error, demo } */
export const T = { estado: 'sin-leer', lista: [], error: null, demo: false, guardando: 0, verHechas: false };

function ahoraTexto() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

const esHecha = (v) => ['SI', 'SÍ', 'TRUE', 'X', '✓', '✅'].includes(String(v ?? '').trim().toUpperCase()) || v === true;

export function leerFilas(valores) {
  return (valores ?? []).map((f, i) => ({
    fila: i + 2,
    texto: String(f?.[0] ?? '').trim(),
    hecha: esHecha(f?.[1]),
    creada: String(f?.[2] ?? ''),
    completada: String(f?.[3] ?? ''),
  })).filter((t) => t.texto);
}

/** Número para WhatsApp: solo dígitos; 10 dígitos se toman como de México (52). */
export function numeroWhatsApp(texto) {
  const d = String(texto ?? '').replace(/\D/g, '');
  if (d.length === 10) return `52${d}`;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

function claveNombre(n) {
  return String(n ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function leerTelefonos(valores) {
  const mapa = new Map();
  for (const f of valores ?? []) {
    const nombre = claveNombre(f?.[0]);
    const numero = numeroWhatsApp(f?.[1]);
    if (nombre) mapa.set(nombre, { numero, texto: String(f?.[1] ?? '').trim() });
  }
  return mapa;
}

/** { numero } si el DJ tiene teléfono válido; { numero: null, texto } si está mal escrito; null si no aparece. */
export function telefonoDe(nombre) {
  return T.telefonos?.get(claveNombre(nombre)) ?? null;
}

export const URL_TELEFONOS = `https://docs.google.com/spreadsheets/d/${TAREAS.id}/edit#gid=${TAREAS.gidTelefonos}`;

export function usarDemo() {
  Object.assign(T, {
    demo: true, estado: 'ok', error: null,
    telefonos: leerTelefonos([['DJ ALFA', '33 1234 5678']]),
    lista: [
      { fila: 2, texto: 'Llamar al proveedor de luces', hecha: false },
      { fila: 3, texto: 'Revisar contrato del evento del sábado', hecha: false },
      { fila: 4, texto: 'Pagar internet', hecha: true },
    ],
  });
}

export async function cargarTareas(token) {
  if (T.demo) return;
  if (T.estado !== 'ok') T.estado = 'leyendo';
  try {
    const [valores, telefonos] = await leerRangos(token, TAREAS.id, [RANGO, `'${TAREAS.telefonos}'!A2:B`]);
    T.lista = leerFilas(valores);
    T.telefonos = leerTelefonos(telefonos);
    T.estado = 'ok';
    T.error = null;
  } catch (error) {
    T.estado = T.lista.length ? 'ok' : 'error';
    T.error = error.message;
  }
}

/** Comprueba que la fila sigue teniendo el mismo texto antes de tocarla. */
async function verificar(token, t) {
  const [v] = await leerRangos(token, TAREAS.id, [`${H}!A${t.fila}`]);
  if (String(v?.[0]?.[0] ?? '').trim() !== t.texto) {
    throw new Error(`La tarea «${t.texto}» cambió o se movió en tu hoja. Toca «Actualizar» y vuelve a intentarlo.`);
  }
}

/** Ejecuta un cambio: primero en pantalla, luego en la hoja; si falla, lo deshace. */
async function cambiar(obtenerToken, repintar, aplicar, deshacer, escribir) {
  aplicar();
  T.error = null;
  repintar();
  if (T.demo) return;
  T.guardando++;
  try {
    const token = await obtenerToken();
    await escribir(token);
  } catch (error) {
    deshacer();
    T.error = error.message;
  } finally {
    T.guardando--;
    repintar();
  }
}

export function agregarTarea(texto, obtenerToken, repintar) {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!limpio) return;
  const nueva = { fila: null, texto: limpio, hecha: false, nueva: true };
  return cambiar(obtenerToken, repintar,
    () => { T.lista.push(nueva); },
    () => { T.lista = T.lista.filter((t) => t !== nueva); },
    async (token) => {
      nueva.fila = await agregarFila(token, TAREAS.id, `${H}!A1:D1`, [limpio, '', ahoraTexto(), '']);
      nueva.nueva = false;
      if (!nueva.fila) await cargarTareas(token);
    });
}

export function alternarTarea(t, obtenerToken, repintar) {
  if (!t || (!t.fila && !T.demo)) return;
  const antes = t.hecha;
  return cambiar(obtenerToken, repintar,
    () => { t.hecha = !antes; },
    () => { t.hecha = antes; },
    async (token) => {
      await verificar(token, t);
      await escribirRango(token, TAREAS.id, `${H}!B${t.fila}`, [[antes ? '' : 'SI']]);
      await escribirRango(token, TAREAS.id, `${H}!D${t.fila}`, [[antes ? '' : ahoraTexto()]]);
    });
}

export function borrarTarea(t, obtenerToken, repintar) {
  if (!t || (!t.fila && !T.demo)) return;
  const pos = T.lista.indexOf(t);
  return cambiar(obtenerToken, repintar,
    () => { T.lista = T.lista.filter((x) => x !== t); },
    () => { T.lista.splice(pos, 0, t); },
    async (token) => {
      await verificar(token, t);
      await borrarRango(token, TAREAS.id, `${H}!A${t.fila}:D${t.fila}`);
    });
}

export function tareaPorClave(clave) {
  return T.lista.find((t) => claveTarea(t) === clave);
}

const claves = new WeakMap();
let siguiente = 1;
function claveTarea(t) {
  if (!claves.has(t)) claves.set(t, `t${siguiente++}`);
  return claves.get(t);
}

function itemTarea(t) {
  const k = claveTarea(t);
  return `<li class="tarea ${t.hecha ? 'hecha' : ''}">
    <label class="tarea-marca">
      <input type="checkbox" data-tarea="${k}" ${t.hecha ? 'checked' : ''} ${!t.fila && !T.demo ? 'disabled' : ''}>
      <span class="tarea-texto">${esc(t.texto)}</span>
    </label>
    <button class="tarea-borrar" data-accion="borrar-tarea" data-tarea-borrar="${k}" aria-label="Borrar «${esc(t.texto)}»" title="Borrar" ${!t.fila && !T.demo ? 'disabled' : ''}>×</button>
  </li>`;
}

/** Contenido de la tarjeta (se repinta sola, sin tocar el resto del Inicio). */
export function htmlTareas() {
  const pendientes = T.lista.filter((t) => !t.hecha);
  const hechas = T.lista.filter((t) => t.hecha);
  let cuerpo;
  if (T.estado === 'sin-leer' || T.estado === 'leyendo') cuerpo = '<p class="sin-dato">Leyendo tu lista…</p>';
  else if (T.estado === 'error') cuerpo = '';
  else {
    cuerpo = pendientes.length
      ? `<ul class="lista-tareas">${pendientes.map(itemTarea).join('')}</ul>`
      : '<p class="vacio">Sin tareas pendientes.</p>';
    if (hechas.length) {
      cuerpo += `<details class="tareas-hechas" ${T.verHechas ? 'open' : ''}><summary>${plural(hechas.length, 'hecha', 'hechas')}</summary>
        <ul class="lista-tareas">${hechas.map(itemTarea).join('')}</ul></details>`;
    }
  }
  const enlace = `https://docs.google.com/spreadsheets/d/${TAREAS.id}/edit#gid=${TAREAS.gid}`;
  return `
    <div class="tarjeta-cab"><h2 class="etq-cab">${icono('pendientes')}Tareas${pendientes.length ? ` <span class="cuenta-tareas">${pendientes.length}</span>` : ''}</h2>
      <span class="tareas-estado">${T.guardando ? 'Guardando…' : ''}</span>
      <a class="enlace-vista" href="${enlace}" target="_blank" rel="noopener">Abrir hoja ${icono('flecha')}</a></div>
    <form class="tarea-nueva" data-form="tarea" autocomplete="off">
      <input type="text" name="tarea" maxlength="300" placeholder="Agregar tarea…" aria-label="Nueva tarea" ${T.estado === 'error' ? 'disabled' : ''}>
      <button type="submit" class="boton boton-primario" ${T.estado === 'error' ? 'disabled' : ''}>Agregar</button>
    </form>
    ${T.error ? `<p class="tareas-error">${esc(T.error)}</p>` : ''}
    ${cuerpo}`;
}
