// Lista de tareas del Inicio. Se guarda en su propia hoja de Google
// («TO DO · Dashboard personal», pestaña TAREAS), así que la ves y editas
// también desde Sheets. Antes de cambiar o borrar una fila se comprueba que
// sigue siendo la misma tarea.

import { TAREAS } from './fuentes.js?v=202611092136';
import { leerRangos, agregarFila, escribirRango, borrarRango } from './api.js?v=202611092136';
import { esc, plural } from './formato.js?v=202611092136';
import { icono } from './iconos.js?v=202611092136';

const H = `'${TAREAS.pestana}'`;
const RANGO = `${H}!A2:E`;

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
    orden: typeof f?.[4] === 'number' ? f[4] : (Number.isFinite(Number(f?.[4])) && String(f?.[4] ?? '').trim() !== '' ? Number(f[4]) : null),
  })).filter((t) => t.texto).sort(porOrden);
}

/** Orden de importancia (columna ORDEN); sin número van al final, en el orden de la hoja. */
function porOrden(a, b) {
  const x = a.orden ?? Infinity;
  const y = b.orden ?? Infinity;
  return x === y ? (a.fila ?? Infinity) - (b.fila ?? Infinity) : x - y;
}

export function usarDemo() {
  Object.assign(T, {
    demo: true, estado: 'ok', error: null,
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
    const [valores] = await leerRangos(token, TAREAS.id, [RANGO]);
    T.lista = leerFilas(valores);
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

/**
 * Nuevo orden de las pendientes (de más a menos importante): escribe 1, 2, 3…
 * en la columna ORDEN. Antes comprueba que cada fila sigue siendo su tarea.
 */
export function ordenarTareas(clavesEnOrden, obtenerToken, repintar) {
  const pendientes = clavesEnOrden.map(tareaPorClave).filter(Boolean);
  if (!pendientes.length || pendientes.some((t) => !t.fila && !T.demo)) return;
  const antes = T.lista.map((t) => [t, t.orden]);
  const listaAntes = [...T.lista];
  return cambiar(obtenerToken, repintar,
    () => {
      pendientes.forEach((t, i) => { t.orden = i + 1; });
      const hechas = T.lista.filter((t) => t.hecha);
      T.lista = [...pendientes, ...T.lista.filter((t) => !t.hecha && !pendientes.includes(t)), ...hechas];
    },
    () => { antes.forEach(([t, o]) => { t.orden = o; }); T.lista = listaAntes; },
    async (token) => {
      const max = Math.max(...T.lista.map((t) => t.fila ?? 0));
      const [textos] = await leerRangos(token, TAREAS.id, [`${H}!A2:A${max}`]);
      for (const t of pendientes) {
        if (String(textos?.[t.fila - 2]?.[0] ?? '').trim() !== t.texto) {
          throw new Error(`La tarea «${t.texto}» cambió o se movió en tu hoja. Toca «Actualizar» y vuelve a ordenar.`);
        }
      }
      const porFila = new Map(T.lista.filter((t) => t.fila).map((t) => [t.fila, t.orden ?? '']));
      const columna = Array.from({ length: max - 1 }, (_, i) => [porFila.get(i + 2) ?? '']);
      await escribirRango(token, TAREAS.id, `${H}!E2:E${max}`, columna);
    });
}

/**
 * Arrastrar con el dedo (o el ratón) desde la manija ⋮⋮ para reordenar.
 * alSoltar(claves) recibe el nuevo orden de las tareas pendientes.
 */
export function activarArrastre(alSoltar) {
  let actual = null;
  document.addEventListener('pointerdown', (e) => {
    const asa = e.target.closest?.('[data-asa]');
    if (!asa || T.guardando) return;
    const li = asa.closest('li.tarea');
    const ul = li?.parentElement;
    if (!ul) return;
    e.preventDefault();
    asa.setPointerCapture?.(e.pointerId);
    actual = { li, ul, asa, y0: e.clientY, inicial: clavesDe(ul) };
    li.classList.add('arrastrando');
  });
  document.addEventListener('pointermove', (e) => {
    if (!actual) return;
    e.preventDefault();
    const { li, ul } = actual;
    let dy = e.clientY - actual.y0;
    const sig = li.nextElementSibling;
    const ant = li.previousElementSibling;
    if (sig && dy > sig.offsetHeight / 2) {
      ul.insertBefore(sig, li);
      actual.y0 += sig.offsetHeight;
      dy -= sig.offsetHeight;
    } else if (ant && dy < -ant.offsetHeight / 2) {
      ul.insertBefore(li, ant);
      actual.y0 -= ant.offsetHeight;
      dy += ant.offsetHeight;
    }
    li.style.transform = `translateY(${dy}px)`;
  }, { passive: false });
  const soltar = () => {
    if (!actual) return;
    const { li, ul, inicial } = actual;
    actual = null;
    li.classList.remove('arrastrando');
    li.style.transform = '';
    const final = clavesDe(ul);
    if (final.join() !== inicial.join()) alSoltar(final);
  };
  document.addEventListener('pointerup', soltar);
  document.addEventListener('pointercancel', soltar);
}

function clavesDe(ul) {
  return [...ul.querySelectorAll(':scope > li input[data-tarea]')].map((i) => i.dataset.tarea);
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
  const movible = !t.hecha && (t.fila || T.demo);
  return `<li class="tarea ${t.hecha ? 'hecha' : ''}">
    ${t.hecha ? '' : `<span class="tarea-asa" ${movible ? 'data-asa' : ''} aria-hidden="true" title="Arrastra para ordenar">⋮⋮</span>`}
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
      ? `<ul class="lista-tareas lista-ordenable">${pendientes.map(itemTarea).join('')}</ul>${pendientes.length > 1 ? '<p class="nota tareas-ayuda">Arrastra ⋮⋮ para ordenar de más a menos importante.</p>' : ''}`
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
