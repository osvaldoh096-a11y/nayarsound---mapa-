// Interfaz del panel: Inicio, NayarSound, Préstamos e inversores, Finanzas y Fuentes.

import { leerPreferencias, guardarPreferencias } from './config.js?v=202611092154';
import { escribirCelda, leerRangos } from './api.js?v=202611092154';
import { prepararSesion, iniciarSesion, tokenVigente, olvidarToken, cerrarSesion } from './auth.js?v=202611092154';
import { leerTodo, datosDisponibles } from './carga.js?v=202611092154';
import { construirModelo, entregarCon } from './modelo.js?v=202611092154';
import {
  hoyCDMX, fechaLarga, fechaCorta, diasRelativos, momento, hora, nombreMes, MESES, normalizar, leerEtiquetaMes, ymdDesdeIdx,
} from './fechas.js?v=202611092154';
import { dinero, monto, esc, plural, capitalizar, fijarPrivado, esPrivado, ocultarImportes } from './formato.js?v=202611092154';
import { barras, lineas, activarTips, ocultarTip } from './graficas.js?v=202611092154';
import { ARCHIVOS, ORDEN_ARCHIVOS, TIPO_CAMBIO_USDT, CLIENTE_GOOGLE } from './fuentes.js?v=202611092154';
import { fuentesDemo } from './demo.js?v=202611092154';
import { leerCashflow } from './dashprestamos.js?v=202611092154';
import { icono } from './iconos.js?v=202611092154';
import { T, cargarTareas, usarDemo, agregarTarea, alternarTarea, borrarTarea, tareaPorClave, htmlTareas, ordenarTareas, activarArrastre } from './tareas.js?v=202611092154';

const VISTAS = {
  inicio: { titulo: 'Inicio', archivos: ORDEN_ARCHIVOS },
  nayarsound: { titulo: 'NayarSound', archivos: ['nayarsound', 'agenda'] },
  prestamos: { titulo: 'Panel financiero', archivos: ['prestamos'] },
  finanzas: { titulo: 'Finanzas', archivos: ['gastos'] },
  fuentes: { titulo: 'Fuentes y ajustes', archivos: [] },
};

const URG = {
  vencido: 'Vencido', hoy: 'Hoy', proximo: 'Próximo', 'sin-fecha': 'Cobros de eventos pendientes', aviso: 'Aviso',
};

const COLOR_CIUDAD = { '🟣': 'violeta', '🟠': 'naranja', '🔵': 'azul', '🟢': 'verde' };

const E = {
  cfg: { archivos: ARCHIVOS },
  pref: leerPreferencias(),
  demo: false,
  fuentes: {},
  modelo: null,
  ruta: 'inicio',
  mes: null,
  filtro: null,
  cargando: false,
  sesion: 'preparando',
  errorSesion: null,
  ultimaCompleta: null,
  ultimoIntento: 0,
  pendientes: new Map(),
  limpiar: [],
};

const $ = (sel, raiz = document) => raiz.querySelector(sel);

// ------------------------------------------------------------------ arranque

function rutaDesdeHash() {
  const m = location.hash.match(/^#\/(\w+)/);
  return m && VISTAS[m[1]] ? m[1] : 'inicio';
}

const MENU = [
  { ruta: 'inicio', texto: 'Inicio', corto: 'Inicio', icono: 'inicio' },
  { ruta: 'nayarsound', texto: 'NayarSound', corto: 'NayarSound', icono: 'musica' },
  { ruta: 'prestamos', texto: 'Préstamos e inversores', corto: 'Préstamos', icono: 'prestamos' },
  { ruta: 'finanzas', texto: 'Finanzas', corto: 'Finanzas', icono: 'finanzas' },
];

function montarMenu() {
  $('#menu').innerHTML = MENU.map((m) => `<a class="menu-item" href="#/${m.ruta}" data-ruta="${m.ruta}">${icono(m.icono)}<span>${m.texto}</span></a>`).join('');
  $('#menu-movil').innerHTML = MENU.map((m) => `<a href="#/${m.ruta}" data-ruta="${m.ruta}">${icono(m.icono)}<span>${m.corto}</span></a>`).join('');
  $('#menu-ajustes').innerHTML = `${icono('ajustes')}<span>Fuentes y ajustes</span>`;
  $('#icono-actualizar').innerHTML = icono('actualizar', 'icono-actualizar');
}

async function arrancar() {
  fijarPrivado(E.pref.privado);
  montarMenu();
  E.demo = new URLSearchParams(location.search).has('demo');
  E.ruta = rutaDesdeHash();
  window.addEventListener('hashchange', () => { E.ruta = rutaDesdeHash(); E.filtro = null; pintar(); window.scrollTo(0, 0); });
  document.addEventListener('click', alHacerClic);
  document.addEventListener('change', alCambiar);
  document.addEventListener('input', alEscribir);
  document.addEventListener('submit', alEnviar);
  activarArrastre((claves) => ordenarTareas(claves, tokenParaEscribir, pintarTareas));
  document.addEventListener('toggle', (e) => {
    if (e.target.dataset?.pf) {
      const abiertos = new Set(E.pref.pfAbiertos ?? []);
      if (e.target.open) abiertos.add(e.target.dataset.pf); else abiertos.delete(e.target.dataset.pf);
      E.pref.pfAbiertos = [...abiertos];
      guardarPreferencias(E.pref);
    }
    if (e.target.matches?.('details.tareas-hechas')) T.verHechas = e.target.open;
    if (e.target.id === 'deuda-desplegable') E.deudaAbierta = e.target.open;
    if (e.target.id === 'controles-desplegable') E.controlesAbierto = e.target.open;
  }, true);
  document.addEventListener('visibilitychange', revisarAuto);
  setInterval(revisarAuto, 30000);

  if (E.demo) { cargarDemo(); return; }
  pintar();
  prepararGoogle();
  // Sesión de Google todavía vigente (de una visita anterior): leer sin pedir la cuenta.
  if (tokenVigente()) actualizar();
}

async function prepararGoogle() {
  try {
    await prepararSesion(CLIENTE_GOOGLE);
    E.sesion = 'lista';
  } catch (error) {
    E.sesion = 'error';
    E.errorSesion = error.message;
  }
  pintar();
}

function cargarDemo() {
  const ahora = new Date();
  for (const [clave, datos] of Object.entries(fuentesDemo())) {
    E.fuentes[clave] = { estado: 'ok', datos, actualizado: ahora, intento: ahora, error: null };
  }
  E.ultimaCompleta = ahora;
  E.modelo = construirModelo(datosDisponibles(E.fuentes), hoyCDMX());
  if (!T.demo) usarDemo();
  pintar();
}

// ------------------------------------------------------------------ actualizar

/** interactivo: viene de un toque (puede abrir la ventana de Google). */
async function actualizar({ interactivo = false } = {}) {
  if (E.cargando) return;
  if (E.demo) { cargarDemo(); return; }
  let token = tokenVigente();
  if (!token) {
    if (!interactivo) { E.sesion = 'expirada'; pintar(); return; }
    try {
      token = await iniciarSesion();
      E.sesion = 'lista';
      E.errorSesion = null;
    } catch (error) {
      E.errorSesion = error.message;
      pintar();
      return;
    }
  }
  E.cargando = true;
  E.ultimoIntento = Date.now();
  pintar();
  try {
    const [fuentes] = await Promise.all([leerTodo(token, E.cfg.archivos, E.fuentes), cargarTareas(token)]);
    E.fuentes = fuentes;
    const errores = ORDEN_ARCHIVOS.map((k) => E.fuentes[k]).filter((f) => f.estado === 'error');
    if (errores.some((f) => f.error.tipo === 'sesion')) { olvidarToken(); E.sesion = 'expirada'; }
    if (!errores.length) E.ultimaCompleta = new Date();
    E.modelo = construirModelo(datosDisponibles(E.fuentes), hoyCDMX());
  } finally {
    E.cargando = false;
    pintar();
  }
}

function revisarAuto() {
  if (document.visibilityState !== 'visible' || E.cargando || E.demo) return;
  const minutos = Number(E.pref.autoMinutos) || 0;
  if (!minutos || !E.ultimoIntento) return;
  if (Date.now() - E.ultimoIntento >= minutos * 60000) actualizar({ interactivo: false });
}

// ------------------------------------------------------------------ eventos

function alHacerClic(evento) {
  if (evento.target.id === 'detalle') { evento.target.close(); return; }
  const el = evento.target.closest('[data-accion],[data-pendiente],[data-dia],[data-filtro],[data-cerrar]');
  if (!el) return;
  if (el.dataset.cerrar !== undefined) { $('#detalle').close(); return; }
  if (el.dataset.filtro !== undefined) {
    evento.preventDefault();
    E.filtro = E.filtro === el.dataset.filtro ? null : el.dataset.filtro;
    pintar();
    return;
  }
  if (el.dataset.pendiente) { abrirPendiente(E.pendientes.get(el.dataset.pendiente)); return; }
  if (el.dataset.dia) { abrirDia(Number(el.dataset.dia)); return; }
  const accion = el.dataset.accion;
  if (accion === 'actualizar' || accion === 'entrar') actualizar({ interactivo: true });
  if (accion === 'privado') {
    E.pref.privado = !esPrivado();
    fijarPrivado(E.pref.privado);
    guardarPreferencias(E.pref);
    if ($('#detalle').open) $('#detalle').close();
    pintar();
  }
  if (accion === 'salir') {
    cerrarSesion();
    Object.assign(E, { modelo: null, fuentes: {}, ultimaCompleta: null, ultimoIntento: 0 });
    Object.assign(T, { estado: 'sin-leer', lista: [], error: null });
    location.hash = '#/inicio';
    pintar();
  }
  if (accion === 'tab-pr') { E.tabPr = el.dataset.tab; pintar(); window.scrollTo(0, 0); return; }
  if (accion === 'borrar-tarea') {
    const t = tareaPorClave(el.dataset.tareaBorrar);
    if (t && confirm(`¿Borrar la tarea «${t.texto}»?`)) borrarTarea(t, tokenParaEscribir, pintarTareas);
  }
  if (accion === 'copiar-mensaje') copiarMensaje(el);
  if (accion === 'marcar-pagado') marcarPagado(el);
  if (accion === 'guardar-pagodj') guardarPagoDj(el);
  if (accion === 'tabla') { const t = $(`#${el.dataset.objetivo}`); if (t) t.hidden = !t.hidden; }
}

/**
 * Escribe SI en la columna PAGO de los eventos elegidos. Antes de escribir
 * vuelve a leer cada fila y comprueba que sigue siendo el mismo DJ, la misma
 * fecha y DEUDOR, y que la celda PAGO no tiene fórmula.
 */
async function marcarPagado(boton) {
  const p = E.pendientes.get(boton.dataset.pendientePago);
  if (!p?.pago || !p.registros?.length) return;
  const filas = boton.dataset.fila ? p.registros.filter((r) => String(r.fila) === boton.dataset.fila) : p.registros;
  const texto = filas.length === 1
    ? `¿Marcar como pagado el evento de ${p.titulo} del ${fechaLarga(filas[0].idx)}?`
    : `¿Marcar como pagados los ${filas.length} eventos de ${p.titulo}?`;
  if (!confirm(`${texto}\n\nSe escribirá «SI» en la columna PAGO de AGENDA Y VENTAS.`)) return;
  let token = tokenVigente();
  try {
    if (!token) token = await iniciarSesion();
  } catch (error) { alert(error.message); return; }
  const botones = [...document.querySelectorAll('[data-accion="marcar-pagado"]')];
  botones.forEach((b) => { b.disabled = true; });
  boton.textContent = 'Guardando…';
  const hechos = [];
  try {
    for (const r of filas) {
      await escribirVerificado(token, p, r, p.pago.columnas.pago, 'SI', 'PAGO');
      hechos.push(r.fila);
    }
    $('#detalle').close();
    E.avisoTemporal = `Listo: ${hechos.length === 1 ? 'se marcó 1 evento' : `se marcaron ${hechos.length} eventos`} de ${p.titulo} como pagado.`;
  } catch (error) {
    alert(`${hechos.length ? `Se marcaron ${hechos.length} de ${filas.length} eventos. ` : ''}${error.message}`);
  } finally {
    botones.forEach((b) => { b.disabled = false; });
  }
  await actualizar({ interactivo: true });
}

/**
 * Vuelve a leer la fila y comprueba que sigue siendo el mismo DJ, la misma
 * fecha y DEUDOR, y que la celda destino no tiene fórmula; luego escribe.
 */
async function escribirVerificado(token, p, r, letraDestino, valor, nombreColumna) {
  const { archivo, pestana, columnas } = p.pago;
  const n = (letra) => [...letra].reduce((t, c) => t * 26 + c.charCodeAt(0) - 64, 0);
  const letras = Object.values(columnas).filter(Boolean);
  const desde = letras.reduce((a, b) => (n(a) <= n(b) ? a : b));
  const hasta = letras.reduce((a, b) => (n(a) >= n(b) ? a : b));
  const [valores] = await leerRangos(token, archivo, [`'${pestana}'!${desde}${r.fila}:${hasta}${r.fila}`]);
  const fila = valores?.[0] ?? [];
  const col = (letra) => fila[n(letra) - n(desde)];
  const coincide = normalizar(col(columnas.dj)) === normalizar(p.titulo)
    && Math.floor(Number(col(columnas.fecha))) - 25569 === r.idx
    && normalizar(col(columnas.pagado)) === 'DEUDOR';
  if (!coincide) throw new Error(`La fila ${r.fila} cambió en tu hoja (ya no es el evento de ${p.titulo} del ${fechaLarga(r.idx)} como deudor). No se escribió nada en ella.`);
  const celda = `'${pestana}'!${letraDestino}${r.fila}`;
  const [formula] = await leerRangos(token, archivo, [celda], { modo: 'FORMULA' });
  if (String(formula?.[0]?.[0] ?? '').startsWith('=')) throw new Error(`La celda ${nombreColumna} de la fila ${r.fila} tiene una fórmula; no se modificó.`);
  await escribirCelda(token, archivo, celda, valor);
}

/** Cambia el pago al DJ (columna «DJ» de AGENDA Y VENTAS) de un evento. */
async function guardarPagoDj(boton) {
  const p = E.pendientes.get(boton.dataset.pendientePago);
  const r = p?.registros?.find((x) => String(x.fila) === boton.dataset.fila);
  if (!p?.pago?.columnas?.pagoDj || !r) return;
  const entrada = document.querySelector(`input[data-fila-pagodj="${r.fila}"]`);
  const texto = String(entrada?.value ?? '').trim().replace(/[$,\s]/g, '');
  const valor = Number(texto);
  if (!texto || !Number.isFinite(valor) || valor < 0) { alert('Escribe un importe válido, por ejemplo 1500.'); entrada?.focus(); return; }
  const antes = typeof r.pagoDj === 'number' ? dinero(r.pagoDj, 0) : 'sin registro';
  if (!confirm(`¿Cambiar el pago al DJ ${p.titulo} del ${fechaLarga(r.idx)}?\n\nDe ${antes} a ${dinero(valor, 0)}.\nSe escribirá en la columna DJ de AGENDA Y VENTAS (fila ${r.fila}); tu hoja recalcula lo que debe enviar.`)) return;
  let token = tokenVigente();
  try {
    if (!token) token = await iniciarSesion();
  } catch (error) { alert(error.message); return; }
  boton.disabled = true;
  boton.textContent = 'Guardando…';
  try {
    await escribirVerificado(token, p, r, p.pago.columnas.pagoDj, valor, 'DJ');
    $('#detalle').close();
    E.avisoTemporal = `Listo: pago al DJ ${p.titulo} del ${fechaLarga(r.idx)} = ${dinero(valor, 0)}.`;
  } catch (error) {
    alert(error.message);
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar';
  }
  await actualizar({ interactivo: true });
}

/** Enlace de WhatsApp con el mensaje ya escrito (tú solo tocas «Enviar» en WhatsApp). */
function telefonoDe(nombre) {
  return E.modelo?.nayarsound?.telefonos?.mapa.get(normalizar(nombre)) ?? null;
}

/**
 * Abre directo WhatsApp personal (no WhatsApp Business):
 * iPhone → whatsapp:// (Business usa otro esquema); Android → la app com.whatsapp;
 * computadora → wa.me (WhatsApp Web o de escritorio).
 */
function enlaceWhatsApp(numero, texto) {
  const t = encodeURIComponent(texto);
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return `whatsapp://send?phone=${numero}&text=${t}`;
  if (/Android/i.test(ua)) return `intent://send?phone=${numero}&text=${t}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
  return `https://wa.me/${numero}?text=${t}`;
}

function botonWhatsApp(p) {
  const tel = telefonoDe(p.titulo);
  if (!tel?.numero) return '';
  const url = enlaceWhatsApp(tel.numero, p.mensaje);
  const externo = url.startsWith('https:') ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a class="boton boton-whatsapp boton-chico" href="${esc(url)}"${externo}>${icono('whatsapp')}WhatsApp</a>`;
}

function avisoTelefono(p) {
  const t = E.modelo?.nayarsound?.telefonos;
  if (!t || t.estado === 'sin-datos') return '';
  const tel = telefonoDe(p.titulo);
  if (tel?.numero) return '';
  let texto;
  if (t.estado === 'sin-columna') texto = 'Para enviar por WhatsApp, agrega una columna «TELEFONO» junto a los DJs en AMAL AGENDA › DATA.';
  else if (!tel) texto = `${p.titulo} no está en la lista de DJs de AMAL AGENDA › DATA.`;
  else texto = tel.texto ? `El teléfono de ${p.titulo} en AMAL AGENDA › DATA no es válido («${tel.texto}»).` : `Falta el teléfono de ${p.titulo} en AMAL AGENDA › DATA.`;
  return `<p class="nota">${esc(texto)}${t.url ? ` <a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">Abrir DATA ↗</a>` : ''}</p>`;
}

async function copiarMensaje(boton) {
  const texto = E.pendientes.get(boton.dataset.pendienteMsg)?.mensaje;
  if (!texto) return;
  let ok = false;
  try {
    await navigator.clipboard.writeText(texto);
    ok = true;
  } catch {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    boton.closest('dialog').appendChild(area);
    area.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.parentNode.removeChild(area);
  }
  boton.textContent = ok ? '¡Copiado!' : 'No se pudo copiar';
  setTimeout(() => { boton.textContent = 'Copiar'; }, 1800);
}

/** Vista previa: al editar el pago al DJ, recalcula «Enviar» con la fórmula de la hoja. */
/** Token para escribir; si expiró, pide entrar de nuevo. */
async function tokenParaEscribir() {
  const token = tokenVigente();
  if (token) return token;
  return iniciarSesion();
}

function alEnviar(evento) {
  const form = evento.target.closest?.('form[data-form="tarea"]');
  if (!form) return;
  evento.preventDefault();
  const entrada = form.elements.tarea;
  const texto = entrada.value;
  if (!texto.trim()) { entrada.focus(); return; }
  entrada.value = '';
  agregarTarea(texto, tokenParaEscribir, pintarTareas);
}

/** Repinta solo la tarjeta de tareas, conservando el foco del cuadro de texto. */
function pintarTareas() {
  const caja = $('#tareas-caja');
  if (!caja) return;
  const entrada = caja.querySelector('input[name="tarea"]');
  const enfocada = document.activeElement === entrada;
  const borrador = entrada?.value ?? '';
  caja.innerHTML = htmlTareas();
  const nueva = caja.querySelector('input[name="tarea"]');
  if (nueva) { nueva.value = borrador; if (enfocada) nueva.focus(); }
}

function alEscribir(evento) {
  const el = evento.target;
  if (!el.matches?.('input[data-fila-pagodj]')) return;
  const p = E.pendientes.get(el.dataset.pendientePago);
  const r = p?.registros?.find((x) => String(x.fila) === el.dataset.filaPagodj);
  const salida = document.querySelector(`[data-enviar-fila="${el.dataset.filaPagodj}"]`);
  if (!r || !salida) return;
  const texto = String(el.value).trim();
  const valor = texto === '' ? 0 : Number(texto);
  if (!Number.isFinite(valor)) return;
  const nuevo = entregarCon(r, valor);
  if (nuevo === null) return;
  salida.textContent = dinero(nuevo);
  salida.classList.toggle('cambio', valor !== (typeof r.pagoDj === 'number' ? r.pagoDj : 0));
  salida.classList.toggle('negativo-num', nuevo < 0);
}

/** Pinta en rojo todo importe negativo («-$2,100.00») dentro de un contenedor. */
const RE_NEGATIVO = /[-−]\s?\$\s?[\d][\d.,]*/g;
function marcarNegativos(raiz) {
  const recorrido = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('svg, script, style, textarea, .negativo-num') || !RE_NEGATIVO.test(n.nodeValue)
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodos = [];
  for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) nodos.push(n);
  for (const n of nodos) {
    const trozo = document.createDocumentFragment();
    let ultimo = 0;
    n.nodeValue.replace(RE_NEGATIVO, (m, i) => {
      trozo.append(n.nodeValue.slice(ultimo, i));
      const span = document.createElement('span');
      span.className = 'negativo-num';
      span.textContent = m;
      trozo.append(span);
      ultimo = i + m.length;
      return m;
    });
    trozo.append(n.nodeValue.slice(ultimo));
    n.parentNode.replaceChild(trozo, n);
  }
}

function alCambiar(evento) {
  if (evento.target.matches?.('input[data-tarea]')) {
    alternarTarea(tareaPorClave(evento.target.dataset.tarea), tokenParaEscribir, pintarTareas);
    return;
  }
  const el = evento.target;
  if (el.id === 'sel-mes') { E.mes = el.value.startsWith('a') ? el.value : Number(el.value); pintar(); }
  if (el.id === 'sel-auto') {
    E.pref.autoMinutos = Number(el.value);
    guardarPreferencias(E.pref);
    pintar();
  }
}

// ------------------------------------------------------------------ pintar

function pintar() {
  ocultarTip();
  E.limpiar.forEach((f) => f());
  E.limpiar = [];
  E.pendientes = new Map((E.modelo?.pendientes ?? []).map((p) => [p.id, p]));
  pintarCabecera();
  pintarAvisoGlobal();
  const vista = $('#vista');
  vista.setAttribute('aria-busy', E.cargando ? 'true' : 'false');
  document.title = `${VISTAS[E.ruta].titulo} · Panel`;
  if (E.ruta === 'fuentes') { vista.innerHTML = vistaFuentes(); return; }
  if (!E.modelo) { vista.innerHTML = E.cargando ? vistaCargando() : vistaEntrarGoogle(); return; }
  const banda = bandaEstado(VISTAS[E.ruta].archivos);
  const contenido = { inicio: vistaInicio, nayarsound: vistaNayarsound, prestamos: vistaPrestamos, finanzas: vistaFinanzas }[E.ruta](E.modelo);
  vista.innerHTML = banda + contenido;
  activarTips(vista);
  marcarNegativos(vista);
  if (E.ruta === 'finanzas') montarGraficaMensual();
}

function pintarCabecera() {
  document.querySelectorAll('[data-ruta]').forEach((a) => {
    a.setAttribute('aria-current', a.dataset.ruta === E.ruta ? 'page' : 'false');
  });
  const boton = $('#btn-actualizar');
  boton.disabled = E.cargando || (!E.demo && E.sesion === 'preparando');
  boton.classList.toggle('girando', E.cargando);
  $('#btn-actualizar-texto').textContent = E.cargando ? 'Actualizando…' : 'Actualizar';
  const priv = $('#btn-privado');
  priv.innerHTML = icono(esPrivado() ? 'ojoCerrado' : 'ojo');
  priv.setAttribute('aria-pressed', String(esPrivado()));
  priv.title = esPrivado() ? 'Mostrar importes' : 'Ocultar importes';
  priv.setAttribute('aria-label', priv.title);
  $('#titulo-cabecera').textContent = E.ruta === 'inicio' ? 'Tu día, en un vistazo.' : VISTAS[E.ruta].titulo;
  $('#fecha-cabecera').textContent = capitalizar(fechaLarga(hoyCDMX().idx));
  const estado = $('#estado-lectura');
  const errores = ORDEN_ARCHIVOS.filter((k) => E.fuentes[k]?.estado === 'error');
  let tono = 'gris';
  let texto = 'Sin conectar';
  let detalle = '';
  if (E.cargando) { tono = 'azul'; texto = 'Leyendo tus hojas…'; }
  else if (E.demo) { tono = 'ambar'; texto = 'Datos de ejemplo'; }
  else if (E.sesion === 'expirada' && E.modelo) { tono = 'ambar'; texto = 'Sesión expirada'; }
  else if (!E.modelo) { texto = E.sesion === 'preparando' ? 'Preparando…' : 'Sin iniciar sesión'; }
  else if (errores.length === ORDEN_ARCHIVOS.length) { tono = 'rojo'; texto = 'Sin conexión'; detalle = E.ultimaCompleta ? `Última lectura ${hora(E.ultimaCompleta)}` : ''; }
  else if (errores.length) { tono = 'ambar'; texto = 'Actualización parcial'; detalle = `${errores.length} de ${ORDEN_ARCHIVOS.length} hojas sin leer`; }
  else { tono = 'verde'; texto = 'Conectado'; detalle = `Actualizado ${momento(E.ultimaCompleta)}`; }
  estado.className = `estado-conexion tono-${tono}`;
  estado.innerHTML = `<i class="punto" aria-hidden="true"></i><span><b>${esc(texto)}</b>${detalle ? `<small>${esc(detalle)}</small>` : ''}</span>`;
  $('#usuario-estado').textContent = E.modelo && !E.demo ? 'Con Google' : 'Panel personal';
}

function pintarAvisoGlobal() {
  const partes = [];
  if (E.demo) {
    partes.push('<div class="banda banda-demo"><b>DATOS DE EJEMPLO.</b> Nombres y cifras inventados para probar el panel. No son tus datos reales.</div>');
  }
  if (E.avisoTemporal) { partes.push(`<div class="banda banda-info">${esc(E.avisoTemporal)}</div>`); E.avisoTemporal = null; }
  if (E.sesion === 'expirada' && E.modelo) {
    partes.push('<div class="banda banda-alerta">La sesión de Google expiró; los datos en pantalla no se están actualizando. <button class="boton-texto" data-accion="actualizar">Entrar y actualizar</button></div>');
  }
  if (E.errorSesion && E.modelo) partes.push(`<div class="banda banda-error">${esc(E.errorSesion)}</div>`);
  $('#aviso-global').innerHTML = partes.join('');
}

/** Avisa si alguna fuente de la vista no se pudo actualizar y desde cuándo son sus datos. */
function bandaEstado(claves) {
  return claves.map((k) => {
    const f = E.fuentes[k];
    if (f?.estado !== 'error') return '';
    const nombre = ARCHIVOS[k].nombre;
    if (f.datos) {
      return `<div class="banda banda-alerta" role="status"><b>No se pudo actualizar ${esc(nombre)}:</b> ${esc(f.error.mensaje)} Se muestran los datos anteriores, leídos ${esc(momento(f.actualizado))}.</div>`;
    }
    return `<div class="banda banda-error" role="alert"><b>No se pudo leer ${esc(nombre)}:</b> ${esc(f.error.mensaje)} Sus cifras no se muestran.</div>`;
  }).join('');
}

// ------------------------------------------------------------------ piezas

/** Días desde el evento más antiguo que se debe. */
function diasDeuda(p, hoyIdx) {
  const fechas = (p.fechas ?? []).map((f) => f.idx).filter((x) => typeof x === 'number');
  return fechas.length ? hoyIdx - Math.min(...fechas) : null;
}

function textoDias(n) {
  return n === 0 ? 'Hoy' : `${n} ${n === 1 ? 'día' : 'días'}`;
}

function chipUrgencia(p, hoyIdx) {
  const dias = p.tipo === 'deuda' ? diasDeuda(p, hoyIdx) : null;
  const texto = dias !== null ? textoDias(dias)
    : p.fechaIdx === null || p.fechaIdx === undefined ? URG[p.urgencia] : diasRelativos(p.fechaIdx - hoyIdx);
  // Deudas con más de 3 días: en rojo.
  return `<span class="chip u-${p.urgencia}${dias !== null && dias > 3 ? ' chip-rojo' : ''}"><i class="punto" aria-hidden="true"></i>${esc(texto)}</span>`;
}

function enlaceOrigen(origen, texto) {
  if (!origen?.url) return '';
  return `<a class="origen" href="${esc(origen.url)}" target="_blank" rel="noopener noreferrer" title="Abrir en Google Sheets">${esc(texto ?? `${origen.pestana}!${origen.a1 ?? ''}`)} ↗</a>`;
}

function valorCelda(c, { decimales = 2 } = {}) {
  if (!c) return '<span class="sin-dato">Sin dato</span>';
  if (c.estado === 'ok') return esc(dinero(c.valor, decimales));
  if (c.estado === 'vacia') return '<span class="sin-dato">Celda vacía</span>';
  if (c.estado === 'error') return `<span class="sin-dato">Error ${esc(c.texto)}</span>`;
  return `<span class="sin-dato">Texto: ${esc(c.texto)}</span>`;
}

function accionTag(accion) {
  if (!accion) return '';
  return `<span class="accion-tag ${accion === 'COBRAR' ? 'cobrar' : 'pagar'}">${accion === 'COBRAR' ? 'Cobrar' : 'Pagar'}</span>`;
}

const COLOR_POR_CIUDAD = { GUADALAJARA: 'violeta', LEON: 'naranja', TEPIC: 'azul', MONTERREY: 'verde' };
function etiquetaCiudad(ciudad) {
  return `<span class="ciudad-tag"><i class="punto-ciudad c-${COLOR_POR_CIUDAD[normalizar(ciudad)] ?? 'gris'}" aria-hidden="true"></i>${esc(capitalizar(String(ciudad).toLowerCase()))}</span>`;
}

const ICONO_TIPO = { agenda: 'calendario', deuda: 'dinero', cobrar: 'cobrar', pagar: 'pagar', liquidar: 'pagar' };

function filaPendiente(p, hoyIdx, { sinCiudad = false } = {}) {
  const fecha = p.fechaIdx !== null && p.fechaIdx !== undefined ? fechaCorta(p.fechaIdx) : '';
  const detalle = [
    p.subtitulo,
    fecha,
    p.op ? `op. ${p.op}` : '',
    p.tipo === 'deuda' && p.fechas?.length ? p.fechas.map((f) => fechaCorta(f.idx)).join(', ') : '',
  ].filter(Boolean).join(' · ');
  const importe = typeof p.monto === 'number'
    ? `<span class="fp-monto ${p.accion === 'COBRAR' ? 'monto-cobrar' : p.accion === 'PAGAR' ? 'monto-pagar' : ''}">${esc(dinero(p.monto, p.decimales ?? 2))}${p.usdt ? `<small>${esc(monto(p.usdt, 'USDT'))}</small>` : ''}</span>` : '';
  return `<button class="fila-pend u-${p.urgencia}" data-pendiente="${esc(p.id)}">
    <span class="fp-icono tipo-${p.tipo}">${icono(ICONO_TIPO[p.tipo] ?? 'pendientes')}</span>
    <span class="fp-texto"><span class="fp-titulo">${esc(p.titulo)}${sinCiudad ? '' : (p.ciudades ?? []).map(etiquetaCiudad).join('')}${p.tipo === 'deuda' ? '' : ` ${accionTag(p.accion)}`}</span><small>${esc(detalle)}</small></span>
    <span class="fp-derecha">${importe}${chipUrgencia(p, hoyIdx)}</span>
  </button>`;
}

function filaDiaAgenda(dia, pendientes, hoyIdx) {
  const djs = pendientes.filter((p) => !p.sinDj).length;
  const sinDj = pendientes.filter((p) => p.sinDj).length;
  const conAccion = pendientes.filter((p) => p.banderas?.length).length;
  const ciudades = new Set(pendientes.map((p) => p.ciudad)).size;
  const urgencia = pendientes[0]?.urgencia ?? 'proximo';
  const titulo = dia.idx === hoyIdx ? 'Eventos de hoy' : dia.idx === hoyIdx + 1 ? 'Eventos de mañana' : `Eventos del ${fechaCorta(dia.idx)}`;
  const detalle = [plural(djs, 'DJ', 'DJs'), plural(dia.eventos ?? 0, 'evento', 'eventos'), plural(ciudades, 'ciudad', 'ciudades'),
    sinDj ? `${sinDj} sin DJ` : '', conAccion ? `${conAccion} requieren acción` : '',
    dia.realizados ? `${dia.realizados} ya ${dia.realizados === 1 ? 'realizado' : 'realizados'}` : ''].filter(Boolean).join(' · ');
  return `<button class="fila-pend u-${urgencia}" data-dia="${dia.idx}">
    <span class="fp-icono tipo-agenda">${icono('calendario')}</span>
    <span class="fp-texto"><span class="fp-titulo">${esc(titulo)}</span><small>${esc(detalle)}</small></span>
    <span class="fp-derecha"><span class="fp-monto fp-conteo">${dia.eventos ?? pendientes.length}<small>${(dia.eventos ?? 0) === 1 ? 'evento' : 'eventos'}</small></span>${chipUrgencia({ urgencia, fechaIdx: dia.idx }, hoyIdx)}</span>
  </button>`;
}

function tilesFinanzas(mes, { conOrigen = true } = {}) {
  if (!mes) {
    const f = E.fuentes.gastos;
    return `<article class="tarjeta tarjeta-error tile-ancha">No hay datos de finanzas${f?.error ? `: ${esc(f.error.mensaje)}` : '.'}</article>`;
  }
  const sinGastos = mes.registrosGastos === 0;
  const negativo = typeof mes.sobrante.valor === 'number' && mes.sobrante.valor < 0;
  const tile = (clase, ico, etiqueta, celda, sub) => `
  <article class="tarjeta tile ${clase}">
    <div class="tile-cab"><span class="tile-icono">${icono(ico)}</span><h3 class="etq">${etiqueta}</h3></div>
    <div class="cifra">${valorCelda(celda)}</div>
    <div class="sub">${sub}</div>
    ${conOrigen ? enlaceOrigen(celda.origen) : ''}
  </article>`;
  const del = mes.esAnio ? 'del año' : 'del mes';
  return tile('tile-ganancia', 'ganancia', `Ganancia ${del}`, mes.ganancia, mes.esAnio ? `Suma de tus negocios en ${mes.y} (ANALISIS BALANCE GENERAL)` : 'Suma de tus negocios, según tu hoja')
    + tile('tile-gasto', 'gasto', 'Gastos personales', mes.gastos,
      sinGastos ? `<span class="marca-aviso">Sin gastos registrados ${mes.esAnio ? 'este año' : 'este mes'}</span>` : esc(`${mes.registrosGastos ?? '—'} registros`))
    + tile(`tile-sobrante ${negativo ? 'negativo' : ''}`, 'sobrante', `Sobrante ${del}`, mes.sobrante, 'Ganancia − gastos. Resultado calculado, no saldo bancario.');
}

/** Ganancia, gastos y sobrante en una fila, como los eventos de hoy y mañana. */
function resumenFinanzas(mes) {
  if (!mes) {
    const f = E.fuentes.gastos;
    return `<p class="sin-dato">No hay datos de finanzas${f?.error ? `: ${esc(f.error.mensaje)}` : '.'}</p>`;
  }
  const negativo = typeof mes.sobrante.valor === 'number' && mes.sobrante.valor < 0;
  const dato = (clase, celda, etiqueta, nota = '') => `
    <div class="fin-dato ${clase}"><div class="cifra">${valorCelda(celda)}</div><div class="sub">${etiqueta}</div>${nota ? `<div class="fin-nota">${nota}</div>` : ''}</div>`;
  return `<div class="fin-fila">
    ${dato('fin-ganancia', mes.ganancia, mes.esAnio ? `ganancia ${mes.y}` : 'ganancia del mes')}
    ${dato('fin-gasto', mes.gastos, 'gastos personales', mes.registrosGastos === 0 ? 'Sin gastos registrados' : '')}
    ${dato(`fin-sobrante ${negativo ? 'negativo' : ''}`, mes.sobrante, mes.esAnio ? `sobrante ${mes.y}` : 'sobrante del mes')}
  </div><p class="nota">Sobrante = ganancia − gastos. Resultado calculado, no saldo bancario.</p>`;
}

/** Periodo elegido: un mes de la tabla mensual o un año completo («a2026»). */
function periodoElegido(fi) {
  if (typeof E.mes === 'string') {
    const anio = fi?.anios?.find((a) => `a${a.y}` === E.mes);
    if (anio) return anio;
    E.mes = null;
  }
  if (E.mes === null || !fi?.meses?.[E.mes]) E.mes = fi?.indiceActual >= 0 ? fi.indiceActual : (fi?.meses?.length ?? 0) - 1;
  return fi?.meses?.[E.mes] ?? null;
}

function selectorMes(fi) {
  if (!fi?.meses?.length) return '';
  periodoElegido(fi);
  const opcionesMes = fi.meses.map((x, i) => `<option value="${i}" ${i === E.mes ? 'selected' : ''}>${esc(x.y ? nombreMes(x.y, x.m) : x.etiqueta)}${i === fi.indiceActual ? ' (actual)' : ''}</option>`).join('');
  const anioHoy = E.modelo?.hoy?.y;
  const opcionesAnio = (fi.anios ?? []).slice().reverse().map((a) => `<option value="a${a.y}" ${E.mes === `a${a.y}` ? 'selected' : ''}>Todo ${a.y}${a.y === anioHoy ? ' (en curso)' : ''}</option>`).join('');
  return `<label class="selector">${icono('calendario')}<span class="oculto">Periodo</span><select id="sel-mes">
    ${opcionesAnio ? `<optgroup label="Por año">${opcionesAnio}</optgroup><optgroup label="Por mes">${opcionesMes}</optgroup>` : opcionesMes}
  </select></label>`;
}

// ------------------------------------------------------------------ Inicio

function vistaInicio(m) {
  const deudas = m.pendientes.filter((p) => p.tipo === 'deuda');
  // Total que te deben: el «TOTAL DE DEUDA» de tu hoja (o la suma por persona si no viene).
  const totalDeuda = typeof m.nayarsound.deuda?.total === 'number' ? m.nayarsound.deuda.total
    : deudas.reduce((t, p) => t + (p.monto ?? 0), 0);
  const filtro = (u, etiqueta, valor, extra = '') => `
    <button class="clase u-${u} ${E.filtro === u ? 'activo' : ''}" data-filtro="${u}" aria-pressed="${E.filtro === u}">
      <span class="clase-num">${valor}</span><span class="clase-etq"><i class="punto" aria-hidden="true"></i>${etiqueta}</span>${extra}
    </button>`;
  const fi = m.finanzas;
  const sel = selectorMes(fi);
  const mes = periodoElegido(fi) ?? m.mesActual;
  return `
  <article class="tarjeta tareas" id="tareas-caja">${htmlTareas()}</article>
  <section class="inicio-rejilla">
    <article class="tarjeta protagonista">
      <div class="tarjeta-cab"><h2 class="etq-cab">${icono('pendientes')}Pendientes</h2>${E.filtro ? `<button class="boton-texto" data-filtro="${E.filtro}">Quitar filtro</button>` : ''}</div>
      <div class="cifra cifra-xl">${m.pendientes.length}</div>
      <div class="clases">
        ${filtro('hoy', 'Hoy', m.conteo.hoy)}
        ${filtro('proximo', 'Próximos', m.conteo.proximo)}
        ${filtro('sin-fecha', 'Cobros de eventos', m.conteo['sin-fecha'], deudas.length ? `<span class="clase-monto">${esc(dinero(totalDeuda, 0))}</span>` : '')}
      </div>
    </article>
    <article class="tarjeta eventos">
      <div class="tarjeta-cab"><h2 class="etq-cab">${icono('musica')}NayarSound</h2><a class="enlace-vista" href="#/nayarsound">Agenda ${icono('flecha')}</a></div>
      ${m.eventos.agendaDisponible ? `<div class="par">
        <div><div class="cifra cifra-l">${m.eventos.hoy}</div><div class="sub">eventos hoy</div></div>
        <div><div class="cifra cifra-l">${m.eventos.manana}</div><div class="sub">eventos mañana</div></div>
      </div><p class="nota">Los eventos se cuentan aparte de los pendientes.</p>` : '<p class="sin-dato">Sin datos de agenda.</p>'}
    </article>
    <article class="tarjeta bloque-finanzas">
      <div class="tarjeta-cab"><h2 class="etq-cab">${icono('finanzas')}Finanzas</h2>${sel}</div>
      ${resumenFinanzas(mes)}
    </article>
  </section>
  <section>
    <div class="seccion-cab"><h2 class="titulo-seccion">Lo que requiere tu atención${E.filtro ? ` · ${esc(URG[E.filtro])}` : ''}</h2></div>
    <div class="rejilla-alertas">${alertasPorNegocio(m)}</div>
  </section>`;
}

function alertasPorNegocio(m) {
  const hoyIdx = m.hoy.idx;
  const filtrar = (lista) => (E.filtro ? lista.filter((p) => p.urgencia === E.filtro) : lista);
  const bloques = [];

  const ns = filtrar(m.pendientes.filter((p) => p.negocio === 'NayarSound'));
  const filasNs = [];
  const dias = m.nayarsound.agenda?.dias ?? [];
  for (const dia of dias) {
    const delDia = ns.filter((p) => p.grupo === `agenda|${dia.idx}`);
    if (delDia.length) filasNs.push({ urg: delDia[0].urgencia, fecha: dia.idx, html: filaDiaAgenda(dia, delDia, hoyIdx) });
  }
  // Las deudas de DJs no saturan la lista: se ven al tocar «Cobros de eventos pendientes».
  const otros = ns.filter((x) => x.tipo !== 'agenda' && x.tipo !== 'deuda');
  for (const p of otros) filasNs.push({ urg: p.urgencia, fecha: p.fechaIdx, html: filaPendiente(p, hoyIdx) });
  // Deudas (al tocar «Cobros de eventos»): agrupadas por ciudad, con su total.
  if (E.filtro === 'sin-fecha') {
    const grupos = new Map();
    for (const p of ns.filter((x) => x.tipo === 'deuda')) {
      const ciudad = p.ciudades?.[0] ?? 'Sin ciudad';
      if (!grupos.has(ciudad)) grupos.set(ciudad, []);
      grupos.get(ciudad).push(p);
    }
    const ordenados = [...grupos.entries()].sort((a, z) => z[1].reduce((t, p) => t + (p.monto ?? 0), 0) - a[1].reduce((t, p) => t + (p.monto ?? 0), 0));
    for (const [ciudad, lista] of ordenados) {
      const total = lista.reduce((t, p) => t + (p.monto ?? 0), 0);
      filasNs.push({ urg: 'sin-fecha', fecha: null, html: `<div class="grupo-ciudad">${etiquetaCiudad(ciudad)}<span>${plural(lista.length, 'persona', 'personas')}</span><b class="monto-cobrar">${esc(dinero(total, 0))}</b></div>` });
      for (const p of lista) filasNs.push({ urg: 'sin-fecha', fecha: null, html: filaPendiente(p, hoyIdx, { sinCiudad: true }) });
    }
  }
  const deudas = m.pendientes.filter((p) => p.tipo === 'deuda');
  if (!E.filtro && deudas.length) {
    const total = typeof m.nayarsound.deuda?.total === 'number' ? m.nayarsound.deuda.total : deudas.reduce((t, p) => t + (p.monto ?? 0), 0);
    filasNs.push({ urg: 'sin-fecha', fecha: null, html: `<button class="fila-pend u-sin-fecha" data-filtro="sin-fecha">
      <span class="fp-icono tipo-deuda">${icono('dinero')}</span>
      <span class="fp-texto"><span class="fp-titulo">Cobros de eventos pendientes</span><small>${esc(deudas.map((p) => p.titulo).join(', '))}</small></span>
      <span class="fp-derecha"><span class="fp-monto monto-cobrar">${esc(dinero(total, 0))}</span><span class="chip u-sin-fecha"><i class="punto" aria-hidden="true"></i>${plural(deudas.length, 'persona', 'personas')}</span></span></button>` });
  }
  const controles = (m.nayarsound.controles ?? []).filter((c) => c.estado !== 'ok');
  if ((!E.filtro || E.filtro === 'aviso') && controles.length) {
    filasNs.push({ urg: 'aviso', fecha: null, html: `<a class="fila-pend u-aviso" href="#/nayarsound">
      <span class="fp-icono tipo-aviso">${icono('aviso')}</span>
      <span class="fp-texto"><span class="fp-titulo">Avisos de captura en tus hojas</span><small>${esc(controles.map((c) => (c.eventos?.length ? `DJ por buscar: ${c.eventos.map((e) => `${fechaCorta(e.idx)} ${capitalizar(e.ciudad.toLowerCase())}`).join(', ')}` : c.etiqueta)).join(' · '))}</small></span>
      <span class="fp-derecha"><span class="fp-monto fp-conteo">${controles.length}<small>${controles.length === 1 ? 'aviso' : 'avisos'}</small></span><span class="chip u-aviso"><i class="punto" aria-hidden="true"></i>Revisar</span></span></a>` });
  }
  bloques.push({ nombre: 'NayarSound', ruta: 'nayarsound', filas: filasNs, disponible: m.nayarsound.disponible });

  const pr = filtrar(m.pendientes.filter((p) => p.negocio === 'Préstamos'));
  bloques.push({ nombre: 'Préstamos e inversores', ruta: 'prestamos', disponible: m.prestamos.disponible,
    filas: pr.map((p) => ({ urg: p.urgencia, fecha: p.fechaIdx, html: filaPendiente(p, hoyIdx) })) });

  const rango = { vencido: 0, hoy: 1, proximo: 2, 'sin-fecha': 3, aviso: 4 };
  for (const b of bloques) b.filas.sort((a, z) => (rango[a.urg] - rango[z.urg]) || ((a.fecha ?? Infinity) - (z.fecha ?? Infinity)));

  const iconos = { nayarsound: 'musica', prestamos: 'prestamos' };
  // Con un filtro activo, solo se muestran los negocios que tienen algo de ese filtro.
  const visibles = E.filtro ? bloques.filter((b) => b.filas.length) : bloques;
  if (!visibles.length) return '<p class="vacio">Nada con este filtro.</p>';
  return visibles.map((b) => `
    <article class="tarjeta bloque-alertas">
      <header class="tarjeta-cab"><h3 class="etq-cab">${icono(iconos[b.ruta])}${esc(b.nombre)}</h3><a class="enlace-vista" href="#/${b.ruta}">Ver todo ${icono('flecha')}</a></header>
      ${!b.disponible ? '<p class="sin-dato">No se pudo leer este negocio.</p>'
    : b.filas.length ? `<div class="lista-pend">${b.filas.map((f) => f.html).join('')}</div>`
      : `<p class="vacio">${E.filtro ? 'Nada con este filtro.' : 'Sin pendientes.'}</p>`}
    </article>`).join('');
}

// ------------------------------------------------------------------ NayarSound

function vistaNayarsound(m) {
  const ns = m.nayarsound;
  if (!ns.disponible) return '<article class="tarjeta tarjeta-error">No hay datos de NayarSound.</article>';
  return `
  <h1 class="titulo-vista">NayarSound</h1>
  <div class="rejilla-ns">
    ${tarjetaAgenda(ns.agenda, m.hoy.idx)}
    ${tarjetaDeuda(ns.deuda)}
  </div>
  ${tarjetaControles(ns.controles)}
  ${listaAvisos(ns.avisos, 'Revisión de la lectura')}`;
}

function tarjetaAgenda(agenda, hoyIdx) {
  const cab = `<header class="tarjeta-cab"><h2>Agenda de eventos</h2>${enlaceOrigen(agenda?.origen)}</header>`;
  if (!agenda || agenda.estado === 'no-encontrado') return `<article class="tarjeta">${cab}<p class="sin-dato">No encontré el recordatorio de eventos.</p></article>`;
  if (agenda.estado === 'vacia') return `<article class="tarjeta">${cab}<p class="sin-dato">La celda de recordatorios está vacía.</p></article>`;
  if (agenda.estado === 'error' || agenda.estado === 'cargando') return `<article class="tarjeta">${cab}<p class="sin-dato">La celda de recordatorios muestra un error. Ábrela en tu hoja.</p></article>`;
  if (agenda.estado === 'sin-eventos' && !agenda.dias.length) return `<article class="tarjeta">${cab}<p class="vacio">No hay eventos en los próximos días, según tu hoja.</p></article>`;
  const pendientesDia = (idx) => [...E.pendientes.values()].filter((p) => p.grupo === `agenda|${idx}`);
  const dias = agenda.dias.map((dia) => {
    const etiqueta = diasRelativos(dia.idx - hoyIdx);
    const urg = dia.idx <= hoyIdx ? 'hoy' : 'proximo';
    const ciudades = dia.ciudades.map((c) => `
      <div class="ciudad">
        <div class="ciudad-cab"><i class="punto-ciudad c-${COLOR_CIUDAD[c.marca] ?? 'gris'}" aria-hidden="true"></i>${esc(c.ciudad)}
          <span class="ciudad-num">${c.djs.reduce((s, d) => s + d.eventos, 0)}</span></div>
        <div class="djs">${c.djs.map((dj) => {
    const p = pendientesDia(dia.idx).find((x) => !x.sinDj && x.titulo === dj.nombre && x.ciudad === c.ciudad);
    const accion = dj.banderas?.length;
    const hecho = !p && dj.realizados > 0;
    return `<button class="dj ${accion && !hecho ? 'requiere' : ''} ${hecho ? 'realizado' : ''}" ${p ? `data-pendiente="${esc(p.id)}"` : ''}>
            <b>${esc(dj.nombre)}</b>${dj.eventos > 1 ? `<span class="dj-n">×${dj.eventos}</span>` : ''}
            ${dj.horas?.length ? `<span class="dj-hora">${esc(dj.horas.join(' · '))}</span>` : ''}
            ${hecho ? '<span class="dj-hecho">Realizado</span>' : accion ? `<span class="dj-accion">${esc(dj.banderas.map((b) => b.texto).join(' · '))}</span>` : ''}
          </button>`;
  }).join('')}</div>
      </div>`).join('');
    const sinDj = pendientesDia(dia.idx).filter((p) => p.sinDj);
    const bloqueSinDj = sinDj.length ? `<div class="ciudad"><div class="ciudad-cab"><i class="punto-ciudad c-gris" aria-hidden="true"></i>Sin DJ asignado <span class="ciudad-num">${sinDj.length}</span></div>
      <div class="djs">${sinDj.map((p) => `<button class="dj requiere" data-pendiente="${esc(p.id)}"><b>${esc(p.subtitulo)}</b>${p.horas.length ? `<span class="dj-hora">${esc(p.horas.join(' · '))}</span>` : ''}<span class="dj-accion">Asignar DJ</span></button>`).join('')}</div></div>` : '';
    return `<section class="dia">
      <div class="dia-cab"><span class="chip u-${urg}"><i class="punto" aria-hidden="true"></i>${esc(etiqueta)}</span>
        <h3>${esc(capitalizar(fechaLarga(dia.idx)))}</h3>
        <span class="dia-total"><b>${dia.eventos ?? '—'}</b> ${dia.eventos === 1 ? 'evento' : 'eventos'}</span></div>
      ${ciudades}${bloqueSinDj}
    </section>`;
  }).join('');
  const nota = agenda.conRegistros ? 'Hora y enlace salen de AMAL AGENDA. Resaltados: eventos que tus reglas marcan con acción pendiente.'
    : 'Sin acceso a AMAL AGENDA: no se muestran horas ni enlaces.';
  return `<article class="tarjeta">${cab}${dias}<p class="nota">${esc(nota)}</p></article>`;
}

function tarjetaDeuda(deuda) {
  const cab = `<header class="tarjeta-cab"><h2>Recordatorio de deuda</h2>${enlaceOrigen(deuda?.origen)}</header>`;
  if (!deuda || deuda.estado === 'no-encontrado') return `<article class="tarjeta">${cab}<p class="sin-dato">No encontré el recordatorio de deuda.</p></article>`;
  if (deuda.estado === 'sin-deudas') return `<article class="tarjeta">${cab}<p class="vacio">✅ Sin deudas, según tu hoja.</p></article>`;
  if (deuda.estado !== 'ok') return `<article class="tarjeta">${cab}<p class="sin-dato">La celda del recordatorio de deuda está vacía o con error.</p></article>`;
  const filas = deuda.personas.map((p) => {
    const id = `deuda|${normalizar(p.nombre)}`;
    return `<tr data-pendiente="${esc(id)}" tabindex="0">
      <td><b>${esc(p.nombre)}</b>${(E.pendientes.get(id)?.ciudades ?? []).map(etiquetaCiudad).join('')}</td>
      <td class="num">${p.eventos}</td>
      <td class="num">${(() => { const n = diasDeuda(p, E.modelo.hoy.idx); return n === null ? '—' : `<span class="${n > 3 ? 'texto-rojo' : ''}">${esc(textoDias(n))}</span>`; })()}</td>
      <td>${p.fechas.map((f) => `<span class="fecha-mini">${esc(fechaCorta(f.idx))}</span>`).join(' ')}</td>
      <td class="num">${esc(dinero(p.monto, 0))}</td></tr>`;
  }).join('');
  const cruce = deuda.cruce ? `<p class="nota ${deuda.cruce.coincide ? 'ok' : 'mal'}">${deuda.cruce.coincide ? '✓' : '⚠'} ${deuda.cruce.eventos} eventos por liquidar; tu hoja marca «${esc(deuda.cruce.texto.replace(/[❌✅]/gu, '').trim())}».</p>` : '';
  // Contraído: solo el total; al tocarlo se despliega la tabla.
  return `<details class="tarjeta desplegable" id="deuda-desplegable" ${E.deudaAbierta ? 'open' : ''}>
    <summary>
      <span class="desp-cab"><h2>Recordatorio de deuda</h2>${icono('flecha', 'desp-flecha')}</span>
      <span class="cifra-linea"><span class="cifra monto-cobrar">${esc(dinero(deuda.total, 0))}</span><span class="sub">total por cobrar a ${plural(deuda.personas.length, 'persona', 'personas')}</span></span>
    </summary>
    <div class="desp-origen">${enlaceOrigen(deuda.origen)}</div>
    <div class="tabla-desliza"><table class="tabla"><thead><tr><th>Persona</th><th class="num">Eventos</th><th class="num">Debe hace</th><th>Fechas</th><th class="num">Importe</th></tr></thead>
    <tbody>${filas}</tbody>
    <tfoot><tr><td colspan="4">Total general por cobrar</td><td class="num">${esc(dinero(deuda.total, 0))}</td></tr></tfoot></table></div>
    <p class="nota">Días desde el evento más antiguo que se debe. Importes redondeados a pesos, como en tu hoja.</p>${cruce}
  </details>`;
}

/** Eventos con DJ «buscar»: cuándo y en qué ciudad, del más cercano al más lejano. */
function listaBuscar(eventos) {
  if (!eventos) return '';
  if (!eventos.length) return '<p class="nota">No encontré en la agenda los eventos con «buscar»; revisa la hoja.</p>';
  const hoyIdx = hoyCDMX().idx;
  return `<ul class="lista-buscar">${eventos.map((e) => {
    const faltan = e.idx - hoyIdx;
    const cuando = faltan === 0 ? 'hoy' : faltan === 1 ? 'mañana' : faltan > 1 ? `en ${faltan} días` : `hace ${-faltan} días`;
    return `<li class="${faltan <= 7 ? 'pronto' : ''}">
      <span class="lb-fecha"><b>${esc(capitalizar(fechaCorta(e.idx)))}</b><small>${esc(cuando)}${e.hora ? ` · ${esc(e.hora)}` : ''}</small></span>
      <span class="lb-ciudad">${esc(capitalizar(e.ciudad.toLowerCase()) || 'Sin ciudad')}${e.tipo ? `<small>${esc(capitalizar(e.tipo.toLowerCase()))}</small>` : ''}</span>
      ${e.origen.url ? `<a class="lb-enlace" href="${esc(e.origen.url)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir fila ${e.fila}">fila ${e.fila} ↗</a>` : ''}
    </li>`;
  }).join('')}</ul>`;
}

function tarjetaControles(controles) {
  if (!controles?.length) return '';
  const fallas = controles.filter((c) => c.estado !== 'ok');
  const bien = controles.length - fallas.length;
  // Contraído: solo cuántos avisos hay; al tocarlo se despliega el detalle.
  const resumen = fallas.length ? plural(fallas.length, 'aviso por revisar', 'avisos por revisar') : 'Todo en orden';
  return `<details class="tarjeta desplegable" id="controles-desplegable" ${E.controlesAbierto ? 'open' : ''}>
    <summary>
      <span class="desp-cab"><h2>Avisos de captura</h2>${icono('flecha', 'desp-flecha')}</span>
      <span class="desp-resumen ${fallas.length ? 'con-avisos' : ''}">${fallas.length ? '<i class="punto" aria-hidden="true"></i>' : ''}${esc(resumen)}</span>
    </summary>
    <div class="desp-cuerpo">
    ${fallas.length ? `<ul class="lista-controles">${fallas.map((c) => `<li><span class="chip u-aviso"><i class="punto" aria-hidden="true"></i>${esc(c.texto.replace(/[❌✅]/gu, '').trim())}</span> ${esc(c.etiqueta)} ${enlaceOrigen(c.origen)}${listaBuscar(c.eventos)}</li>`).join('')}</ul>` : '<p class="vacio">Todo en orden.</p>'}
    ${bien ? `<p class="nota">${plural(bien, 'control', 'controles')} en orden.</p>` : ''}
    </div>
  </details>`;
}

function listaAvisos(avisos, titulo) {
  if (!avisos?.length) return '';
  const unicos = [...new Set(avisos.map((a) => a.texto))];
  return `<details class="tarjeta avisos"><summary>${esc(titulo)} · ${unicos.length}</summary>
    <ul>${unicos.map((t) => `<li>${esc(ocultarImportes(t))}</li>`).join('')}</ul></details>`;
}

// ------------------------------------------------------------------ Préstamos

const din = (v, dec = 2) => (typeof v === 'number' ? esc(dinero(v, dec)) : '<span class="sin-dato">—</span>');
const pctTxt = (v, dec = 1) => (typeof v === 'number' ? `${(v * 100).toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec })}%` : '—');
const ACENTOS = { interes: 'interés', proyeccion: 'proyección', dia: 'día', prestamos: 'préstamos', prestamo: 'préstamo', utilidad: 'utilidad' };
const nombreBonito = (t) => capitalizar(String(t ?? '').toLowerCase().replace(/\p{L}+/gu, (w) => ACENTOS[w] ?? w));
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Columnas con cero al centro: verdes hacia arriba, coral hacia abajo. */
function columnasFlujo(items) {
  const vals = items.map((i) => i.valor ?? 0);
  const max = Math.max(0, ...vals);
  const min = Math.min(0, ...vals);
  const rango = (max - min) || 1;
  const pos = (max / rango) * 100;
  const cols = items.map((i) => {
    const v = i.valor ?? 0;
    const alto = (Math.abs(v) / (v >= 0 ? (max || 1) : (-min || 1))) * 100;
    return `<div class="df-col" data-tip="${esc(`${i.etiqueta}: ${dinero(v)}`)}" tabindex="0">
      <div class="df-arriba">${v > 0 ? `<i class="df-barra pos" style="height:${alto}%"></i>` : ''}</div>
      <div class="df-abajo">${v < 0 ? `<i class="df-barra neg" style="height:${alto}%"></i>` : ''}</div>
      ${i.marca ? `<span class="df-marca">${esc(i.marca)}</span>` : ''}
    </div>`;
  }).join('');
  return `<div class="df-cols" style="--pos:${pos}%">${cols}</div>`;
}

/** Líneas «👤 NOMBRE | 🧾 04-nov | 💰 $380» del resumen de cobro. */
function leerCobros(texto) {
  const grupos = [];
  let actual = null;
  for (const l of String(texto ?? '').split('\n').map((x) => x.trim()).filter(Boolean)) {
    const fila = l.match(/^👤\s*(.+?)\s*\|\s*🧾\s*([^|]+?)\s*\|\s*💰\s*\$?\s*([\d.,]+)/u);
    if (fila && actual) { actual.filas.push({ nombre: fila[1], fecha: fila[2], monto: Number(fila[3].replace(/[.,]/g, '')) }); continue; }
    const total = l.match(/TOTAL PENDIENTE (ESTE|PRÓXIMO|PROXIMO) MES:\s*\$?([\d.,]+)/iu);
    if (total && /📊/u.test(l) && actual) { actual.total = Number(total[2].replace(/[.,]/g, '')); continue; }
    if (/^(🟢|🔵|⏳)/u.test(l)) { actual = { titulo: nombreBonito(l.replace(/^\S+\s*/u, '')), filas: [] }; grupos.push(actual); }
  }
  return grupos.filter((g) => g.filas.length);
}

const PESTANAS_PR = [['resumen', 'Resumen'], ['prestamos', 'Préstamos'], ['inversores', 'Inversores'], ['historial', 'Historial']];

/** «10 nov» */
function diaMes(idx) {
  const f = new Date(idx * 86400000);
  return `${f.getUTCDate()} ${MES_CORTO[f.getUTCMonth()]}`;
}
const cuandoTxt = (dif) => (dif === 0 ? 'Hoy' : dif === 1 ? 'Mañana' : dif > 1 ? `En ${dif} días` : `Hace ${-dif} días`);
/** Cifra con centavos en computadora y redondeada en celular. */
const cifraDoble = (v) => (typeof v === 'number'
  ? `<span class="solo-escritorio">${esc(dinero(v, 2))}</span><span class="solo-movil">${esc(dinero(v, 0))}</span>` : '<span class="sin-dato">—</span>');
const tagMov = (accion) => `<span class="pf-tag ${accion === 'COBRAR' ? 'cobrar' : 'pagar'}">${accion === 'COBRAR' ? 'Cobrar' : 'Pagar'}</span>`;
const montoMov = (accion, v) => `<span class="${accion === 'COBRAR' ? 'texto-verde' : 'texto-rojo'}">${din(v, 0)}</span>`;

function tablaPF(columnas, filas, { pie = '', clase = '' } = {}) {
  return `<div class="tabla-desliza"><table class="pf-tabla ${clase}"><thead><tr>${columnas.map(([t, num]) => `<th class="${num ? 'num' : ''}">${esc(t)}</th>`).join('')}</tr></thead>
    <tbody>${filas.join('')}</tbody>${pie ? `<tfoot>${pie}</tfoot>` : ''}</table></div>`;
}

/**
 * Sección desplegable del panel financiero, con su color de grupo (como en tu
 * hoja: verde capital, ámbar rendimiento, rojo pagos y pendientes, azul
 * movimientos). Empieza contraída; el panel recuerda las que abres.
 */
function seccionPF(id, color, titulo, resumen, cuerpo) {
  const abierta = (E.pref.pfAbiertos ?? []).includes(id);
  return `<details class="tarjeta pf-sec pf-c-${color}" data-pf="${esc(id)}" ${abierta ? 'open' : ''}>
    <summary><span class="pf-sec-cab"><i class="pf-punto" aria-hidden="true"></i><span class="pf-sec-titulo">${titulo}</span>${icono('flecha', 'desp-flecha')}</span>
      ${resumen ? `<span class="pf-sec-resumen">${resumen}</span>` : ''}</summary>
    <div class="pf-sec-cuerpo">${cuerpo}</div>
  </details>`;
}

function vistaPrestamos(m) {
  const pr = m.prestamos;
  if (!pr.disponible) return '<article class="tarjeta tarjeta-error">No hay datos de préstamos.</article>';
  if (!PESTANAS_PR.some(([k]) => k === E.tabPr)) E.tabPr = 'resumen';
  const d = pr.dashboard ?? {};
  const tabs = `<nav class="pf-tabs" role="tablist">${PESTANAS_PR.map(([k, t]) => `<button role="tab" class="pf-tab ${E.tabPr === k ? 'activo' : ''}" aria-selected="${E.tabPr === k}" data-accion="tab-pr" data-tab="${k}">${t}</button>`).join('')}</nav>`;
  const cuerpo = { resumen: prResumen, prestamos: prPrestamos, inversores: prInversores, historial: prHistorial }[E.tabPr](m, pr, d);
  return `<div class="pf">${tabs}${cuerpo}</div>`;
}

function prResumen(m, pr, d) {
  const r = Object.fromEntries((d.resumen ?? []).map((x) => [normalizar(x.etiqueta), x]));
  const v = (k) => (typeof r[k]?.valor === 'number' ? r[k].valor : null);
  const h = d.historico ?? {};
  const prestado = v('CAPITAL PRESTADO'); const propio = v('CAPITAL PROPIO'); const inv = v('CAPITAL DE INVERSORES');
  const pctDe = (x) => (typeof x === 'number' && prestado ? ` · ${esc(pctTxt(x / prestado, 0))}` : '');
  const kpi = (color, etiqueta, valor, sub) => `<article class="tarjeta pf-kpi pf-c-${color}">
    <div class="pf-kpi-etq"><i class="pf-punto" aria-hidden="true"></i>${etiqueta}</div><div class="pf-kpi-valor">${cifraDoble(valor)}</div>
    <div class="pf-kpi-sub">${sub}</div></article>`;
  const kpis = `<section class="pf-kpis">
    ${kpi('verde', 'Capital prestado', prestado, 'Total en la calle')}
    ${kpi('verde', 'Capital propio', propio, `Tuyo${pctDe(propio)}`)}
    ${kpi('verde', 'Capital de inversores', inv, `De inversores${pctDe(inv)}`)}
    ${kpi('rojo', 'Pago mensual a inversores', v('PAGO MENSUAL A INVERSORES'), 'Lo que pagas cada mes')}
  </section>`;

  // Resumen financiero agrupado por colores, como en tu hoja
  const fila = (k, { pct = false, resaltar = false } = {}) => (r[k] ? `<div class="pf-dato ${resaltar ? 'resaltar' : ''}"><span>${esc(nombreBonito(r[k].etiqueta))}</span><b>${pct || r[k].esPct ? esc(pctTxt(r[k].valor, 2)) : din(r[k].valor)}</b></div>` : '');
  const grupos = [
    seccionPF('rendimiento', 'ambar', 'Rendimiento', `Proyección mensual <b>${din(v('PROYECCION MENSUAL'))}</b> · ${esc(pctTxt(v('INTERES PROMEDIO MENSUAL'), 2))}`,
      `<div class="pf-datos">${fila('INTERES GENERADO POR DIA')}${fila('UTILIDAD PROPIA POR DIA')}${fila('UTILIDAD INVERSOR POR DIA')}${fila('INTERES PROMEDIO MENSUAL', { pct: true })}${fila('PROYECCION MENSUAL', { resaltar: true })}</div>`),
    seccionPF('pendientes', 'rojo', 'Pagos y pendientes', `Por cobrar <b>${din(v('PENDIENTE INTERES A COBRAR'))}</b> · a inversores <b>${din(v('PENDIENTE INTERES A INVERSORES'))}</b>`,
      `<div class="pf-datos">${fila('PAGO MENSUAL A INVERSORES')}${fila('PENDIENTE INTERES A COBRAR')}${fila('PENDIENTE INTERES A INVERSORES', { resaltar: true })}${fila('RESTANTE PROPIO')}</div>`),
  ];

  // Próximos movimientos (recordatorio de 5 días de tu hoja)
  const idDe = (accion, item) => [...E.pendientes.values()].find((p) => p.accion === accion && p.tipo !== 'liquidar'
    && p.titulo === item.nombre && p.fechaIdx === item.fechaIdx && p.linea === item.linea)?.id;
  const movs = [...pr.cobrar.map((x) => ({ ...x, accion: 'COBRAR' })), ...pr.pagar.map((x) => ({ ...x, accion: 'PAGAR' }))]
    .sort((a, b) => a.fechaIdx - b.fechaIdx || (a.accion === 'COBRAR' ? -1 : 1));
  const t = pr.totales ?? { cobrarMXN: 0, pagarMXN: 0 };
  const filaMov = (x) => {
    const id = idDe(x.accion, x);
    return `<tr ${id ? `data-pendiente="${esc(id)}" tabindex="0"` : ''}><td>${esc(diaMes(x.fechaIdx))} · ${esc(cuandoTxt(x.diferencia))}</td><td>${tagMov(x.accion)}</td><td>${esc(x.nombre)}</td><td class="num"><b>${montoMov(x.accion, x.montoMXN)}</b></td></tr>`;
  };
  const tarjetaMov = (x) => {
    const id = idDe(x.accion, x);
    return `<button class="pf-mov" ${id ? `data-pendiente="${esc(id)}"` : ''}><span class="pf-mov-cab">${tagMov(x.accion)}<small>${esc(cuandoTxt(x.diferencia))} · ${esc(diaMes(x.fechaIdx))}</small></span>
      <span class="pf-mov-fila"><b>${esc(x.nombre)}</b><b>${montoMov(x.accion, x.montoMXN)}</b></span></button>`;
  };
  const totalesMov = `<div class="pf-totales"><span>Por cobrar <b class="texto-verde">${din(t.cobrarMXN, 0)}</b></span><span>Por pagar <b class="texto-rojo">${din(t.pagarMXN, 0)}</b></span></div>`;
  const movimientos = seccionPF('movimientos', 'azul', 'Próximos movimientos',
    movs.length ? `${plural(movs.length, 'movimiento', 'movimientos')} en 5 días · cobrar <b class="texto-verde">${din(t.cobrarMXN, 0)}</b> · pagar <b class="texto-rojo">${din(t.pagarMXN, 0)}</b>` : 'Nada en los próximos 5 días',
    movs.length ? `<div class="solo-escritorio">${tablaPF([['Fecha'], ['Movimiento'], ['Nombre'], ['Importe', 1]], movs.map(filaMov))}</div>
      <div class="solo-movil pf-movs-lista">${movs.map(tarjetaMov).join('')}</div>${totalesMov}`
    : `<p class="vacio">${pr.estado === 'sin-recordatorios' ? 'Tu hoja no muestra movimientos en los próximos 5 días.' : 'Nada en los próximos 5 días.'}</p>`);

  // Flujo de efectivo
  const tx = d.textos ?? {};
  const ca = tx.cashflowActual ? leerCashflow(tx.cashflowActual.texto) : null;
  const cs = tx.cashflowSiguiente ? leerCashflow(tx.cashflowSiguiente.texto) : null;
  const bal = (x) => (x?.balance === null || x?.balance === undefined ? '—' : `<b class="${x.balance < 0 ? 'texto-rojo' : 'texto-verde'}">${din(x.balance, 0)}</b>`);
  const flujo = ca || cs ? seccionPF('flujo', 'azul', 'Flujo de efectivo', `Balance este mes ${bal(ca)} · próximo ${bal(cs)}`,
    `<table class="pf-tabla pf-tabla-flujo"><thead><tr><th></th><th class="num">Este mes</th><th class="num">Próximo mes</th></tr></thead><tbody>
      <tr><td>Ingresos</td><td class="num">${din(ca?.ingresos, 0)}</td><td class="num">${din(cs?.ingresos, 0)}</td></tr>
      <tr><td>Pagos</td><td class="num">${din(ca?.pagos, 0)}</td><td class="num">${din(cs?.pagos, 0)}</td></tr>
      <tr class="pf-balance"><td>Balance</td><td class="num">${bal(ca)}</td><td class="num">${bal(cs)}</td></tr>
    </tbody></table>`) : '';

  // Préstamos e inversores activos
  const pa = [...(d.prestamosActivos ?? [])].sort((a, b) => (b.capital ?? 0) - (a.capital ?? 0));
  const ia = d.inversoresActivos ?? [];
  const suma = (lista, k) => lista.reduce((s, x) => s + (x[k] ?? 0), 0);
  const verTodos = (tab, texto) => `<button class="boton-texto pf-ver" data-accion="tab-pr" data-tab="${tab}">${texto} ${icono('flecha')}</button>`;
  const prestamos = pa.length ? seccionPF('activos', 'verde', 'Préstamos activos', `${plural(pa.length, 'cliente', 'clientes')} · capital <b>${din(suma(pa, 'capital'), 0)}</b> · pago mensual <b>${din(suma(pa, 'pago'), 0)}</b>`,
    `${tablaPF([['Cliente'], ['Capital', 1], ['Pago mensual', 1], ['Interés restante', 1]],
      pa.slice(0, 5).map((x) => `<tr><td>${esc(x.nombre)}</td><td class="num">${din(x.capital, 0)}</td><td class="num">${din(x.pago, 0)}</td><td class="num">${din(x.interes, 0)}</td></tr>`))}
    <div class="pf-pie">${verTodos('prestamos', `Ver los ${pa.length}`)}</div>`) : '';
  const inversores = ia.length ? seccionPF('inversores', 'rojo', 'Inversores activos', `${plural(ia.length, 'registro', 'registros')} · capital <b>${din(suma(ia, 'capital'), 0)}</b> · pago mensual <b>${din(suma(ia, 'pago'))}</b>`,
    `${tablaPF([['Inversor'], ['Capital', 1], ['Pago mensual', 1]],
      ia.map((x) => `<tr><td>${esc(x.nombre)}</td><td class="num">${din(x.capital, 0)}</td><td class="num">${din(x.pago, 0)}</td></tr>`),
      { pie: `<tr><td colspan="2">Pago mensual</td><td class="num">${din(suma(ia, 'pago'))}</td></tr>`, clase: 'pf-compacta' })}
    <div class="pf-pie">${verTodos('inversores', 'Ver detalle')}</div>`) : '';

  // Resultado del año
  const tm = d.meses?.total;
  const resultado = tm ? seccionPF('resultado', 'ambar', `Resultado ${esc(d.meses.anio || '')}`, `Ganancia neta <b class="${tm.ganancia < 0 ? 'texto-rojo' : 'texto-verde'}">${din(tm.ganancia)}</b>`,
    `<div class="pf-datos">
      <div class="pf-dato"><span>Intereses cobrados</span><b>${din(tm.cobrado)}</b></div>
      <div class="pf-dato"><span>Pagado a inversores</span><b>${din(tm.pagado)}</b></div>
      <div class="pf-dato"><span>Ganancia neta</span><b class="${tm.ganancia < 0 ? 'texto-rojo' : 'texto-verde'}">${din(tm.ganancia)}</b></div>
    </div><div class="pf-pie">${verTodos('historial', 'Ver desglose mensual')}</div>`) : '';

  return `${kpis}
    <section class="pf-fila">${grupos.join('')}</section>
    <section class="pf-fila">${movimientos}${flujo}</section>
    <section class="pf-fila">${prestamos}${inversores}</section>
    ${resultado}
    <p class="nota">Fuente: DASHBOARD de 💵REGISTRO DE PRESTAMOS ${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">↗</a>` : ''} y su recordatorio de 5 días ${enlaceOrigen(pr.origen)}. USDT convertido a ${TIPO_CAMBIO_USDT} MXN, la tasa de tus fórmulas.</p>
    ${listaAvisos(pr.avisos, 'Revisión de la lectura')}`;
}

function prPrestamos(m, pr, d) {
  const pa = [...(d.prestamosActivos ?? [])].sort((a, b) => (b.capital ?? 0) - (a.capital ?? 0));
  if (!pa.length) return '<p class="vacio">No encontré la tabla PRESTAMOS ACTIVOS en tu DASHBOARD.</p>';
  const total = pa.reduce((s, x) => s + (x.capital ?? 0), 0) || 1;
  const suma = (k) => pa.reduce((s, x) => s + (x[k] ?? 0), 0);
  return seccionPF('t-prestamos', 'verde', 'Préstamos activos', `${plural(pa.length, 'cliente', 'clientes')} · capital <b>${din(suma('capital'), 0)}</b> · interés restante <b>${din(suma('interes'), 0)}</b>`,
    `${tablaPF([['Cliente'], ['Capital', 1], ['% cartera', 1], ['Pago mensual', 1], ['Interés restante', 1]],
      pa.map((x) => `<tr><td>${esc(x.nombre)}</td><td class="num">${din(x.capital, 0)}</td><td class="num pf-pct"><span class="pf-pista"><i style="width:${((x.capital ?? 0) / total) * 100}%"></i></span>${esc(pctTxt((x.capital ?? 0) / total))}</td><td class="num">${din(x.pago, 0)}</td><td class="num">${din(x.interes, 0)}</td></tr>`),
      { pie: `<tr><td>Total</td><td class="num">${din(suma('capital'), 0)}</td><td class="num">100%</td><td class="num">${din(suma('pago'))}</td><td class="num">${din(suma('interes'))}</td></tr>` })}`);
}

function prInversores(m, pr, d) {
  const inv = pr.inversiones;
  // Sin acceso al registro: la tabla del DASHBOARD como antes.
  if (!inv) {
    const ia = d.inversoresActivos ?? [];
    const suma = (k) => ia.reduce((s, x) => s + (x[k] ?? 0), 0);
    return ia.length ? seccionPF('t-inversores', 'rojo', 'Inversores activos', `${plural(ia.length, 'registro', 'registros')} · capital <b>${din(suma('capital'), 0)}</b> · pago mensual <b>${din(suma('pago'))}</b>`,
      tablaPF([['Inversor'], ['Capital', 1], ['Pago mensual', 1]], ia.map((x) => `<tr><td>${esc(x.nombre)}</td><td class="num">${din(x.capital, 0)}</td><td class="num">${din(x.pago, 0)}</td></tr>`)))
      : '<p class="vacio">No encontré inversores activos en tu hoja.</p>';
  }
  if (!inv.length) return '<p class="vacio">No hay inversiones con estado ACTIVO en REGISTRO DE INVERSORES.</p>';
  const importe = (monto, moneda) => (moneda === 'USDT'
    ? `${esc(monto.toLocaleString('es-MX', { maximumFractionDigits: 2 }))} USDT <small>≈ ${din(monto * TIPO_CAMBIO_USDT, 0)} MXN</small>`
    : `${din(monto, 0)} MXN`);
  const chipPago = (x) => {
    const p = x.pago;
    if (p.estado === 'pagado') return `<span class="pf-estado ok">Pagado</span><span>${esc(diaMes(p.idx))} · ${importe(p.monto, p.moneda)}</span>`;
    if (p.estado === 'pendiente') return `<span class="pf-estado pend">Pendiente</span><span>${esc(diaMes(p.idx))}${p.dias === 0 ? ' · hoy' : p.dias === 1 ? ' · mañana' : ` · en ${p.dias} días`} · ${importe(p.monto, p.moneda)}</span>`;
    if (p.estado === 'atrasado') return `<span class="pf-estado mal">Atrasado</span><span>vencía ${esc(diaMes(p.idx))}${p.faltan > 1 ? ` · ${p.faltan} pagos sin registrar` : ''} · ${importe(p.monto, p.moneda)}</span>`;
    if (p.estado === 'sin-pago') return `<span class="pf-estado neutro">Sin pago este mes</span><span>primero ${esc(diaMes(p.idx))} · ${importe(p.monto, p.moneda)}</span>`;
    if (p.estado === 'sin-interes') return '<span class="pf-estado neutro">Sin interés</span><span>tasa 0%</span>';
    return '<span class="pf-estado neutro">Sin dato</span>';
  };
  const liquidar = (x) => {
    if (x.compromisoIdx === null) return '<span class="pf-liq">Sin fecha de liquidación</span>';
    const fecha = fechaCorta(x.compromisoIdx).replace(/^\S+\s/, '');
    const anio = ymdDesdeIdx(x.compromisoIdx).y;
    if (!x.alertaLiquidar) return `<span class="pf-liq">Liquida capital ${esc(fecha)}${anio !== m.hoy.y ? ` ${anio}` : ''} · en ${x.diasLiquidar} días</span>`;
    const txt = x.diasLiquidar < 0 ? `venció hace ${-x.diasLiquidar} ${-x.diasLiquidar === 1 ? 'día' : 'días'}` : x.diasLiquidar === 0 ? 'hoy' : `faltan ${x.diasLiquidar} ${x.diasLiquidar === 1 ? 'día' : 'días'}`;
    return `<span class="pf-alerta">${icono('aviso')}Liquidar capital ${esc(fecha)}${anio !== m.hoy.y ? ` ${anio}` : ''} · ${esc(txt)}</span>`;
  };
  const filas = inv.map((x) => `<div class="pf-inv ${x.alertaLiquidar ? 'con-alerta' : ''}">
      <div class="pf-inv-cab">
        <span class="pf-inv-nombre">${esc(x.nombre)}<small>op. ${esc(String(x.op))} · ${x.divisa}${x.tasa !== null ? ` · ${esc(pctTxt(x.tasa, x.tasa * 100 % 1 ? 2 : 0))} mensual` : ''}</small></span>
        <span class="pf-inv-capital">${x.divisa === 'USDT' && x.cantidad !== null ? `${esc(x.cantidad.toLocaleString('es-MX'))} USDT<small>${din(x.capitalMXN, 0)} MXN</small>` : din(x.capitalMXN, 0)}</span>
      </div>
      <div class="pf-inv-pago"><span class="pf-inv-etq">Pago ${esc(MESES[m.hoy.m - 1].toLowerCase())}</span>${chipPago(x)}</div>
      ${liquidar(x)}
    </div>`).join('');
  const total = inv.reduce((s, x) => s + (x.capitalMXN ?? 0), 0);
  const mensualMXN = inv.reduce((s, x) => s + (x.pagoMes ? (x.divisa === 'USDT' ? x.pagoMes * TIPO_CAMBIO_USDT : x.pagoMes) : 0), 0);
  const pendientes = inv.filter((x) => ['pendiente', 'atrasado'].includes(x.pago.estado));
  const alertas = inv.filter((x) => x.alertaLiquidar).length;
  const resumen = [`${plural(inv.length, 'inversión', 'inversiones')} · capital <b>${din(total, 0)}</b>`,
    pendientes.length ? `<b class="texto-rojo">${plural(pendientes.length, 'pago pendiente', 'pagos pendientes')}</b> este mes` : '<b class="texto-verde">pagos del mes al día</b>',
    alertas ? `<b class="texto-rojo">⚠ ${plural(alertas, 'capital por liquidar', 'capitales por liquidar')} en 30 días</b>` : ''].filter(Boolean).join(' · ');
  return seccionPF('t-inversores', 'rojo', 'Inversores activos', resumen,
    `<div class="pf-invs">${filas}</div>
    <div class="pf-inv-pie"><span>Intereses al mes <b>${din(mensualMXN, 0)} MXN</b></span><span>Capital total <b>${din(total, 0)} MXN</b></span></div>
    <p class="nota">Pagos: registro de pagos de REGISTRO DE INVERSORES (columnas U:AA) contra los vencimientos mensuales desde la fecha de inicio. USDT a ${TIPO_CAMBIO_USDT} MXN. ${pr.inversionesUrl ? `<a href="${esc(pr.inversionesUrl)}" target="_blank" rel="noopener noreferrer">Abrir hoja ↗</a>` : ''}</p>`);
}

function prHistorial(m, pr, d) {
  const h = d.historico ?? {};
  const partes = [];
  if (d.meses?.filas?.length) {
    const t = d.meses.total;
    partes.push(seccionPF('h-meses', 'ambar', `${esc(d.meses.anio || 'Año')} mes a mes`, t ? `Cobrado <b>${din(t.cobrado)}</b> · ganancia <b>${din(t.ganancia)}</b>` : '',
      `${tablaPF([['Mes'], ['Intereses cobrados', 1], ['Pagado', 1], ['Ganancia', 1]],
        d.meses.filas.map((x) => `<tr><td>${esc(nombreBonito(x.mes))}</td><td class="num">${din(x.cobrado)}</td><td class="num">${din(x.pagado)}</td><td class="num"><b>${din(x.ganancia)}</b></td></tr>`),
        { pie: t ? `<tr><td>Total</td><td class="num">${din(t.cobrado)}</td><td class="num">${din(t.pagado)}</td><td class="num">${din(t.ganancia)}</td></tr>` : '' })}
      <p class="nota">El año se elige en la celda «AÑO» de tu DASHBOARD.</p>`));
  }
  if (d.porAnio?.length) {
    partes.push(seccionPF('h-anios', 'ambar', 'Resultado por año', `Ganancia total <b>${din(h.ganancia)}</b>${h.anios ? ` en ${esc(String(h.anios))} años` : ''}`,
      `${tablaPF([['Año'], ['Generado', 1], ['Pagado a inversores', 1], ['Ganancia', 1]],
        d.porAnio.map((a) => `<tr><td>${esc(a.anio)}</td><td class="num">${din(a.generado)}</td><td class="num">${din(a.pagado)}</td><td class="num"><b>${din(a.ganancia)}</b></td></tr>`),
        { pie: d.historico ? `<tr><td>Total ${h.anios ? `(${esc(String(h.anios))} años)` : ''}</td><td class="num">${din(h.generado)}</td><td class="num">${din(h.pagado)}</td><td class="num">${din(h.ganancia)}</td></tr>` : '' })}`));
  }
  if (d.flujo?.length) {
    const items = d.flujo.filter((x) => x.mes).map((x) => {
      const me = leerEtiquetaMes(x.mes);
      return { etiqueta: me ? nombreMes(me.y, me.m) : nombreBonito(x.mes), valor: x.ganancia ?? 0, marca: me && me.m === 1 ? String(me.y) : '' };
    });
    const pos = items.filter((x) => x.valor > 0).length;
    partes.push(seccionPF('h-flujo', 'azul', 'Flujo histórico', `${plural(items.length, 'mes', 'meses')} · ${pos} en positivo`, columnasFlujo(items)));
  }
  const grupos = leerCobros(d.textos?.cobroIntereses?.texto);
  if (grupos.length) {
    const totalCobros = grupos.reduce((t, g) => t + g.filas.reduce((x, f) => x + f.monto, 0), 0);
    partes.push(seccionPF('h-cobros', 'verde', 'Intereses por cobrar a clientes', `Total <b>${din(totalCobros, 0)}</b>`,
      `${grupos.map((g) => `<h3 class="df-sub">${esc(g.titulo)}</h3><div class="df-lista">${g.filas.map((f) => `<div><span>${esc(nombreBonito(f.nombre))}</span><small>${esc(f.fecha)}</small><b>${din(f.monto, 0)}</b></div>`).join('')}</div>`).join('')}`));
  }
  return partes.join('') || '<p class="vacio">Sin historial en tu DASHBOARD.</p>';
}

// ------------------------------------------------------------------ Finanzas

function vistaFinanzas(m) {
  const fi = m.finanzas;
  if (!fi.disponible || !fi.meses.length) {
    return `<h1 class="titulo-vista">Finanzas</h1><article class="tarjeta tarjeta-error">No hay datos de finanzas.</article>${listaAvisos(fi.avisos, 'Revisión de la lectura')}`;
  }
  const sel = selectorMes(fi);
  const mes = periodoElegido(fi);
  const negocios = mes.negocios.map((n) => ({ nombre: n.nombre, valor: n.valor, nota: n.estado === 'vacia' ? 'Celda vacía' : n.estado === 'error' ? n.texto : '' }));
  // Todas las categorías, de mayor a menor, con su % del total de gastos del mes.
  const cats = [...(mes.categorias ?? [])].sort((a, b) => b.total - a.total);
  const totalCats = cats.reduce((t, c) => t + c.total, 0);
  const pct = (v) => `${(totalCats > 0 ? (v / totalCats) * 100 : 0).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const catItems = cats.map((c) => ({ nombre: c.nombre, valor: c.total, extra: pct(c.total), detalle: `${pct(c.total)} · ${plural(c.registros, 'registro', 'registros')}` }));
  const avisosMes = [...mes.avisos, ...fi.avisos.map((a) => a.texto)];
  return `
  <div class="cab-vista">
    <h1 class="titulo-vista">Finanzas</h1>
    ${sel}
  </div>
  <section class="rejilla-tiles">${tilesFinanzas(mes)}</section>
  <section class="rejilla-dos">
    <article class="tarjeta">
      <header class="tarjeta-cab"><h2>Ganancia por negocio</h2>${mes.esAnio ? '' : enlaceOrigen(mes.ganancia.origen, `fila ${mes.fila}`)}</header>
      ${barras(negocios, { divergente: true })}
    </article>
    <article class="tarjeta">
      <header class="tarjeta-cab"><h2>Gastos por categoría</h2></header>
      ${barras(catItems, { vacio: mes.registrosGastos === 0 ? `Sin gastos registrados ${mes.esAnio ? 'este año' : 'este mes'}.` : 'Sin desglose disponible.' })}
      ${catItems.length ? `<div class="graf-total"><span>Total de gastos</span><span>${esc(dinero(totalCats))} <small>100%</small></span></div>` : ''}
      ${mes.gastosCuadran === true ? '<p class="nota ok">✓ Las categorías suman lo mismo que tu hoja.</p>' : ''}
      ${mes.esAnio && mes.cuadraHoja === true ? `<p class="nota ok">✓ Ganancia y gastos de ${mes.y} coinciden con el total anual de tu hoja.</p>` : ''}
    </article>
  </section>
  <article class="tarjeta">
    <header class="tarjeta-cab"><h2>Evolución mensual</h2>
      <button class="boton-texto" data-accion="tabla" data-objetivo="tabla-mensual">Ver tabla</button></header>
    <div class="leyenda"><span><i class="muestra s-ganancia"></i>Ganancia</span><span><i class="muestra s-gastos"></i>Gastos personales</span><span><i class="muestra s-sobrante"></i>Sobrante</span></div>
    <div id="grafica-mensual" class="grafica"></div>
    <div id="tabla-mensual" hidden>${tablaMensual(fi)}</div>
  </article>
  ${avisosMes.length ? `<article class="tarjeta avisos-abiertos"><h2>Revisión de ${esc(mes.esAnio ? String(mes.y) : mes.y ? nombreMes(mes.y, mes.m) : mes.etiqueta)}</h2><ul>${[...new Set(avisosMes)].map((a) => `<li>${esc(ocultarImportes(a))}</li>`).join('')}</ul></article>` : ''}
  <p class="nota">La ganancia mensual es la columna GANANCIA MENSUAL de tu hoja (suma de negocios). El sobrante es un resultado calculado; no es saldo bancario ni dinero disponible.</p>`;
}

function tablaMensual(fi) {
  const cab = ['Mes', ...fi.negocios, 'Ganancia', 'Gastos', 'Sobrante'];
  const filas = fi.meses.map((x) => `<tr><td>${esc(x.etiqueta)}</td>${x.negocios.map((n) => `<td class="num">${valorCelda(n)}</td>`).join('')}
    <td class="num">${valorCelda(x.ganancia)}</td><td class="num">${valorCelda(x.gastos)}</td><td class="num">${valorCelda(x.sobrante)}</td></tr>`).join('');
  return `<div class="tabla-desliza"><table class="tabla"><thead><tr>${cab.map((c, i) => `<th class="${i ? 'num' : ''}">${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table></div>`;
}

function montarGraficaMensual() {
  const cont = $('#grafica-mensual');
  const fi = E.modelo?.finanzas;
  if (!cont || !fi?.meses?.length) return;
  const corto = (x) => (x.m ? `${MESES[x.m - 1].slice(0, 3).toLowerCase()}` : x.etiqueta.slice(0, 3));
  E.limpiar.push(lineas(cont, {
    etiquetas: fi.meses.map((x) => (x.y ? nombreMes(x.y, x.m) : x.etiqueta)),
    etiquetasCortas: fi.meses.map(corto),
    series: [
      { nombre: 'Ganancia', clase: 's-ganancia', valores: fi.meses.map((x) => x.ganancia.valor) },
      { nombre: 'Gastos personales', clase: 's-gastos', valores: fi.meses.map((x) => x.gastos.valor) },
      { nombre: 'Sobrante', clase: 's-sobrante', valores: fi.meses.map((x) => x.sobrante.valor) },
    ],
  }));
}

// ------------------------------------------------------------------ Fuentes y ajustes

function vistaFuentes() {
  const filas = ORDEN_ARCHIVOS.map((k) => {
    const f = E.fuentes[k];
    const def = ARCHIVOS[k];
    const meta = f?.datos?.meta;
    let estado = '<span class="sin-dato">Sin leer</span>';
    if (f?.estado === 'ok') estado = `<span class="ok">✓ Leído ${esc(momento(f.actualizado))}</span>`;
    if (f?.estado === 'error') estado = `<span class="mal">⚠ ${esc(f.error.mensaje)}</span>${f.datos ? `<br><small>Datos anteriores: ${esc(momento(f.actualizado))}</small>` : ''}`;
    const rangos = Object.values(def.rangos).map((r) => {
      const pestana = r.match(/^'(.+)'!/)?.[1];
      const gid = meta?.pestanas?.[pestana];
      const id = ARCHIVOS[k].id;
      const url = id ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit${gid !== undefined ? `#gid=${gid}` : ''}` : null;
      return url && !E.demo ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(r)}</a>` : `<span>${esc(r)}</span>`;
    }).join('<br>');
    const zona = meta?.zona ? `<br><small>Zona horaria del archivo: ${esc(meta.zona)}${meta.zona !== 'America/Mexico_City' ? ' (distinta a CDMX)' : ''}</small>` : '';
    return `<tr><td><b>${esc(def.nombre)}</b>${zona}</td><td class="rangos">${rangos}</td><td>${estado}</td></tr>`;
  }).join('');
  const m = E.modelo;
  const avisos = m ? [...m.nayarsound.avisos, ...m.prestamos.avisos, ...m.finanzas.avisos] : [];
  const autos = [0, 5, 15, 30, 60].map((n) => `<option value="${n}" ${Number(E.pref.autoMinutos) === n ? 'selected' : ''}>${n ? `Cada ${n} minutos` : 'Desactivada'}</option>`).join('');
  return `
  <h1 class="titulo-vista">Fuentes y ajustes</h1>
  <article class="tarjeta">
    <header class="tarjeta-cab"><h2>De dónde salen los datos</h2></header>
    <div class="tabla-desliza"><table class="tabla"><thead><tr><th>Archivo</th><th>Rangos leídos (solo lectura)</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table></div>
    <p class="nota">Pendientes: textos de recordatorio de cada DASHBOARD. Finanzas: tabla mensual de DASHBOARD BALANCE GENERAL. Los registros solo añaden hora y enlace.</p>
  </article>
  ${avisos.length ? `<article class="tarjeta avisos-abiertos"><h2>Revisión de la lectura</h2><ul>${[...new Set(avisos.map((a) => a.texto))].map((t) => `<li>${esc(ocultarImportes(t))}</li>`).join('')}</ul></article>` : ''}
  <article class="tarjeta">
    <header class="tarjeta-cab"><h2>Ajustes</h2></header>
    <label class="selector">Actualización automática <select id="sel-auto">${autos}</select></label>
    <p class="nota">Solo se actualiza mientras la página está abierta.</p>
    ${E.demo ? '' : `<div class="botones">
      <button class="boton" data-accion="salir">Cerrar sesión de Google</button>
    </div>`}
  </article>`;
}

function vistaEntrarGoogle() {
  return `
  <article class="tarjeta formulario entrar">
    <h1 class="titulo-vista">Panel personal</h1>
    <p>Entra con tu cuenta de Google para leer tus hojas. El panel solo escribe cuando marcas un pago.</p>
    ${E.errorSesion ? `<p class="mal" role="alert">${esc(E.errorSesion)}</p>` : ''}
    <button class="boton boton-primario boton-grande" data-accion="entrar" ${E.sesion !== 'lista' ? 'disabled' : ''}>${E.sesion === 'preparando' ? 'Preparando…' : `${icono('google')}Entrar con Google`}</button>
    <p class="nota">Si otra persona abre la página, Google no le entrega tus datos.</p>
    <p class="nota"><a href="?demo#/inicio">Ver con datos de ejemplo</a></p>
  </article>`;
}

function vistaCargando() {
  return `<div class="cargando" role="status"><div class="esqueleto"></div><div class="esqueleto"></div><div class="esqueleto corto"></div><p>Leyendo tus hojas…</p></div>`;
}

// ------------------------------------------------------------------ detalle

function abrirDialogo(html) {
  const d = $('#detalle');
  $('#detalle-cuerpo').innerHTML = html;
  marcarNegativos($('#detalle-cuerpo'));
  if (!d.open) d.showModal();
}

function bloqueOrigen(p) {
  const o = p.origen;
  return `<section class="det-origen">
    <h3>Origen</h3>
    <p>${esc(o?.archivo || '')} › ${esc(o?.pestana || '')}${o?.a1 ? ` › ${esc(o.a1)}` : ''} ${enlaceOrigen(o, 'Abrir celda')}</p>
  </section>`;
}

function abrirPendiente(p) {
  if (!p) return;
  const hoyIdx = E.modelo.hoy.idx;
  const filas = [];
  if (p.accion) filas.push(['Acción', accionTag(p.accion)]);
  filas.push([p.tipo === 'agenda' ? 'DJ' : 'Nombre', `<b>${esc(p.titulo)}</b>`]);
  if (p.tipo === 'agenda') filas.push(['Ciudad', esc(p.subtitulo)]);
  if (p.tipo === 'deuda' && p.ciudades?.length) filas.push(['Ciudad', p.ciudades.map(etiquetaCiudad).join(' ')]);
  if (p.fechaIdx !== null && p.fechaIdx !== undefined) filas.push(['Fecha', `${esc(capitalizar(fechaLarga(p.fechaIdx)))} · ${esc(diasRelativos(p.fechaIdx - hoyIdx))}`]);
  else if (p.tipo === 'deuda' && diasDeuda(p, hoyIdx) !== null) filas.push(['Debe desde hace', textoDias(diasDeuda(p, hoyIdx))]);
  if (typeof p.monto === 'number') filas.push(['Importe', `<b>${esc(dinero(p.monto, p.decimales ?? 2))}</b> MXN${p.usdt ? ` (${esc(monto(p.usdt, 'USDT'))} × ${TIPO_CAMBIO_USDT})` : ''}`]);
  if (p.eventos) filas.push(['Eventos', String(p.eventos)]);
  if (p.op) filas.push(['Operación', `op. ${esc(p.op)}`]);
  if (p.horas?.length) filas.push(['Hora', esc(p.horas.join(' · '))]);
  if (p.banderas?.length) filas.push(['Requiere', p.banderas.map((b) => `<span class="chip u-aviso">${esc(b.texto)}</span>`).join(' ')]);
  let registros = '';
  if (p.tipo === 'deuda' && p.fechas?.length) {
    const usados = new Set();
    registros = `<section><h3>Eventos por liquidar</h3><ul class="det-lista">${p.fechas.map((f) => {
      const r = p.registros?.find((x) => x.idx === f.idx && !usados.has(x.fila));
      if (r) usados.add(r.fila);
      const unoSolo = p.pago && r && p.registros.length > 1
        ? ` <button class="boton-texto" data-accion="marcar-pagado" data-pendiente-pago="${esc(p.id)}" data-fila="${r.fila}">Marcar pagado</button>` : '';
      const editar = p.pago?.columnas?.pagoDj && r
        ? (esPrivado() ? '<div class="pago-dj nota">Muestra los importes (ojo) para editar el pago al DJ.</div>'
          : `<div class="pago-dj"><label>Pago al DJ <span class="campo-dinero">$<input type="number" inputmode="decimal" min="0" step="1" value="${typeof r.pagoDj === 'number' ? r.pagoDj : ''}" placeholder="Sin registro" data-fila-pagodj="${r.fila}" data-pendiente-pago="${esc(p.id)}"></span></label>
            <button class="boton boton-chico" data-accion="guardar-pagodj" data-pendiente-pago="${esc(p.id)}" data-fila="${r.fila}">Guardar</button></div>`)
        : '';
      // La vista previa solo se activa si la fórmula replicada da lo mismo que la hoja.
      const previa = r && typeof r.importe?.valor === 'number' && entregarCon(r, r.pagoDj) !== null
        && Math.abs(entregarCon(r, r.pagoDj) - r.importe.valor) < 0.01;
      return `<li>${esc(capitalizar(fechaLarga(f.idx)))}${r?.importe?.valor !== undefined && r?.importe?.valor !== null ? ` · Enviar <b class="enviar-valor" ${previa ? `data-enviar-fila="${r.fila}"` : ''}>${esc(dinero(r.importe.valor))}</b>` : ''}${r?.url ? ` <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">fila ${r.fila} ↗</a>` : ''}${unoSolo}${editar}</li>`;
    }).join('')}</ul></section>`;
  } else if (p.registros?.length) {
    registros = `<section><h3>Registro</h3><ul class="det-lista">${p.registros.map((r) => `<li>${r.rango ?? r.hora ? `${esc(r.rango ?? r.hora)} · ` : ''}${r.tipo ? `${esc(r.tipo)} · ` : ''}${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">fila ${r.fila} ↗</a>` : `fila ${r.fila}`}${r.banderas?.length ? ` · ${esc(r.banderas.map((b) => b.texto).join(', '))}` : ''}</li>`).join('')}</ul></section>`;
  }
  const mensaje = p.mensaje ? `<section class="det-mensaje">
      <div class="det-mensaje-cab"><h3>Mensaje para enviar</h3>
        <span class="det-mensaje-botones">${botonWhatsApp(p)}<button class="boton boton-primario boton-chico" data-accion="copiar-mensaje" data-pendiente-msg="${esc(p.id)}">Copiar</button></span></div>
      ${avisoTelefono(p)}
      <pre class="linea-hoja">${esc(ocultarImportes(p.mensaje))}</pre>
      <p class="nota">Mismo texto que arma tu hoja en AGENDA Y VENTAS (celda I3).</p>
    </section>` : '';
  const pagar = p.tipo === 'deuda' && p.pago && p.registros?.length
    ? `<button class="boton boton-exito boton-ancho" data-accion="marcar-pagado" data-pendiente-pago="${esc(p.id)}">${icono('pendientes')}${p.registros.length === 1 ? 'Marcar como pagado' : `Marcar los ${p.registros.length} eventos como pagados`}</button>` : '';
  abrirDialogo(`
    <header class="det-cab">${chipUrgencia(p, hoyIdx)}<h2>${esc(p.negocio)}</h2></header>
    <dl class="det-datos">${filas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
    ${pagar}
    ${mensaje}
    ${registros}
    ${bloqueOrigen(p)}`);
}

function abrirDia(idx) {
  const hoyIdx = E.modelo.hoy.idx;
  const dia = E.modelo.nayarsound.agenda?.dias.find((d) => d.idx === idx);
  if (!dia) return;
  const pendientes = [...E.pendientes.values()].filter((p) => p.grupo === `agenda|${idx}`);
  const porCiudad = new Map();
  for (const p of pendientes) {
    const k = p.sinDj ? 'Sin DJ asignado' : p.ciudad;
    if (!porCiudad.has(k)) porCiudad.set(k, []);
    porCiudad.get(k).push(p);
  }
  const bloques = [...porCiudad.entries()].map(([ciudad, lista]) => `
    <section><h3>${esc(ciudad)} · ${lista.reduce((s, p) => s + p.eventos, 0)}</h3>
    <ul class="det-lista">${lista.map((p) => `<li><button class="boton-texto" data-pendiente="${esc(p.id)}">${esc(p.sinDj ? p.subtitulo : p.titulo)}${p.eventos > 1 ? ` ×${p.eventos}` : ''}</button>
      ${p.horas?.length ? ` · ${esc(p.horas.join(' · '))}` : ''}${p.banderas?.length ? ` · <span class="mal">${esc(p.banderas.map((b) => b.texto).join(', '))}</span>` : ''}</li>`).join('')}</ul></section>`).join('');
  abrirDialogo(`
    <header class="det-cab">${chipUrgencia({ urgencia: idx <= hoyIdx ? 'hoy' : 'proximo', fechaIdx: idx }, hoyIdx)}<h2>${esc(capitalizar(fechaLarga(idx)))}</h2></header>
    <p><b>${dia.eventos ?? '—'}</b> ${dia.eventos === 1 ? 'evento' : 'eventos'} · <b>${pendientes.length}</b> ${pendientes.length === 1 ? 'pendiente' : 'pendientes'}${dia.realizados ? ` · <b>${dia.realizados}</b> ya ${dia.realizados === 1 ? 'realizado' : 'realizados'}` : ''}</p>
    ${bloques}
    ${bloqueOrigen({ origen: E.modelo.nayarsound.agenda.origen, linea: dia.lineas.join('\n') })}`);
}

arrancar();
