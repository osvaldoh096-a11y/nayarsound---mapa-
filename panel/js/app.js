// Interfaz del panel: Inicio, NayarSound, Préstamos e inversores, Finanzas y Fuentes.

import { leerPreferencias, guardarPreferencias } from './config.js?v=202611251849';
import { escribirCelda, leerRangos, escribirRango, actualizarHoja } from './api.js?v=202611251849';
import { prepararSesion, iniciarSesion, tokenVigente, olvidarToken, cerrarSesion } from './auth.js?v=202611251849';
import { leerTodo, datosDisponibles } from './carga.js?v=202611251849';
import { construirModelo, entregarCon } from './modelo.js?v=202611251849';
import {
  hoyCDMX, fechaLarga, fechaCorta, diasRelativos, momento, hora, nombreMes, MESES, normalizar, leerEtiquetaMes, ymdDesdeIdx, idxDesdeYMD,
} from './fechas.js?v=202611251849';
import { dinero, monto, esc, plural, capitalizar, fijarPrivado, esPrivado, ocultarImportes } from './formato.js?v=202611251849';
import { barras, lineas, activarTips, ocultarTip } from './graficas.js?v=202611251849';
import { ARCHIVOS, ORDEN_ARCHIVOS, TIPO_CAMBIO_USDT, CLIENTE_GOOGLE } from './fuentes.js?v=202611251849';
import { fuentesDemo } from './demo.js?v=202611251849';
import { PRESTAMOS_PROPIOS, cargarPrestamosPropios, crearCredito } from './sindicato.js?v=202611251849';
import { agendaDinero } from './agenda.js?v=202611251849';
import { HB, cargarHabitos, usarDemoHabitos, alternarHabito, htmlHabitos, moverSemana } from './habitos.js?v=202611251849';
import { leerCashflow } from './dashprestamos.js?v=202611251849';
import { icono } from './iconos.js?v=202611251849';
import { T, cargarTareas, usarDemo, agregarTarea, alternarTarea, borrarTarea, tareaPorClave, htmlTareas, ordenarTareas, activarArrastre } from './tareas.js?v=202611251849';

const VISTAS = {
  inicio: { titulo: 'Inicio', archivos: ORDEN_ARCHIVOS },
  nayarsound: { titulo: 'NayarSound', archivos: ['nayarsound', 'agenda'] },
  prestamos: { titulo: 'Panel financiero', archivos: ['prestamos'] },
  st: { titulo: 'ST · Sistemas y Tecnología', archivos: ['st'] },
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

// Al recargar la página: misma pestaña de Préstamos y mismo lugar de la pantalla
// (solo en esta pestaña del navegador; si no se puede guardar, no pasa nada).
const RECUERDO = 'panel-recuerdo';
function leerRecuerdo() {
  try { return JSON.parse(sessionStorage.getItem(RECUERDO) ?? '{}') ?? {}; } catch { return {}; }
}
function guardarRecuerdo(cambios) {
  try { sessionStorage.setItem(RECUERDO, JSON.stringify({ ...leerRecuerdo(), ...cambios })); } catch { /* sin almacenamiento */ }
}
E.tabPr = leerRecuerdo().tabPr;
let scrollPendiente = (() => { const r = leerRecuerdo(); return r.ruta && location.hash.startsWith(`#/${r.ruta}`) ? r.scroll : null; })();
addEventListener('pagehide', () => guardarRecuerdo({ scroll: window.scrollY, ruta: (location.hash.match(/^#\/(\w+)/) ?? [])[1] ?? 'inicio' }));

// ------------------------------------------------------------------ arranque

function rutaDesdeHash() {
  const m = location.hash.match(/^#\/(\w+)/);
  return m && VISTAS[m[1]] ? m[1] : 'inicio';
}

const MENU = [
  { ruta: 'inicio', texto: 'Inicio', corto: 'Inicio', icono: 'inicio' },
  { ruta: 'nayarsound', texto: 'NayarSound', corto: 'NayarSound', icono: 'musica' },
  { ruta: 'prestamos', texto: 'Préstamos e inversores', corto: 'Préstamos', icono: 'prestamos' },
  { ruta: 'st', texto: 'ST', corto: 'ST', icono: 'computadora' },
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
      const cerrados = new Set(E.pref.pfCerrados ?? []);
      if (e.target.open) { abiertos.add(e.target.dataset.pf); cerrados.delete(e.target.dataset.pf); } else { abiertos.delete(e.target.dataset.pf); cerrados.add(e.target.dataset.pf); }
      E.pref.pfAbiertos = [...abiertos];
      E.pref.pfCerrados = [...cerrados];
      guardarPreferencias(E.pref);
    }
    if (e.target.matches?.('details.tareas-hechas')) T.verHechas = e.target.open;
    if (e.target.id === 'deuda-desplegable') E.deudaAbierta = e.target.open;
    if (e.target.id === 'alerta-sindj') E.sinDjAbierta = e.target.open;
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
  for (const P of PRESTAMOS_PROPIOS) if (!P.S.demo) P.usarDemo(hoyCDMX().idx);
  if (!HB.demo) usarDemoHabitos(hoyCDMX().idx);
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
    const [fuentes] = await Promise.all([leerTodo(token, E.cfg.archivos, E.fuentes), cargarTareas(token), cargarPrestamosPropios(token), cargarHabitos(token)]);
    E.fuentes = fuentes;
    const errores = ORDEN_ARCHIVOS.map((k) => E.fuentes[k]).filter((f) => f.estado === 'error');
    if (errores.some((f) => f.error.tipo === 'sesion')) { olvidarToken(); E.sesion = 'expirada'; }
    if (!errores.length) E.ultimaCompleta = new Date();
    E.modelo = construirModelo(datosDisponibles(E.fuentes), hoyCDMX());
  } finally {
    E.cargando = false;
    pintar();
    // Tras recargar la página, vuelve al lugar donde estabas (una sola vez).
    if (scrollPendiente !== null && E.modelo) {
      const y = scrollPendiente;
      scrollPendiente = null;
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
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
  if (accion === 'habitos-semana') { moverSemana(Number(el.dataset.mover)); pintarHabitos(); return; }
  if (accion === 'habito') {
    const hoyH = hoyCDMX().idx;
    const diaH = el.dataset.hbDia ? Number(el.dataset.hbDia) : hoyH;
    if (diaH > hoyH) return;
    alternarHabito(Number(el.dataset.col), diaH, tokenParaEscribir, pintarHabitos);
    return;
  }
  if (accion === 'borrar-abono') {
    const P = prestamoPropio(el.dataset.prestamo);
    const a = P?.S.abonos.find((x) => String(x.fila) === el.dataset.fila);
    if (a && confirm(`¿Borrar el abono de ${dinero(a.monto)}${a.idx !== null ? ` del ${fechaLarga(a.idx)}` : ''}?`)) {
      P.borrarAbono(a.fila, tokenParaEscribir).then(() => pintar()).catch((error) => alert(error.message));
    }
    return;
  }
  if (accion === 'nuevo-credito') { abrirNuevoCredito(); return; }
  if (accion === 'confirmar-pago-int') { confirmarPagoInteres(el); return; }
  if (accion === 'ver-sin-interes') { abrirSinInteres(el.dataset.tipo); return; }
  if (accion === 'tab-pr') { E.tabPr = el.dataset.tab; guardarRecuerdo({ tabPr: E.tabPr }); pintar(); window.scrollTo(0, 0); return; }
  if (accion === 'borrar-tarea') {
    const t = tareaPorClave(el.dataset.tareaBorrar);
    if (t && confirm(`¿Borrar la tarea «${t.texto}»?`)) borrarTarea(t, tokenParaEscribir, pintarTareas);
  }
  if (accion === 'copiar-mensaje') copiarMensaje(el);
  if (accion === 'copiar-renov') copiarRenovacion(el);
  if (accion === 'marcar-pagado') marcarPagado(el);
  if (accion === 'guardar-pagodj') guardarPagoDj(el);
  if (accion === 'registrar-pagodj') registrarPagoDj(el);
  if (accion === 'religar-pagodj') religarPagoDj(el);
  if (accion === 'incluir-hoy') {
    E.incluirHoy = el.checked;
    const p = E.pendientes.get(el.dataset.pendienteMsg);
    if (p) pintarMensaje(p);
  }
  if (accion === 'tabla') { const t = $(`#${el.dataset.objetivo}`); if (t) t.hidden = !t.hidden; }
}

/**
 * Marca como pagados los eventos elegidos: escribe «SI» en PAGADO (columna C)
 * de la pestaña PAGOS DJ, en la fila de la llave de cada evento.
 */
async function marcarPagado(boton) {
  const p = E.pendientes.get(boton.dataset.pendientePago);
  if (!p?.pago || !p.registros?.length) return;
  const filas = boton.dataset.fila ? p.registros.filter((r) => String(r.fila) === boton.dataset.fila) : p.registros;
  const texto = filas.length === 1
    ? `¿Marcar como pagado el evento de ${p.titulo} del ${fechaLarga(filas[0].idx)}?`
    : `¿Marcar como pagados los ${filas.length} eventos de ${p.titulo}?`;
  if (!confirm(`${texto}\n\nSe escribirá «SI» en PAGADO de la pestaña PAGOS DJ.`)) return;
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
      await guardarCobroDj(token, p.pago, p.titulo, r, { pagado: 'SI' });
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
 * Registra o corrige el cobro de un evento en la pestaña PAGOS DJ, por su llave
 * (AGENDA Y VENTAS!W). Nunca escribe en AGENDA Y VENTAS (L y T son fórmulas).
 *   1. Vuelve a leer la llave en AGENDA Y VENTAS y comprueba que sigue siendo
 *      el mismo DJ y la misma fecha.
 *   2. Si la llave ya está en PAGOS DJ!A, actualiza B y/o C de esa fila; si no,
 *      la escribe en la primera fila vacía (A, B, C). Nunca crea dos filas con
 *      la misma llave.
 *   cambios: { pagoDj?: número, pagado?: 'SI' | 'NO' }
 */
async function guardarCobroDj(token, pago, dj, r, cambios) {
  const llave = String(r?.llave ?? '').trim();
  if (!llave) throw new Error(`El evento del ${fechaLarga(r.idx)} no tiene LLAVE en AGENDA Y VENTAS (columna W). No se escribió nada.`);
  const { archivo, columnas: c } = pago;
  const n = (letra) => [...letra].reduce((t, x) => t * 26 + x.charCodeAt(0) - 64, 0);
  const letras = [c.dj, c.fecha, c.llave].filter(Boolean);
  if (letras.length < 3) throw new Error('No encontré las columnas DJ, FECHA y LLAVE en AGENDA Y VENTAS.');
  const desde = letras.reduce((x, y) => (n(x) <= n(y) ? x : y));
  const hasta = letras.reduce((x, y) => (n(x) >= n(y) ? x : y));
  const [agenda, pagos] = await leerRangos(token, archivo, [`'AGENDA Y VENTAS'!${desde}13:${hasta}`, "'PAGOS DJ'!A4:C"]);
  const en = (fila, letra) => fila[n(letra) - n(desde)];
  const coinciden = (agenda ?? []).filter((f) => String(en(f, c.llave) ?? '').trim() === llave);
  if (coinciden.length !== 1) throw new Error(`La llave ${llave} ${coinciden.length ? 'está repetida' : 'ya no está'} en AGENDA Y VENTAS. Toca «Actualizar». No se escribió nada.`);
  const f = coinciden[0];
  if ((dj && normalizar(en(f, c.dj)) !== normalizar(dj)) || Math.floor(Number(en(f, c.fecha))) - 25569 !== r.idx) {
    throw new Error(`La llave ${llave} ahora es otro evento en tu hoja. Toca «Actualizar». No se escribió nada.`);
  }
  const filas = pagos ?? [];
  const iguales = filas.map((x, i) => (String(x?.[0] ?? '').trim() === llave ? i : -1)).filter((i) => i >= 0);
  if (iguales.length > 1) throw new Error(`La llave ${llave} está repetida en PAGOS DJ (filas ${iguales.map((i) => i + 4).join(', ')}). Deja solo una y vuelve a intentar.`);
  if (iguales.length === 1) {
    const i = iguales[0]; const fila = i + 4;
    const b = cambios.pagoDj !== undefined ? cambios.pagoDj : (filas[i][1] ?? '');
    const pc = cambios.pagado !== undefined ? cambios.pagado : (filas[i][2] || 'NO');
    await escribirRango(token, archivo, `'PAGOS DJ'!B${fila}:C${fila}`, [[b, pc]]);
    return fila;
  }
  let i = filas.findIndex((x) => !String(x?.[0] ?? '').trim());
  if (i < 0) i = filas.length;
  const fila = i + 4;
  await escribirRango(token, archivo, `'PAGOS DJ'!A${fila}:C${fila}`, [[llave, cambios.pagoDj ?? '', cambios.pagado ?? 'NO']]);
  return fila;
}

/** Registra o cambia el pago al DJ de un evento (PAGOS DJ, columna B). */
async function guardarPagoDj(boton) {
  const p = E.pendientes.get(boton.dataset.pendientePago);
  const r = registroDe(p, boton.dataset.fila);
  if (!p?.pago || !r) return;
  const entrada = document.querySelector(`input[data-fila-pagodj="${r.fila}"]`);
  const estado = document.querySelector(`[data-estado-pagodj="${r.fila}"]`);
  const texto = String(entrada?.value ?? '').trim().replace(/[$,\s]/g, '');
  const valor = Number(texto);
  if (!texto || !Number.isFinite(valor) || valor < 0) { alert('Escribe un importe válido, por ejemplo 1500.'); entrada?.focus(); return; }
  let token = tokenVigente();
  try {
    if (!token) token = await iniciarSesion();
  } catch (error) { alert(error.message); return; }
  boton.disabled = true;
  boton.textContent = 'Guardando…';
  if (estado) { estado.textContent = ''; estado.className = 'pagodj-estado'; }
  try {
    await guardarCobroDj(token, p.pago, p.titulo, r, { pagoDj: valor });
    // Se queda en esta ventana: marca guardado y pasa al siguiente evento.
    r.pagoDj = valor;
    boton.textContent = 'Guardado ✓';
    boton.classList.add('guardado');
    if (estado) { estado.textContent = `Guardado: ${dinero(valor, 0)}`; estado.className = 'pagodj-estado ok'; }
    const entradas = [...document.querySelectorAll('#detalle input[data-fila-pagodj]')];
    const siguiente = entradas[entradas.indexOf(entrada) + 1];
    if (siguiente) { siguiente.focus(); siguiente.select?.(); }
    refrescarDetalleDeuda(p.id);
    setTimeout(() => { boton.textContent = 'Guardar'; boton.classList.remove('guardado'); boton.disabled = false; }, 1800);
  } catch (error) {
    boton.textContent = 'Guardar';
    boton.disabled = false;
    if (estado) { estado.textContent = error.message; estado.className = 'pagodj-estado mal'; } else alert(error.message);
  }
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

/** Registro (deuda o evento de hoy) por número de fila. */
function registroDe(p, fila) {
  // En los eventos de la agenda, «registros» son filas de AMAL AGENDA: solo cuentan los de hoy.
  const lista = p?.tipo === 'agenda' ? (p?.hoy ?? []) : [...(p?.registros ?? []), ...(p?.hoy ?? [])];
  return lista.find((x) => String(x.fila) === String(fila)) ?? null;
}
/** Mensaje a enviar: con el evento de hoy (anticipado) si lo elegiste. */
function mensajeDe(p) {
  return E.incluirHoy !== false && p?.mensajeAnticipado ? p.mensajeAnticipado : p?.mensaje;
}

function botonWhatsApp(p) {
  const tel = telefonoDe(p.titulo);
  if (!tel?.numero) return '';
  const url = enlaceWhatsApp(tel.numero, mensajeDe(p));
  const externo = url.startsWith('https:') ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a class="boton boton-whatsapp boton-chico" href="${esc(url)}"${externo}>${icono('whatsapp')}WhatsApp</a>`;
}

function avisoTelefono(p) {
  if (p.tipo !== 'deuda' && p.tipo !== 'agenda') return '';
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
  const texto = mensajeDe(E.pendientes.get(boton.dataset.pendienteMsg));
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

const prestamoPropio = (clave) => PRESTAMOS_PROPIOS.find((P) => P.clave === clave) ?? PRESTAMOS_PROPIOS[0];

async function guardarAbono(form) {
  const P = prestamoPropio(form.dataset.prestamo);
  const boton = form.querySelector('button[type="submit"]');
  const datos = { monto: form.elements.monto.value, fecha: form.elements.fecha.value, nota: form.elements.nota?.value ?? '' };
  const valor = Number(String(datos.monto).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(valor) || valor <= 0) { alert('Escribe un monto válido, por ejemplo 10310.'); form.elements.monto.focus(); return; }
  if (!confirm(`¿Registrar abono de ${dinero(valor)} al ${P.titulo}?\n\nSe anotará en tu hoja «TO DO · Dashboard personal», pestaña ${P.pestana}.`)) return;
  boton.disabled = true; boton.textContent = 'Guardando…';
  P.S.guardando = true;
  try {
    await P.agregarAbono(datos, tokenParaEscribir);
    E.avisoTemporal = `Abono de ${dinero(valor)} registrado.`;
  } catch (error) { alert(error.message); }
  finally { P.S.guardando = false; pintar(); }
}

async function guardarCredito(form) {
  const el = form.elements;
  const datos = { nombre: el.nombre.value, monto: el.monto.value, meses: el.meses.value, pago: el.pago.value, total: el.total.value, tasa: el.tasa.value, fecha: el.fecha.value };
  const boton = form.querySelector('button[type="submit"]');
  if (!confirm(`¿Crear el crédito «${String(datos.nombre).trim()}»?\n\nSe agregará a tu hoja «TO DO · Dashboard personal» (pestaña nueva y su fila en CREDITOS) y se sumará a tu RESUMEN FINANCIERO.`)) return;
  boton.disabled = true; boton.textContent = 'Creando…';
  try {
    const r = await crearCredito(datos, tokenParaEscribir);
    E.avisoTemporal = `Crédito ${r.nombre} creado en tu hoja (pestaña ${r.pestana}).`;
    form.reset();
    if ($('#detalle').open) $('#detalle').close();
  } catch (error) { alert(error.message); }
  finally { boton.disabled = false; boton.textContent = 'Crear crédito'; pintar(); }
}

function alEnviar(evento) {
  const abono = evento.target.closest?.('form[data-form="abono"]');
  if (abono) { evento.preventDefault(); guardarAbono(abono); return; }
  const credito = evento.target.closest?.('form[data-form="credito"]');
  if (credito) { evento.preventDefault(); guardarCredito(credito); return; }
  const form = evento.target.closest?.('form[data-form="tarea"]');
  if (!form) return;
  evento.preventDefault();
  const entrada = form.elements.tarea;
  const texto = entrada.value;
  if (!texto.trim()) { entrada.focus(); return; }
  entrada.value = '';
  agregarTarea(texto, tokenParaEscribir, pintarTareas);
}

/** Repinta solo la tarjeta de hábitos. */
function pintarHabitos() {
  const caja = $('#habitos-caja');
  if (caja) caja.innerHTML = htmlHabitos(hoyCDMX().idx);
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

/**
 * Vuelve a leer tus hojas sin cerrar la ventana y actualiza solo el mensaje
 * «PAGOS PENDIENTES», el botón de WhatsApp y los «Enviar» de cada evento.
 */
let esperaDetalle = null;
/** Vuelve a pintar el mensaje y el enlace de WhatsApp del detalle abierto. */
function pintarMensaje(p) {
  const d = $('#detalle');
  const pre = d.querySelector('.det-mensaje pre');
  if (pre && mensajeDe(p)) pre.textContent = ocultarImportes(mensajeDe(p));
  const wa = d.querySelector('a.boton-whatsapp');
  const tel = telefonoDe(p.titulo);
  if (wa && tel?.numero) wa.href = enlaceWhatsApp(tel.numero, mensajeDe(p));
}

function refrescarDetalleDeuda(id) {
  clearTimeout(esperaDetalle);
  esperaDetalle = setTimeout(async () => {
    if (E.cargando) { refrescarDetalleDeuda(id); return; }
    await actualizar({ interactivo: false });
    const p = E.pendientes.get(id);
    const d = $('#detalle');
    if (!p || !d.open) return;
    const pre = d.querySelector('.det-mensaje pre');
    pintarMensaje(p);
    for (const r of [...(p.registros ?? []), ...(p.hoy ?? [])]) {
      const b = d.querySelector(`[data-enviar-fila="${r.fila}"]`);
      if (b && typeof r.importe?.valor === 'number' && document.activeElement?.dataset?.filaPagodj !== String(r.fila)) {
        b.textContent = dinero(r.importe.valor);
        b.classList.remove('cambio');
      }
    }
  }, 1200);
}

/** Enter en el pago al DJ guarda ese evento. */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.matches?.('input[data-fila-pagodj]')) return;
  e.preventDefault();
  const b = document.querySelector(`[data-accion="guardar-pagodj"][data-fila="${e.target.dataset.filaPagodj}"]`);
  if (b && !b.disabled) guardarPagoDj(b);
});

function alEscribir(evento) {
  const el = evento.target;
  if (el.matches?.('input[data-pago-int]')) { pintarRenovacion(el); return; }
  if (!el.matches?.('input[data-fila-pagodj]')) return;
  const p = E.pendientes.get(el.dataset.pendientePago);
  const r = registroDe(p, el.dataset.filaPagodj);
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

/**
 * Pendientes de pago que la hoja no avisa: interés a tus inversores y cuotas
 * de tus créditos (SINDICATO, BBVA, Mercado Pago…) de los próximos 7 días, más
 * lo atrasado. No repite lo que ya trae el recordatorio de 5 días de tu hoja.
 */
function agregarPagosPendientes(m) {
  if (!m || m._pagosAgregados || !m.prestamos?.disponible) return;
  m._pagosAgregados = true;
  const hoyIdx = m.hoy.idx;
  const ag = agendaDinero({ clientes: [], inversiones: m.prestamos.inversiones ?? [], propios: PRESTAMOS_PROPIOS }, hoyIdx, 7);
  // Lo que ya trae el recordatorio de tu hoja (mismo nombre, ±3 días) no se repite.
  const ya = m.pendientes.filter((p) => p.accion === 'PAGAR' && p.tipo !== 'liquidar' && p.fechaIdx !== null);
  const repetido = (it) => ya.some((p) => normalizar(p.titulo) === normalizar(it.nombre) && Math.abs(p.fechaIdx - it.idx) <= 3);
  for (const it of ag.items) {
    if (it.tipo !== 'pagar' || repetido(it)) continue;
    const credito = it.grupo === 'Crédito';
    const P = credito ? PRESTAMOS_PROPIOS.find((x) => normalizar(x.titulo.replace(/^Préstamo\s+/i, '')) === normalizar(it.nombre)) : null;
    const urgencia = it.vencido ? 'vencido' : it.idx <= hoyIdx ? 'hoy' : 'proximo';
    m.pendientes.push({
      id: `pago|${it.grupo}|${normalizar(it.nombre)}|${it.idx}|${it.detalle}`,
      negocio: 'Préstamos', tipo: 'pagar', accion: 'PAGAR', titulo: it.nombre,
      subtitulo: `${credito ? 'Pago de crédito' : 'Interés a inversor'} · ${it.detalle}`,
      fechaIdx: it.idx, urgencia, monto: it.montoMXN, moneda: 'MXN', usdt: it.divisa === 'USDT' ? it.monto : null, decimales: 0,
      registros: null, linea: '',
      origen: credito ? { archivo: 'TO DO · Dashboard personal', pestana: P?.pestana ?? it.nombre, url: P?.url ?? null }
        : { archivo: '💵REGISTRO DE PRESTAMOS', pestana: 'REGISTRO DE INVERSORES', url: m.prestamos.inversionesUrl ?? null },
    });
    m.conteo[urgencia] = (m.conteo[urgencia] ?? 0) + 1;
  }
}

function pintar() {
  agregarPagosPendientes(E.modelo);
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
  const contenido = { inicio: vistaInicio, nayarsound: vistaNayarsound, prestamos: vistaPrestamos, st: vistaST, finanzas: vistaFinanzas }[E.ruta](E.modelo);
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
/** Eventos de la deuda sin pago al DJ anotado (columna DJ de AGENDA Y VENTAS vacía). */
function faltaPagoDj(p) {
  return (p.registros ?? []).filter((r) => typeof r.pagoDj !== 'number').length;
}

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

// Colores de cada ciudad, los mismos de la columna CIUDAD en AGENDA Y VENTAS.
const COLOR_HEX_CIUDAD = { GUADALAJARA: '#6A0DAD', TEPIC: '#1E5EFF', LEON: '#FF9900', MONTERREY: '#FF0000' };
const COLOR_POR_CIUDAD = { GUADALAJARA: 'violeta', LEON: 'naranja', TEPIC: 'azul', MONTERREY: 'rojo-ciudad' };
/** Nombre de la ciudad con su color de fondo, como en tu hoja. */
function chipCiudad(ciudad, extra = '') {
  const n = normalizar(ciudad);
  const color = COLOR_HEX_CIUDAD[n] ?? '#6B7280';
  return `<span class="chip-ciudad" style="--cc:${color}">${esc(nombreBonito(ciudad) || 'Sin ciudad')}${extra}</span>`;
}
function etiquetaCiudad(ciudad) {
  return `<span class="ciudad-tag">${chipCiudad(ciudad)}</span>`;
}

const ICONO_TIPO = { agenda: 'calendario', deuda: 'dinero', cobrar: 'cobrar', pagar: 'pagar', liquidar: 'pagar' };

/** Aviso «evento en transcurso / evento hoy · espera a que termine para cobrar». */
function textoEsperar(p) {
  const x = p?.esperar;
  if (!x) return '';
  const hora = x.rango ? ` (${x.rango})` : '';
  if (x.estado === 'en-curso') return `Evento en transcurso${hora} · espera a que termine para cobrar`;
  if (x.estado === 'hoy') return `Tiene evento hoy${hora} · espera a que termine para cobrar`;
  return `Su evento de hoy ya terminó${hora} · espera a que se registre para cobrar todo junto`;
}
function avisoEsperar(p) {
  return p?.esperar ? `<span class="fp-esperar ${p.esperar.estado}">${p.esperar.estado === 'en-curso' ? '● ' : '⏳ '}${esc(textoEsperar(p))}</span>` : '';
}

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
    <span class="fp-texto"><span class="fp-titulo">${esc(p.titulo)}${sinCiudad ? '' : (p.ciudades ?? []).map(etiquetaCiudad).join('')}${p.tipo === 'deuda' ? '' : ` ${accionTag(p.accion)}`}</span><small>${esc(detalle)}</small>${p.tipo === 'deuda' && faltaPagoDj(p) ? `<span class="fp-falta">⚠ Falta anotar pago al DJ${faltaPagoDj(p) > 1 ? ` (${faltaPagoDj(p)} eventos)` : ''}</span>` : ''}${p.tipo === 'deuda' ? avisoEsperar(p) : ''}</span>
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

/**
 * Lo que pagas cada mes: interés a tus inversores (personas activas de
 * REGISTRO DE INVERSORES) + la cuota mensual de cada crédito institucional.
 * Es el mismo dato que «PAGO MENSUAL A INVERSORES» del DASHBOARD de tu hoja.
 */
function pagosMensuales(m) {
  const personas = (m?.prestamos?.inversiones ?? []).reduce((t, x) => t + (x.pagoMes ? (x.divisa === 'USDT' ? x.pagoMes * TIPO_CAMBIO_USDT : x.pagoMes) : 0), 0);
  const instituciones = PRESTAMOS_PROPIOS.map((P) => ({ nombre: P.titulo.replace(/^Préstamo\s+/i, ''), mensual: P.resumen(m.hoy.idx)?.mensual ?? null }))
    .filter((x) => typeof x.mensual === 'number' && x.mensual > 0);
  const inst = instituciones.reduce((t, x) => t + x.mensual, 0);
  return { personas, instituciones, inst, total: personas + inst };
}

function tarjetaPagosMes(m) {
  if (!m?.prestamos?.disponible) return '';
  const pm = pagosMensuales(m);
  if (!pm.total) return '';
  const fila = (etq, v, extra = '') => `<div class="pm-fila ${extra}"><span>${etq}</span><b>${esc(dinero(v, 0))}</b></div>`;
  return `<article class="tarjeta bloque-pagos-mes">
      <div class="tarjeta-cab"><h2 class="etq-cab">${icono('pagar')}Pagas al mes</h2><a class="enlace-vista" href="#/prestamos">Ver ${icono('flecha')}</a></div>
      <div class="pm-total"><div class="cifra">${esc(dinero(pm.total, 0))}</div><div class="sub">inversores + institucionales</div></div>
      <div class="pm-lista">
        ${fila('Interés a inversores', pm.personas)}
        ${pm.instituciones.map((x) => fila(esc(x.nombre), x.mensual, 'inst')).join('')}
      </div>
    </article>`;
}

/** Ganancia, gastos y sobrante en una fila, como los eventos de hoy y mañana. */
/** «Gastos registrados hasta …»: el último día con un gasto anotado. */
function lineaUltimoGasto(fi, hoyIdx) {
  if (!fi) return '';
  const u = fi.ultimoGasto;
  if (u === null || u === undefined) return '<p class="ultimo-gasto mal">Sin fecha en los gastos registrados.</p>';
  const n = hoyIdx - u;
  const clase = n <= 1 ? 'ok' : n <= 3 ? 'medio' : 'mal';
  const hace = n === 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`;
  return `<p class="ultimo-gasto ${clase}"><i class="punto" aria-hidden="true"></i>Gastos registrados hasta el <b>${esc(fechaCorta(u))}</b> · ${hace}</p>`;
}

function resumenFinanzas(mes) {
  if (!mes) {
    const f = E.fuentes.gastos;
    return `<p class="sin-dato">No hay datos de finanzas${f?.error ? `: ${esc(f.error.mensaje)}` : '.'}</p>`;
  }
  const negativo = typeof mes.sobrante.valor === 'number' && mes.sobrante.valor < 0;
  const dias = diasDelPeriodo(mes);
  const alDia = (celda) => (dias && typeof celda?.valor === 'number' ? `<div class="fin-diario">${esc(dinero(celda.valor / dias, 0))} al día</div>` : '');
  const dato = (clase, celda, etiqueta, nota = '') => `
    <div class="fin-dato ${clase}"><div class="cifra">${valorCelda(celda)}</div><div class="sub">${etiqueta}</div>${alDia(celda)}${nota ? `<div class="fin-nota">${nota}</div>` : ''}</div>`;
  return `<div class="fin-fila">
    ${dato('fin-ganancia', mes.ganancia, mes.esAnio ? `ganancia ${mes.y}` : 'ganancia del mes')}
    ${dato('fin-gasto', mes.gastos, 'gastos personales', mes.registrosGastos === 0 ? 'Sin gastos registrados' : '')}
    ${dato(`fin-sobrante ${negativo ? 'negativo' : ''}`, mes.sobrante, mes.esAnio ? `sobrante ${mes.y}` : 'sobrante del mes')}
  </div>`;
}

/**
 * Promedio por día del periodo: mes en curso ÷ días transcurridos (hoy
 * incluido); mes pasado ÷ días del mes; año ÷ días transcurridos o del año.
 */
function diasDelPeriodo(mes) {
  const hoy = E.modelo?.hoy;
  if (!hoy || !mes?.y) return null;
  if (mes.esAnio) {
    const ini = idxDesdeYMD(mes.y, 1, 1);
    if (mes.y === hoy.y) return hoy.idx - ini + 1;
    return mes.y < hoy.y ? idxDesdeYMD(mes.y + 1, 1, 1) - ini : null;
  }
  if (!mes.m) return null;
  if (mes.y === hoy.y && mes.m === hoy.m) return hoy.d;
  const ini = idxDesdeYMD(mes.y, mes.m, 1);
  const fin = idxDesdeYMD(mes.m === 12 ? mes.y + 1 : mes.y, mes.m === 12 ? 1 : mes.m + 1, 1);
  return ini < hoy.idx ? fin - ini : null;
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

/** Alerta urgente: eventos de AGENDA Y VENTAS sin DJ (vacío o «BUSCAR»). */
function alertaSinDj(m) {
  const lista = m?.nayarsound?.eventosSinDj ?? [];
  if (!lista.length) return '';
  const total = lista.reduce((t, e) => t + (e.total ?? 0), 0);
  const hoyIdx = m.hoy.idx;
  const cuando = (e) => { const n = e.idx - hoyIdx; return n === 0 ? 'hoy' : n === 1 ? 'mañana' : n > 1 ? `en ${n} días` : `hace ${-n} días`; };
  return `<details class="alerta-sindj" ${E.sinDjAbierta ? 'open' : ''} id="alerta-sindj">
    <summary>
      <span class="as-icono" aria-hidden="true">🚨</span>
      <span class="as-texto"><b>${plural(lista.length, 'evento por cobrar sin DJ', 'eventos por cobrar sin DJ')}</b>
        <small>${esc(dinero(total, 0))} que no puedes cobrar · anota el DJ que lo hizo</small></span>
      ${icono('flecha', 'desp-flecha')}
    </summary>
    <ul class="as-lista">${lista.map((e) => `<li class="${e.pasado ? 'pasado' : e.idx - hoyIdx <= 7 ? 'pronto' : ''}">
      <span class="as-fecha"><b>${esc(capitalizar(fechaCorta(e.idx)))}</b><small>${esc(cuando(e))}</small></span>
      <span class="as-det">${chipCiudad(e.ciudad || 'Sin ciudad')}<small>${esc(capitalizar((e.tipo || 'Sin tipo').toLowerCase()))}${e.dj ? ' · «BUSCAR»' : ' · DJ vacío'}${e.op ? ` · OP ${esc(String(e.op))}` : ''}</small></span>
      <b class="as-monto">${e.total === null ? '—' : esc(dinero(e.total, 0))}</b>
      ${e.url ? `<a class="as-enlace" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Anotar DJ ↗</a>` : ''}
    </li>`).join('')}</ul>
  </details>`;
}

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
  ${alertaSinDj(m)}
  <section class="inicio-arriba">
    <article class="tarjeta tareas" id="tareas-caja">${htmlTareas()}</article>
    <article class="tarjeta habitos" id="habitos-caja">${htmlHabitos(m.hoy.idx)}</article>
  </section>
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
    <article class="tarjeta bloque-finanzas">
      <div class="tarjeta-cab"><h2 class="etq-cab">${icono('finanzas')}Finanzas</h2>${sel}</div>
      ${resumenFinanzas(mes)}
      ${lineaUltimoGasto(fi, m.hoy.idx)}
    </article>
    ${tarjetaPagosMes(m)}
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
    // Suma de todas las ciudades.
    const todas = [...grupos.values()].flat();
    if (todas.length) {
      const totalTodas = todas.reduce((t, p) => t + (p.monto ?? 0), 0);
      const eventosTodas = todas.reduce((t, p) => t + (p.eventos ?? 0), 0);
      filasNs.push({ urg: 'sin-fecha', fecha: null, html: `<div class="grupo-ciudad grupo-total"><span class="gt-titulo">Total de todas las ciudades</span><span>${plural(todas.length, 'persona', 'personas')} · ${plural(eventosTodas, 'evento', 'eventos')}</span><b class="monto-cobrar">${esc(dinero(totalTodas, 0))}</b></div>` });
    }
    for (const [ciudad, lista] of ordenados) {
      const total = lista.reduce((t, p) => t + (p.monto ?? 0), 0);
      filasNs.push({ urg: 'sin-fecha', fecha: null, html: `<div class="grupo-ciudad">${etiquetaCiudad(ciudad)}<span>${plural(lista.length, 'persona', 'personas')}</span><b class="monto-cobrar">${esc(dinero(total, 0))}</b></div>` });
      // Primero a quienes les falta anotar el pago al DJ; luego los que más días deben.
      const orden = [...lista].sort((a, z) => (!!a.esperar) - (!!z.esperar) || (faltaPagoDj(z) > 0) - (faltaPagoDj(a) > 0)
        || (diasDeuda(z, hoyIdx) ?? -1) - (diasDeuda(a, hoyIdx) ?? -1) || (z.monto ?? 0) - (a.monto ?? 0));
      for (const p of orden) filasNs.push({ urg: 'sin-fecha', fecha: null, html: filaPendiente(p, hoyIdx, { sinCiudad: true }) });
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
  const sinInteres = m.prestamos.sinInteres ?? [];
  const filasPr = pr.map((p) => ({ urg: p.urgencia, fecha: p.fechaIdx, html: filaPendiente(p, hoyIdx) }));
  if (!E.filtro || E.filtro === 'aviso') {
    if (sinInteres.length) filasPr.push({ urg: 'aviso', fecha: null, html: filaInteres(sinInteres, 'cobrar') });
    const yoDebo = m.prestamos.sinInteresInversores ?? [];
    if (yoDebo.length) filasPr.push({ urg: 'aviso', fecha: null, html: filaInteres(yoDebo, 'pagar') });
  }
  bloques.push({ nombre: 'Préstamos e inversores', ruta: 'prestamos', disponible: m.prestamos.disponible, filas: filasPr });

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
  ${alertaSinDj(m)}
  <div class="pf">${operacionNs(ns.operacion, m)}</div>
  <div class="rejilla-ns">
    ${tarjetaAgenda(ns.agenda, m.hoy.idx)}
    ${tarjetaDeuda(ns.deuda)}
  </div>
  ${tarjetaPagosDj(ns.pagosDj)}
  ${tarjetaControles(ns.controles)}
  ${listaAvisos(ns.avisos, 'Revisión de la lectura')}`;
}

const nombreMesCorto = (x) => `${MES_CORTO[x.m - 1]}${x.m === 1 ? ` ${String(x.y).slice(2)}` : ''}`;
const nombreMesLargo = (x) => capitalizar(MESES[x.m - 1].toLowerCase());
const cuenta = (n) => Number(n ?? 0).toLocaleString('es-MX');

/** Cambio contra el mes anterior: «▲ 12%» en verde / «▼ 8%» en rojo. */
function cambio(actual, antes) {
  if (!antes) return '';
  const p = (actual - antes) / Math.abs(antes);
  if (!Number.isFinite(p)) return '';
  const sube = p >= 0;
  return `<span class="ns-cambio ${sube ? 'sube' : 'baja'}">${sube ? '▲' : '▼'} ${Math.abs(Math.round(p * 100))}%</span>`;
}

/** Columnas por mes: realizados (sólido) + agendados (claro); el mes actual resaltado. */
function columnasMeses(serie, kActual) {
  const max = Math.max(1, ...serie.map((x) => x.eventos));
  return `<div class="ns-cols">${serie.map((x) => {
    const tip = `${nombreMesLargo(x)} ${x.y}: ${x.eventos} eventos (${x.realizados} realizados, ${x.agendados} por realizar) · generado ${dinero(x.generado, 0)}${x.conGanancia ? ` · tu ganancia ${dinero(x.gananciaPersonal, 0)}` : ''}`;
    return `<div class="ns-col ${x.k === kActual ? 'actual' : ''} ${x.k > kActual ? 'futuro' : ''}" data-tip="${esc(tip)}" tabindex="0">
      <span class="ns-col-num">${x.eventos || ''}</span>
      <div class="ns-col-pila">
        <i class="ns-ag" style="height:${(x.agendados / max) * 100}%"></i><i class="ns-re" style="height:${(x.realizados / max) * 100}%"></i>
      </div>
      <span class="ns-col-etq">${esc(nombreMesCorto(x))}</span>
    </div>`;
  }).join('')}</div>
  <div class="leyenda"><span><i class="muestra ns-re"></i>Realizados</span><span><i class="muestra ns-ag"></i>Por realizar</span></div>`;
}

/** «ENTREGAR A OSVALDO» sumado por semana (lunes a domingo), solo eventos realizados. */
function tarjetaEntregaSemanal(es) {
  if (!es?.semanas?.length) return '';
  const rango = (x) => {
    const i = ymdDesdeIdx(x.ini); const f = ymdDesdeIdx(x.fin);
    return i.m === f.m ? `${i.d} – ${f.d} ${MES_CORTO[f.m - 1]}` : `${i.d} ${MES_CORTO[i.m - 1]} – ${f.d} ${MES_CORTO[f.m - 1]}`;
  };
  return `<article class="tarjeta ns-entrega">
    <header class="pf-cab"><h2>Entregar a Osvaldo</h2><span class="pf-cab-der">Por semana</span></header>
    ${es.semanas.slice(-4).reverse().map((x) => `<div class="pm-fila"><span>${esc(rango(x))}${x.actual ? ' <small class="texto-tenue">en curso</small>' : ''}${x.sinDj ? ` <small class="texto-rojo">${x.sinDj} sin DJ</small>` : ''}</span><b>${esc(dinero(x.entregar, 0))}</b></div>`).join('')}
  </article>`;
}

function operacionNs(op, m) {
  if (!op) return '';
  const { anterior: a, actual: c, proximo: p } = op;
  const kpi = (color, etiqueta, valor, sub) => `<article class="tarjeta pf-kpi pf-c-${color}">
    <div class="pf-kpi-etq"><i class="pf-punto" aria-hidden="true"></i>${etiqueta}</div><div class="pf-kpi-valor">${valor}</div>
    <div class="pf-kpi-sub">${sub}</div></article>`;
  const promedio = c.realizados ? c.gananciaPersonal / c.realizados : null;
  const kpis = `<section class="pf-kpis ns-kpis">
    ${kpi('azul', `Eventos de ${MESES[c.m - 1].toLowerCase()}`, esc(cuenta(c.eventos)), `${cuenta(c.realizados)} realizados · ${cuenta(c.agendados)} por realizar ${cambio(c.eventos, a.eventos)}`)}
    ${kpi('verde', 'Tu ganancia del mes', cifraDoble(c.gananciaPersonal), promedio !== null ? `${din(promedio, 0)} por evento realizado` : 'Aún sin eventos realizados')}
    ${kpi('ambar', `Agendados ${MESES[p.m - 1].toLowerCase()}`, esc(cuenta(p.eventos)), `${din(p.generado, 0)} por cobrar en eventos`)}
  </section>`;

  // Gráficas
  const kActual = c.k;
  const eventosMes = `<article class="tarjeta">
    <header class="pf-cab"><h2>Eventos por mes</h2><span class="pf-cab-der">Últimos 12 meses y los próximos 2</span></header>
    ${columnasMeses(op.serie, kActual)}
  </article>`;
  const fmtEventos = (v) => `${cuenta(v)} ${v === 1 ? 'evento' : 'eventos'}`;
  const desglose = (titulo, lista, nota = '', { tal = false } = {}) => `<article class="tarjeta">
    <header class="pf-cab"><h2>${titulo}</h2><span class="pf-cab-der">${esc(nombreMesLargo(c))}</span></header>
    ${barras(lista.slice(0, 8).map((x) => ({ nombre: tal ? x.nombre : nombreBonito(x.nombre), valor: x.eventos, detalle: dinero(x.generado, 0) })), { formato: fmtEventos, vacio: 'Sin eventos este mes.' })}
    ${nota}
  </article>`;

  return `${kpis}
    ${tarjetaEntregaSemanal(op.entregaSemanal)}
    <section class="ns-fila-graf">${eventosMes}</section>
    <section class="ns-fila-2">${desglose('Por ciudad', op.ciudades)}${desglose('Tipo de evento', op.tipos)}</section>`;
}

/**
 * PAGOS DJ: eventos realizados sin pago registrado (PAGOS DJ!J) y cobros que
 * se desligaron (❌: Amal cambió la fecha o el teléfono) para volver a ligarlos.
 */
function tarjetaPagosDj(pd) {
  if (!pd?.disponible) return pd?.error ? `<article class="tarjeta"><p class="sin-dato">${esc(pd.error)}</p></article>` : '';
  const sinLigar = pd.sinLigar ?? []; const pend = pd.pendientes ?? []; const rep = pd.repetidos ?? [];
  const cab = `<header class="tarjeta-cab"><h2>Pagos DJ</h2>${pd.url ? `<a class="origen" href="${esc(pd.url)}" target="_blank" rel="noopener noreferrer">PAGOS DJ ↗</a>` : ''}</header>`;
  if (!sinLigar.length && !pend.length && !rep.length) return `<article class="tarjeta pagos-dj">${cab}<p class="vacio">✅ Todo registrado y ligado.</p></article>`;
  const evento = (e) => `${e.idx !== null && e.idx !== undefined ? esc(capitalizar(fechaCorta(e.idx))) : ''}${e.ciudad ? ` · ${esc(capitalizar(e.ciudad.toLowerCase()))}` : ''}${e.dj ? ` · <b>${esc(e.dj)}</b>` : ''}${e.total !== null && e.total !== undefined ? ` · ${esc(dinero(e.total, 0))}` : ''}`;
  const puede = !!pd.destino && !esPrivado();
  const bloqueLigar = sinLigar.length ? `<section class="pdj-sec mal"><h3>❌ Cobros desligados <span class="pdj-n">${sinLigar.length}</span></h3>
    <p class="nota">Amal cambió la fecha o el teléfono de estos eventos. Elige el evento correcto para volver a ligar el cobro.</p>
    <ul class="pdj-lista">${sinLigar.map((x) => `<li>
      <div><code>${esc(x.llave)}</code> · pago DJ ${typeof x.pagoDj === 'number' ? esc(dinero(x.pagoDj, 0)) : '—'} · pagado ${esc(x.pagado || 'NO')} <small>fila ${x.fila}</small></div>
      ${puede ? `<div class="pdj-accion"><select data-religar-de="${x.fila}" aria-label="Evento correcto para ${esc(x.llave)}"><option value="">Elige el evento…</option>${x.candidatos.map((c) => `<option value="${esc(c.llave)}">${esc(c.llave)} — ${esc([c.idx !== null ? fechaCorta(c.idx) : '', capitalizar((c.ciudad || '').toLowerCase()), c.dj].filter(Boolean).join(' · '))}</option>`).join('')}</select>
        <button class="boton boton-chico" data-accion="religar-pagodj" data-fila="${x.fila}" data-llave="${esc(x.llave)}">Ligar</button></div>` : ''}
    </li>`).join('')}</ul></section>` : '';
  const bloqueRep = rep.length ? `<section class="pdj-sec mal"><h3>⚠️ Llaves repetidas <span class="pdj-n">${rep.length}</span></h3>
    <p class="nota">Deja una sola fila por evento en PAGOS DJ; mientras tanto el panel no escribe en esas llaves.</p>
    <ul class="pdj-lista">${rep.map((x) => `<li><code>${esc(x.llave)}</code> <small>fila ${x.fila}</small></li>`).join('')}</ul></section>` : '';
  const bloquePend = pend.length ? `<section class="pdj-sec"><h3>Realizados sin pago registrado <span class="pdj-n">${pend.length}</span></h3>
    <ul class="pdj-lista">${pend.map((e) => `<li><div>${evento(e)} <small><code>${esc(e.llave)}</code></small></div>
      ${puede && e.dj ? `<div class="pdj-accion"><label>Pago al DJ <span class="campo-dinero">$<input type="number" inputmode="decimal" min="0" step="1" placeholder="Importe" data-registrar-llave="${esc(e.llave)}"></span></label>
        <button class="boton boton-chico" data-accion="registrar-pagodj" data-llave="${esc(e.llave)}">Guardar</button></div>` : ''}</li>`).join('')}</ul></section>` : '';
  return `<article class="tarjeta pagos-dj">${cab}${bloqueLigar}${bloqueRep}${bloquePend}</article>`;
}

/** Registra el pago al DJ de un evento realizado que no tenía fila en PAGOS DJ. */
async function registrarPagoDj(boton) {
  const pd = E.modelo?.nayarsound?.pagosDj;
  const e = pd?.pendientes?.find((x) => x.llave === boton.dataset.llave);
  if (!pd?.destino || !e) return;
  const entrada = document.querySelector(`input[data-registrar-llave="${CSS.escape(e.llave)}"]`);
  const texto = String(entrada?.value ?? '').trim().replace(/[$,\s]/g, '');
  const valor = Number(texto);
  if (!texto || !Number.isFinite(valor) || valor < 0) { alert('Escribe un importe válido, por ejemplo 1500.'); entrada?.focus(); return; }
  let token = tokenVigente();
  try { if (!token) token = await iniciarSesion(); } catch (error) { alert(error.message); return; }
  boton.disabled = true; boton.textContent = 'Guardando…';
  try {
    await guardarCobroDj(token, pd.destino, e.dj, { llave: e.llave, idx: e.idx }, { pagoDj: valor, pagado: 'NO' });
    E.avisoTemporal = `Listo: pago al DJ de ${e.dj} (${fechaCorta(e.idx)}) registrado en PAGOS DJ.`;
  } catch (error) { alert(error.message); }
  boton.disabled = false; boton.textContent = 'Guardar';
  await actualizar({ interactivo: true });
}

/**
 * Vuelve a ligar un cobro desligado (❌): cambia PAGOS DJ!A de esa fila por la
 * llave nueva. Antes comprueba que la fila sigue teniendo la llave vieja, que
 * la nueva existe una sola vez en AGENDA Y VENTAS y que no está ya en PAGOS DJ.
 */
async function religarPagoDj(boton) {
  const pd = E.modelo?.nayarsound?.pagosDj;
  if (!pd?.destino) return;
  const fila = Number(boton.dataset.fila); const vieja = boton.dataset.llave;
  const nueva = document.querySelector(`select[data-religar-de="${fila}"]`)?.value ?? '';
  if (!nueva) { alert('Elige primero el evento correcto.'); return; }
  if (!confirm(`¿Ligar el cobro de la fila ${fila} al evento ${nueva}?\n\nSe cambiará la columna A de PAGOS DJ (antes: ${vieja}).`)) return;
  let token = tokenVigente();
  try { if (!token) token = await iniciarSesion(); } catch (error) { alert(error.message); return; }
  boton.disabled = true; boton.textContent = 'Guardando…';
  try {
    const { archivo, columnas: c } = pd.destino;
    const [actual, todas, llaves] = await leerRangos(token, archivo, [`'PAGOS DJ'!A${fila}`, "'PAGOS DJ'!A4:A", `'AGENDA Y VENTAS'!${c.llave}13:${c.llave}`]);
    if (String(actual?.[0]?.[0] ?? '').trim() !== vieja) throw new Error(`La fila ${fila} de PAGOS DJ cambió (ya no dice ${vieja}). Toca «Actualizar». No se escribió nada.`);
    if ((todas ?? []).some((x) => String(x?.[0] ?? '').trim() === nueva)) throw new Error(`El evento ${nueva} ya tiene su fila en PAGOS DJ. No se escribió nada.`);
    if ((llaves ?? []).filter((x) => String(x?.[0] ?? '').trim() === nueva).length !== 1) throw new Error(`La llave ${nueva} ya no está (o está repetida) en AGENDA Y VENTAS. Toca «Actualizar».`);
    await escribirRango(token, archivo, `'PAGOS DJ'!A${fila}`, [[nueva]]);
    E.avisoTemporal = `Listo: el cobro de la fila ${fila} quedó ligado a ${nueva}.`;
  } catch (error) { alert(error.message); }
  boton.disabled = false; boton.textContent = 'Ligar';
  await actualizar({ interactivo: true });
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
        <div class="ciudad-cab">${chipCiudad(c.ciudad)}
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
  // Agrupado por ciudad (la que más debe primero); dentro, quien debe hace más días primero.
  const hoyIdx = E.modelo.hoy.idx;
  const grupos = new Map();
  for (const p of deuda.personas) {
    const ciudad = E.pendientes.get(`deuda|${normalizar(p.nombre)}`)?.ciudades?.[0] ?? 'Sin ciudad';
    if (!grupos.has(ciudad)) grupos.set(ciudad, []);
    grupos.get(ciudad).push(p);
  }
  const suma = (l) => l.reduce((t, p) => t + (p.monto ?? 0), 0);
  const fila = (p) => {
    const id = `deuda|${normalizar(p.nombre)}`;
    return `<tr data-pendiente="${esc(id)}" tabindex="0">
      <td><b>${esc(p.nombre)}</b>${avisoEsperar(E.pendientes.get(id))}</td>
      <td class="num">${p.eventos}</td>
      <td class="num">${(() => { const n = diasDeuda(p, E.modelo.hoy.idx); return n === null ? '—' : `<span class="${n > 3 ? 'texto-rojo' : ''}">${esc(textoDias(n))}</span>`; })()}</td>
      <td>${p.fechas.map((f) => `<span class="fecha-mini">${esc(fechaCorta(f.idx))}</span>`).join(' ')}</td>
      <td class="num">${esc(dinero(p.monto, 0))}</td></tr>`;
  };
  const filas = [...grupos.entries()].sort((x, z) => suma(z[1]) - suma(x[1])).map(([ciudad, lista]) =>
    `<tr class="fila-ciudad"><td colspan="5"><span class="fc-in">${etiquetaCiudad(ciudad)}<b class="monto-cobrar">${esc(dinero(suma(lista), 0))}</b><span class="fc-n">${plural(lista.length, 'persona', 'personas')}</span></span></td></tr>`
    + [...lista].sort((x, z) => (diasDeuda(z, hoyIdx) ?? -1) - (diasDeuda(x, hoyIdx) ?? -1) || (z.monto ?? 0) - (x.monto ?? 0)).map(fila).join('')).join('');
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
      <span class="lb-ciudad">${chipCiudad(e.ciudad)}${e.tipo ? `<small>${esc(capitalizar(e.tipo.toLowerCase()))}</small>` : ''}</span>
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
const ACENTOS = { leon: 'león', interes: 'interés', proyeccion: 'proyección', dia: 'día', prestamos: 'préstamos', prestamo: 'préstamo', utilidad: 'utilidad' };
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

const PESTANAS_PR = [['resumen', 'Resumen'], ['agenda', 'Agenda'], ['prestamos', 'Institucionales'], ['inversores', 'Inversores'], ['historial', 'Historial']];

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
function seccionPF(id, color, titulo, resumen, cuerpo, { abiertaPorDefecto = false } = {}) {
  const abierta = abiertaPorDefecto ? !(E.pref.pfCerrados ?? []).includes(id) : (E.pref.pfAbiertos ?? []).includes(id);
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
  const cuerpo = { resumen: prResumen, agenda: prAgenda, prestamos: prPrestamos, inversores: prInversores, historial: prHistorial }[E.tabPr](m, pr, d);
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
    ${kpi('rojo', 'Pago mensual a inversores', v('PAGO MENSUAL A INVERSORES'), (() => { const pm = pagosMensuales(m); return pm.inst ? `Inversores ${esc(dinero(pm.personas, 0))} + institucionales ${esc(dinero(pm.inst, 0))}` : 'Lo que pagas cada mes'; })())}
  </section>`;

  // Resumen financiero agrupado por colores, como en tu hoja
  const fila = (k, { pct = false, resaltar = false } = {}) => (r[k] ? `<div class="pf-dato ${resaltar ? 'resaltar' : ''}"><span>${esc(nombreBonito(r[k].etiqueta))}</span><b>${pct || r[k].esPct ? esc(pctTxt(r[k].valor, 2)) : din(r[k].valor)}</b></div>` : '');
  const grupos = [
    seccionPF('rendimiento', 'ambar', 'Rendimiento', `Proyección mensual <b>${din(v('PROYECCION MENSUAL'))}</b> · ${esc(pctTxt(v('INTERES PROMEDIO MENSUAL'), 2))}`,
      `<div class="pf-datos">${fila('INTERES GENERADO POR DIA')}${fila('UTILIDAD PROPIA POR DIA')}${fila('UTILIDAD INVERSOR POR DIA')}${fila('INTERES PROMEDIO MENSUAL', { pct: true })}${fila('PROYECCION MENSUAL', { resaltar: true })}</div>`),
    seccionPF('pendientes', 'rojo', 'Pagos y pendientes', `Por cobrar <b>${din(v('PENDIENTE INTERES A COBRAR'))}</b> · a inversores <b>${din(v('PENDIENTE INTERES A INVERSORES'))}</b>`,
      `<div class="pf-datos">${fila('PAGO MENSUAL A INVERSORES')}${fila('PENDIENTE INTERES A COBRAR')}${fila('PENDIENTE INTERES A INVERSORES', { resaltar: true })}${fila('RESTANTE PROPIO')}</div>`),
  ];

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
    <div class="pf-pie">${verTodos('agenda', `Ver los ${pa.length}`)}</div>`) : '';
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
    <section class="pf-fila">${flujo}</section>
    <section class="pf-fila">${prestamos}${inversores}</section>
    ${resultado}
    <p class="nota">Fuente: DASHBOARD de 💵REGISTRO DE PRESTAMOS ${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">↗</a>` : ''} y su recordatorio de 5 días ${enlaceOrigen(pr.origen)}. USDT convertido a ${TIPO_CAMBIO_USDT} MXN, la tasa de tus fórmulas.</p>
    ${listaAvisos(pr.avisos, 'Revisión de la lectura')}`;
}

/** Préstamo propio (SINDICATO, MERCADOLIBRE…): avance de pagos y registro de abonos. */
function seccionPrestamoPropio(m, P) {
  const SIND = P.S;
  if (SIND.estado === 'sin-leer') return '';
  if (SIND.estado === 'error') return seccionPF(P.clave, 'rojo', P.titulo, `<span class="texto-rojo">${esc(SIND.error ?? `No pude leer la pestaña ${P.pestana}.`)}</span>`, '', { abiertaPorDefecto: true });
  const r = P.resumen(m.hoy.idx);
  const hoyTxt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const est = r.diferencia === undefined ? '' : r.diferencia >= -0.5
    ? `<b class="texto-verde">al corriente${r.diferencia > 0.5 ? ` · adelantado ${din(r.diferencia, 0)}` : ''}</b>`
    : `<b class="texto-rojo">atrasado ${din(-r.diferencia, 0)}</b>`;
  const chipPago = (p) => ({
    pagado: '<span class="pf-estado ok">Pagado</span>', atrasado: '<span class="pf-estado mal">Atrasado</span>',
    'en-curso': '<span class="pf-estado pend">En curso</span>', parcial: '<span class="pf-estado pend">Parcial</span>', pendiente: '<span class="pf-estado neutro">Pendiente</span>',
  }[p.estado]);
  const resumen = r.capitalPendiente !== null
    ? `Capital pendiente <b>${din(r.capitalPendiente, 0)}</b> de ${din(r.monto, 0)} · interés pagado <b>${din(r.interesPagado, 0)}</b>${est ? ` · ${est}` : ''}`
    : `Saldo pendiente <b>${din(r.saldo, 0)}</b> · abonado <b>${din(r.abonado, 0)}</b>${est ? ` · ${est}` : ''}`;
  const actual = r.actual ? `<div class="sd-actual"><span>Pago ${r.actual.n} de ${r.nPagos} · ${r.actual.ini !== null ? `${esc(diaMes(r.actual.ini))} al ${esc(diaMes(r.actual.vence))}` : r.actual.vence !== null ? `vence ${esc(diaMes(r.actual.vence))} ${ymdDesdeIdx(r.actual.vence).y}` : ''}</span>
    <b>${r.actual.monto !== null ? din(r.actual.monto - r.actual.cubierto, 2) : din(null)}</b><small>${r.prop !== null && r.actual.monto !== null ? `capital ${din(r.actual.monto * r.prop, 0)} + interés ${din(r.actual.monto * (1 - r.prop), 0)}${r.estimado ? ' (estimado)' : ''} · ` : ''}${r.actual.cubierto ? `ya abonaste ${din(r.actual.cubierto, 0)} de ${din(r.actual.monto, 0)}` : (r.actual.vence !== null && r.actual.ini !== null ? `vence el ${esc(diaMes(r.actual.vence))}` : '')}</small></div>` : '<p class="texto-verde"><b>Préstamo liquidado.</b></p>';
  const cuerpo = `
    <div class="sd-barra"><i style="width:${Math.min(100, (r.avance ?? 0) * 100)}%"></i></div>
    <div class="sd-barra-etq"><span>${r.total !== null ? `${esc(pctTxt(r.avance ?? 0, 1))} pagado` : `Contratado ${r.inicioIdx !== null ? `${esc(diaMes(r.inicioIdx))} ${ymdDesdeIdx(r.inicioIdx).y}` : ''}`}${r.pagados !== undefined ? ` · ${r.pagados} de ${r.nPagos} pagos` : ''}</span><span>${r.finIdx ? `termina ${esc(diaMes(r.finIdx))} ${ymdDesdeIdx(r.finIdx).y}` : ''}</span></div>
    <div class="sd-rejilla">
      <div>
        <h3 class="df-sub">Pago actual</h3>${actual}
        <h3 class="df-sub">Registrar abono</h3>
        <form class="sd-form" data-form="abono" data-prestamo="${P.clave}" autocomplete="off">
          <label><span>Monto</span><span class="campo-dinero"><span>$</span><input name="monto" inputmode="decimal" value="${esc(String(r.actual && r.actual.monto !== null ? Math.round((r.actual.monto - r.actual.cubierto) * 100) / 100 : r.mensual || ''))}" required></span></label>
          <label><span>Fecha</span><input name="fecha" type="date" value="${hoyTxt}"></label>
          <label class="sd-nota"><span>Nota (opcional)</span><input name="nota" maxlength="120" placeholder="Transferencia, efectivo…"></label>
          <button class="boton boton-primario" type="submit" ${SIND.guardando ? 'disabled' : ''}>Guardar abono</button>
        </form>
        <h3 class="df-sub">Datos del préstamo</h3>
        <div class="pf-datos">
          <div class="pf-dato"><span>Capital</span><b>${din(r.monto)}</b></div>
          <div class="pf-dato"><span>Interés total${r.estimado ? ' (estimado)' : ''}</span><b>${din(r.interes)}</b></div>
          <div class="pf-dato"><span>Total a pagar${r.estimado ? ' (estimado)' : ''}</span><b>${din(r.total)}</b></div>
          <div class="pf-dato"><span>${r.etiquetaPago}</span><b>${din(r.pagoPeriodo)}${r.prop !== null && r.pagoPeriodo !== null ? `<small class="sd-desglose">capital ${din(r.pagoPeriodo * r.prop, 0)} + interés ${din(r.pagoPeriodo * (1 - r.prop), 0)}${r.quincenal ? ` · al mes ${din(r.mensual, 0)}` : ''}</small>` : ''}</b></div>
          <div class="pf-dato"><span>Pagado</span><b>${din(r.abonado)}${r.capitalPagado !== null ? `<small class="sd-desglose">capital ${din(r.capitalPagado, 0)} + interés ${din(r.interesPagado, 0)}</small>` : ''}</b></div>
          <div class="pf-dato"><span>Tasa</span><b>${esc(pctTxt(r.tasa, Number.isInteger(Math.round((r.tasa ?? 0) * 10000) / 100) ? 0 : 2))} anual${Number.isFinite(r.cat) ? ` · CAT ${esc(pctTxt(r.cat, 2))}` : ''} · ${r.quincenal ? `${r.nPagos ?? r.quincenas ?? '—'} quincenas` : `${r.meses ?? r.pagos?.length ?? '—'} meses`}</b></div>
        </div>
      </div>
      <div>
        <h3 class="df-sub">Tus abonos</h3>
        ${r.abonos.length ? `<div class="sd-abonos">${[...r.abonos].reverse().map((a) => `<div class="sd-abono"><span>${a.idx !== null ? esc(diaMes(a.idx)) + ` ${ymdDesdeIdx(a.idx).y}` : esc(a.fechaTexto)}${a.nota ? `<small>${esc(a.nota)}</small>` : ''}</span><b>${din(a.monto)}</b>
          <button class="tarea-borrar" data-accion="borrar-abono" data-prestamo="${P.clave}" data-fila="${a.fila}" title="Borrar abono" aria-label="Borrar abono">×</button></div>`).join('')}</div>` : '<p class="vacio">Aún no registras abonos.</p>'}
        ${r.pagos ? `<h3 class="df-sub">Calendario de pagos</h3><div class="sd-cal">${r.pagos.map((p) => `<div class="sd-cal-fila ${p.estado}"><span>${p.n}. ${p.vence === null ? 'pago anterior' : p.ini !== null ? `${esc(diaMes(p.ini))} – ${esc(diaMes(p.vence))} ${ymdDesdeIdx(p.vence).y}` : `vence ${esc(diaMes(p.vence))} ${ymdDesdeIdx(p.vence).y}`}</span><span>${din(p.monto, p.monto !== null && !Number.isInteger(p.monto) ? 2 : 0)}</span>${chipPago(p)}</div>`).join('')}</div>` : ''}
        <p class="nota">Se guarda en tu hoja «TO DO · Dashboard personal», pestaña ${esc(P.pestana)}. <a href="${P.url}" target="_blank" rel="noopener noreferrer">Abrir ↗</a></p>
      </div>
    </div>`;
  return seccionPF(P.clave, 'rojo', P.titulo, resumen, cuerpo, { abiertaPorDefecto: true });
}

/** Agenda de dinero: 30 días de cobros y pagos por fecha, con totales por semana. */
function prAgenda(m, pr, d) {
  const hoyIdx = m.hoy.idx;
  const ag = agendaDinero({ clientes: pr.clientesActivos ?? [], inversiones: pr.inversiones ?? [], propios: PRESTAMOS_PROPIOS }, hoyIdx, 30);
  const fecha = (idx) => { const t = fechaCorta(idx); return idx === hoyIdx ? `Hoy · ${t}` : idx === hoyIdx + 1 ? `Mañana · ${t}` : t; };
  const importe = (it) => `${it.tipo === 'cobrar' ? '+' : '−'}${din(it.montoMXN, 0)}${it.divisa === 'USDT' ? `<small>${esc(it.monto.toLocaleString('es-MX', { maximumFractionDigits: 2 }))} USDT</small>` : ''}`;
  const semanas = ag.semanas.map((s, k) => {
    const dias = new Map();
    for (const it of s.items) { if (!dias.has(it.idx)) dias.set(it.idx, []); dias.get(it.idx).push(it); }
    return `<details class="ag-semana ${s.pesada ? 'pesada' : ''}" ${k === 0 ? 'open' : ''}>
      <summary class="ag-semana-cab"><b>${esc(diaMes(Math.max(s.ini, hoyIdx)))} – ${esc(diaMes(s.fin))}</b>
        <span>entra <b class="texto-verde">${din(s.entra, 0)}</b> · sale <b class="texto-rojo">${din(s.sale, 0)}</b> · neto <b class="${s.neto < 0 ? 'texto-rojo' : 'texto-verde'}">${din(s.neto, 0)}</b></span>
        ${s.pesada ? '<span class="ag-alerta">⚠ Semana pesada: sale más de lo que entra</span>' : ''}
        <span class="ag-conteo">${plural(s.items.length, 'movimiento', 'movimientos')}</span>${icono('flecha', 'ag-chevron')}</summary>
      ${[...dias.entries()].map(([idx, lista]) => `<div class="ag-dia"><div class="ag-fecha">${esc(fecha(idx))}</div><div class="ag-lista">${lista.map((it) => `
        <div class="ag-item ${it.tipo} ${it.vencido ? 'vencido' : ''}"><span class="pf-tag ${it.tipo}">${it.tipo === 'cobrar' ? 'Cobrar' : 'Pagar'}</span>
          <span class="ag-nombre"><b>${esc(it.nombre)}</b><small>${esc(it.grupo)}${it.detalle ? ` · ${esc(it.detalle)}` : ''}</small></span>
          <span class="ag-monto ${it.tipo === 'cobrar' ? 'texto-verde' : 'texto-rojo'}">${importe(it)}</span></div>`).join('')}</div></div>`).join('')}
    </details>`;
  }).join('');
  return `<div class="ag-resumen">
      <div><span>Entra en 30 días</span><b class="texto-verde">${din(ag.entra, 0)}</b></div>
      <div><span>Sale en 30 días</span><b class="texto-rojo">${din(ag.sale, 0)}</b></div>
      <div><span>Neto</span><b class="${ag.neto < 0 ? 'texto-rojo' : 'texto-verde'}">${din(ag.neto, 0)}</b></div>
    </div>
    ${semanas || '<p class="vacio">Nada por cobrar ni pagar en los próximos 30 días.</p>'}
    ${seccionPrestamosActivos(d ?? {})}
    <p class="nota">Cobros: el interés del mes de cada cliente activo de REGISTRO PRESTAMOS, en el día de su fecha de inicio (J J H F no entra). Pagos: interés de tus inversores y las cuotas de tus créditos. Lo atrasado aparece hoy. USDT a ${TIPO_CAMBIO_USDT} MXN.</p>`;
}

function prPrestamos(m) {
  return `<div class="pr-acciones"><button class="boton boton-primario" data-accion="nuevo-credito">${icono('mas')}Agregar crédito</button></div>`
    + PRESTAMOS_PROPIOS.map((P) => seccionPrestamoPropio(m, P)).join('');
}

/** Tabla «Préstamos activos» (tus clientes), en la pestaña Agenda. */
function seccionPrestamosActivos(d) {
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
  const estadoCorto = (x) => ({
    pagado: '<span class="pf-estado ok">Pagado</span>', pendiente: '<span class="pf-estado pend">Pendiente</span>', atrasado: '<span class="pf-estado mal">Atrasado</span>',
    'sin-pago': '<span class="pf-estado neutro">Sin pago este mes</span>', 'sin-interes': '<span class="pf-estado neutro">Sin interés</span>',
  }[x.pago.estado] ?? '<span class="pf-estado neutro">Sin dato</span>');
  const capitalTxt = (x) => (x.divisa === 'USDT' && x.cantidad !== null ? `${esc(x.cantidad.toLocaleString('es-MX'))} USDT (${din(x.capitalMXN, 0)} MXN)` : din(x.capitalMXN, 0));
  const fechaAnio = (idx) => (idx === null || idx === undefined ? '—' : `${esc(diaMes(idx))} ${ymdDesdeIdx(idx).y}`);
  const secciones = inv.map((x) => {
    const color = x.alertaLiquidar || x.pago.estado === 'atrasado' ? 'rojo' : x.pago.estado === 'pendiente' ? 'ambar' : 'verde';
    const pagado = (x.historial ?? []).reduce((t, p) => t + (p.monto ?? 0), 0);
    const resumen = `op. ${esc(String(x.op))} · capital <b>${capitalTxt(x)}</b> · ${estadoCorto(x)}${x.alertaLiquidar ? ' · <b class="texto-rojo">⚠ liquidar pronto</b>' : ''}`;
    const historial = (x.historial ?? []).length
      ? `<div class="sd-abonos">${[...x.historial].reverse().map((p) => `<div class="sd-abono"><span>${p.idx !== null ? fechaAnio(p.idx) : '—'}</span><b>${importe(p.monto, p.divisa === 'USDT' ? 'USDT' : 'MXN')}</b><span></span></div>`).join('')}</div>`
      : '<p class="vacio">Aún no hay pagos registrados.</p>';
    const cuerpo = `<div class="sd-rejilla">
      <div>
        <h3 class="df-sub">Pago de ${esc(MESES[m.hoy.m - 1].toLowerCase())}</h3>
        <div class="pf-inv-pago">${chipPago(x)}</div>
        <h3 class="df-sub">Datos de la inversión</h3>
        <div class="pf-datos">
          <div class="pf-dato"><span>Capital</span><b>${capitalTxt(x)}</b></div>
          <div class="pf-dato"><span>Tasa</span><b>${x.tasa !== null ? `${esc(pctTxt(x.tasa, x.tasa * 100 % 1 ? 2 : 0))} mensual` : '—'}</b></div>
          <div class="pf-dato"><span>Interés al mes</span><b>${x.pagoMes ? importe(x.pagoMes, x.divisa) : '—'}</b></div>
          <div class="pf-dato"><span>Interés pendiente</span><b>${x.interesRestante !== null ? importe(x.interesRestante, x.divisa) : '—'}</b></div>
          <div class="pf-dato"><span>Inicio</span><b>${fechaAnio(x.inicioIdx)}</b></div>
          <div class="pf-dato"><span>Liquida capital</span><b>${fechaAnio(x.compromisoIdx)}${x.diasLiquidar !== null ? ` · ${x.diasLiquidar < 0 ? `venció hace ${-x.diasLiquidar} días` : `en ${x.diasLiquidar} días`}` : ''}</b></div>
        </div>
        ${liquidar(x).includes('pf-alerta') ? liquidar(x) : ''}
      </div>
      <div>
        <h3 class="df-sub">Pagos registrados · ${x.pagosHechos} · total ${importe(pagado, x.divisa)}</h3>
        ${historial}
      </div>
    </div>`;
    return seccionPF(`inv-${x.op}`, color, `${esc(x.nombre)}`, resumen, cuerpo).replace('class="tarjeta pf-sec', `class="tarjeta pf-sec pf-invsec${x.alertaLiquidar ? ' con-alerta' : ''}`);
  }).join('');
  const total = inv.reduce((s, x) => s + (x.capitalMXN ?? 0), 0);
  const mensualMXN = inv.reduce((s, x) => s + (x.pagoMes ? (x.divisa === 'USDT' ? x.pagoMes * TIPO_CAMBIO_USDT : x.pagoMes) : 0), 0);
  const pendientes = inv.filter((x) => ['pendiente', 'atrasado'].includes(x.pago.estado));
  const alertas = inv.filter((x) => x.alertaLiquidar).length;
  const resumen = [`${plural(inv.length, 'inversión', 'inversiones')} · capital <b>${din(total, 0)}</b> · intereses al mes <b>${din(mensualMXN, 0)}</b>`,
    pendientes.length ? `<b class="texto-rojo">${plural(pendientes.length, 'pago pendiente', 'pagos pendientes')}</b> este mes` : '<b class="texto-verde">pagos del mes al día</b>',
    alertas ? `<b class="texto-rojo">⚠ ${plural(alertas, 'capital por liquidar', 'capitales por liquidar')} en 30 días</b>` : ''].filter(Boolean).join(' · ');
  return `<div class="tarjeta pf-inv-total">${resumen}</div>${secciones}
    <p class="nota">Pagos: registro de pagos de REGISTRO DE INVERSORES (columnas U:AA) contra los vencimientos mensuales desde la fecha de inicio. USDT a ${TIPO_CAMBIO_USDT} MXN. ${pr.inversionesUrl ? `<a href="${esc(pr.inversionesUrl)}" target="_blank" rel="noopener noreferrer">Abrir hoja ↗</a>` : ''}</p>`;
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

// ------------------------------------------------------------------ ST

function vistaST(m) {
  const st = m.st;
  if (!st?.disponible) {
    const f = E.fuentes.st;
    return `<article class="tarjeta tarjeta-error">No hay datos de ST${f?.error ? `: ${esc(f.error.mensaje)}` : '.'}</article>`;
  }
  const so = st.socios ?? {}; const ne = st.negocio ?? {};
  const filtro = st.filtro && (normalizar(st.filtro.ciudad) !== 'GLOBAL' || normalizar(st.filtro.mes) !== 'GLOBAL')
    ? `${esc(nombreBonito(st.filtro.ciudad))} · ${esc(nombreBonito(st.filtro.mes))}` : 'Global (todas las ciudades, todo el tiempo)';
  const kpi = (color, etiqueta, valor, sub) => `<article class="tarjeta pf-kpi pf-c-${color}">
    <div class="pf-kpi-etq"><i class="pf-punto" aria-hidden="true"></i>${etiqueta}</div><div class="pf-kpi-valor">${cifraDoble(valor)}</div>
    <div class="pf-kpi-sub">${sub}</div></article>`;
  const kpis = `<section class="pf-kpis">
    ${kpi('azul', 'Total de ventas', so.ventas ?? ne.ventas, `Stock pagado ${din(so.stock ?? ne.stock, 0)}`)}
    ${kpi('ambar', 'Utilidad del negocio', ne.utilidad, st.roas?.ventas ? `Cada $1 en ads vende ${esc(String(st.roas.ventas))}x` : 'Después de stock, ads y operación')}
    ${kpi('verde', 'Ganancia personal', so.personal, `Operativa ${din(so.operativa, 0)}`)}
    ${kpi('verde', 'Caja disponible', st.caja?.disponible ?? null, st.caja ? `Generado ${din(st.caja.generado, 0)}` : 'Caja Tepic')}
  </section>`;

  const dato = (etq, v, { clase = '', resaltar = false } = {}) => `<div class="pf-dato ${resaltar ? 'resaltar' : ''}"><span>${etq}</span><b class="${clase}">${din(v)}</b></div>`;
  const secciones = [];

  // Este mes (REGISTRO DE VENTAS)
  const mes = st.mes;
  const filaVenta = (x) => `<tr><td>${x.idx !== null ? esc(diaMes(x.idx)) : '—'}</td><td>${esc(nombreBonito(x.ciudad))}</td><td>${esc(nombreBonito(x.kit))}${x.programa ? `<small class="pf-sub">${esc(nombreBonito(x.programa))}</small>` : ''}</td><td class="num">${din(x.venta, 0)}</td><td class="num">${din(x.personal, 0)}</td><td>${x.liquidado ? '<span class="pf-estado ok">Pagado</span>' : '<span class="pf-estado mal">Por cobrar</span>'}</td></tr>`;
  const nombreMesHoy = MESES[m.hoy.m - 1].toLowerCase();
  secciones.push(seccionPF('st-mes', 'azul', `Ventas de ${nombreMesHoy}`,
    mes.cantidad ? `${plural(mes.cantidad, 'venta', 'ventas')} · vendido <b>${din(mes.venta, 0)}</b> · tu ganancia <b class="texto-verde">${din(mes.personal, 0)}</b>` : 'Sin ventas registradas este mes',
    mes.cantidad ? tablaPF([['Fecha'], ['Ciudad'], ['Kit'], ['Venta', 1], ['Tu ganancia', 1], ['Pago']], [...mes.ventas].sort((a, b) => (b.idx ?? 0) - (a.idx ?? 0)).map(filaVenta))
      : `<p class="vacio">Sin ventas de ${nombreMesHoy} en el REGISTRO DE VENTAS.</p>${st.ultimas.length ? `<h3 class="df-sub">Últimas ventas</h3>${tablaPF([['Fecha'], ['Ciudad'], ['Kit'], ['Venta', 1], ['Tu ganancia', 1], ['Pago']], st.ultimas.map(filaVenta))}` : ''}`));

  // Ventas por cobrar (LIQUIDADO distinto de SI)
  if (st.sinLiquidar.length) {
    const total = st.sinLiquidar.reduce((t, x) => t + (x.venta ?? 0), 0);
    secciones.push(seccionPF('st-cobrar', 'rojo', 'Ventas por cobrar', `<b class="texto-rojo">${plural(st.sinLiquidar.length, 'venta', 'ventas')}</b> sin liquidar · <b>${din(total, 0)}</b>`,
      tablaPF([['Op.'], ['Fecha'], ['Cliente'], ['Kit'], ['Venta', 1]], st.sinLiquidar.map((x) => `<tr><td>${esc(x.op)}</td><td>${x.idx !== null ? esc(diaMes(x.idx)) : '—'}</td><td>${esc(x.cliente || '—')}</td><td>${esc(nombreBonito(x.kit))}</td><td class="num">${din(x.venta, 0)}</td></tr>`))));
  }

  // Ganancia del negocio
  secciones.push(seccionPF('st-negocio', 'ambar', 'Ganancia del negocio', `Utilidad <b>${din(ne.utilidad)}</b>${st.roas?.neta ? ` · cada $1 en ads deja ${esc(String(st.roas.neta))}x neto` : ''}`,
    `<div class="pf-datos">${dato('Total de ventas', ne.ventas)}${dato('Pagado stock', ne.stock)}${dato('Pagado publicidad', ne.publicidad)}${dato('Pagado operación y at. cliente', ne.operacion)}${dato('Utilidad del negocio', ne.utilidad, { resaltar: true })}</div>
    ${st.roas ? `<div class="df-mini-tabla"><div><span>Por $1 en ads vende</span><b>${esc(String(st.roas.ventas ?? '—'))}x</b></div><div><span>Por $1 en ads gana neto</span><b>${esc(String(st.roas.neta ?? '—'))}x</b></div></div>` : ''}`));

  // Ganancia de socios y personal
  secciones.push(seccionPF('st-socios', 'verde', 'Ganancia de socios y personal', `Tu ganancia <b class="texto-verde">${din(so.personal)}</b>`,
    `<div class="pf-datos">${dato('Total de ventas', so.ventas)}${dato('Pagado stock', so.stock)}${dato('Destinado a caja', so.caja)}${dato('Ganancia total operativa', so.operativa)}${dato('Ganancia neta personal', so.personal, { resaltar: true })}</div>
    ${st.historica?.length ? `<h3 class="df-sub">Ganancia personal histórica</h3><div class="pf-datos">${st.historica.map((x) => dato(esc(nombreBonito(x.etiqueta)), x.valor, { resaltar: x.total })).join('')}</div>` : ''}`));

  // Rendimiento por ciudad
  if (st.ciudades?.length) {
    secciones.push(seccionPF('st-ciudades', 'azul', 'Rendimiento por ciudad', st.ciudades.filter((x) => !x.total).map((x) => `${esc(nombreBonito(x.ciudad))} <b>${x.roasVenta ?? '—'}x</b>`).join(' · '),
      tablaPF([['Ciudad'], ['Publicidad', 1], ['Vendido', 1], ['Neto', 1], ['$1 en ads vende', 1], ['$1 en ads neto', 1]],
        st.ciudades.filter((x) => !x.total).map((x) => `<tr><td>${esc(nombreBonito(x.ciudad))}</td><td class="num">${din(x.ads, 0)}</td><td class="num">${din(x.vendido, 0)}</td><td class="num">${din(x.neto, 0)}</td><td class="num">${x.roasVenta ?? '—'}x</td><td class="num">${x.roasNeto ?? '—'}x</td></tr>`),
        { pie: st.ciudades.filter((x) => x.total).map((x) => `<tr><td>Total</td><td class="num">${din(x.ads, 0)}</td><td class="num">${din(x.vendido, 0)}</td><td class="num">${din(x.neto, 0)}</td><td class="num">${x.roasVenta ?? '—'}x</td><td class="num">${x.roasNeto ?? '—'}x</td></tr>`).join('') })));
  }

  // Caja y stock
  if (st.caja || st.stock?.length) {
    const sinStock = st.stock.filter((c) => c.items.some((i) => i.cantidad === 0));
    secciones.push(seccionPF('st-stock', 'rojo', 'Caja y stock',
      [st.caja ? `Caja disponible <b>${din(st.caja.disponible, 0)}</b>` : '', sinStock.length ? `<b class="texto-rojo">sin stock en ${sinStock.map((c) => esc(nombreBonito(c.ciudad))).join(', ')}</b>` : ''].filter(Boolean).join(' · '),
      `${st.caja ? `<div class="pf-datos">${dato('Generado en caja', st.caja.generado)}${dato('Gastado', st.caja.gastado)}${dato('Disponible', st.caja.disponible, { resaltar: true })}</div>` : ''}
      ${st.stock.map((c) => `<h3 class="df-sub">Stock ${esc(nombreBonito(c.ciudad))}</h3><div class="pf-datos">${c.items.map((i) => `<div class="pf-dato"><span>${esc(i.nota && i.cantidad === 0 ? 'No hay stock' : nombreBonito(i.producto))}</span><b class="${i.cantidad === 0 ? 'texto-rojo' : ''}">${i.cantidad === null ? '—' : i.cantidad === 0 && i.nota ? '' : esc(String(i.cantidad))}</b></div>`).join('')}</div>`).join('')}`));
  }

  return `<div class="pf">
    ${kpis}
    <section class="pf-fila">${secciones.join('')}</section>
    <p class="nota">Fuente: 🖥️ST ${st.url ? `<a href="${esc(st.url)}" target="_blank" rel="noopener noreferrer">DASHBOARD ↗</a>` : 'DASHBOARD'} con el filtro que tienes elegido en tu hoja: <b>${filtro}</b>. Ventas del ${st.urlVentas ? `<a href="${esc(st.urlVentas)}" target="_blank" rel="noopener noreferrer">REGISTRO DE VENTAS ↗</a>` : 'REGISTRO DE VENTAS'}.</p>
    ${st.avisos.length ? listaAvisos(st.avisos.map((t) => ({ texto: t })), 'Revisión de la lectura') : ''}
  </div>`;
}

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

/** Importe de interés en su moneda («$1,300» o «72.5 USDT»). */
const importeInteres = (v, divisa) => (divisa === 'USDT' ? `${v.toLocaleString('es-MX', { maximumFractionDigits: 2 })} USDT` : dinero(v, 0));
const aMXN = (x) => (x.divisa === 'USDT' ? x.interes * TIPO_CAMBIO_USDT : x.interes);

/**
 * Fila de resumen de intereses atrasados. tipo 'cobrar': clientes que no me
 * han pagado; 'pagar': inversores a los que yo no les he pagado.
 */
function filaInteres(lista, tipo) {
  const porPersona = new Map();
  for (const x of lista) {
    const k = `${normalizar(x.nombre)}|${x.divisa}`;
    const p = porPersona.get(k) ?? { nombre: x.nombre, divisa: x.divisa, interes: 0, creditos: 0 };
    p.interes += x.interes; p.creditos += 1;
    porPersona.set(k, p);
  }
  const personas = [...porPersona.values()].sort((a, b) => aMXN(b) - aMXN(a));
  const cobrar = tipo === 'cobrar';
  return `<button class="fila-pend u-aviso" data-accion="ver-sin-interes" data-tipo="${tipo}">
      <span class="fp-icono tipo-aviso">${icono('aviso')}</span>
      <span class="fp-texto"><span class="fp-titulo">${cobrar ? 'No ha pagado interés' : 'No les he pagado interés'}</span>
        <ul class="lista-interes">${personas.map((p) => `<li><span>${esc(p.nombre)}${p.creditos > 1 ? ` <small>(${p.creditos} ${cobrar ? 'créditos' : 'inversiones'})</small>` : ''}</span><b>${esc(importeInteres(p.interes, p.divisa))}</b></li>`).join('')}</ul></span>
      <span class="fp-derecha"><span class="fp-monto ${cobrar ? 'monto-cobrar' : 'monto-pagar'}">${esc(dinero(lista.reduce((t, x) => t + aMXN(x), 0), 0))}</span><span class="chip u-aviso"><i class="punto" aria-hidden="true"></i>${plural(personas.length, 'persona', 'personas')}</span></span></button>`;
}

/** Ventana «Agregar crédito»: al guardarlo se copia a tu hoja. */
function abrirNuevoCredito() {
  const hoyTxt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  abrirDialogo(`
    <header class="det-cab"><h2>Agregar crédito</h2></header>
    <form class="sd-form form-credito" data-form="credito" autocomplete="off">
      <label class="sd-nota"><span>Nombre del crédito</span><input name="nombre" maxlength="40" placeholder="COPPEL, NU, préstamo de nómina…" required></label>
      <label><span>Capital (lo que te prestaron)</span><span class="campo-dinero"><span>$</span><input name="monto" inputmode="decimal" required></span></label>
      <label><span>Meses para pagarlo</span><input name="meses" inputmode="numeric" placeholder="12" required></label>
      <label><span>Pago mensual</span><span class="campo-dinero"><span>$</span><input name="pago" inputmode="decimal" placeholder="opcional"></span></label>
      <label><span>Total a pagar</span><span class="campo-dinero"><span>$</span><input name="total" inputmode="decimal" placeholder="opcional"></span></label>
      <label><span>Tasa anual %</span><input name="tasa" inputmode="decimal" placeholder="opcional, ej. 39"></label>
      <label><span>Fecha de contratación</span><input name="fecha" type="date" value="${hoyTxt}"></label>
      <p class="nota sd-nota">Con el pago mensual (o el total, o la tasa) basta. Se crea su pestaña en tu hoja «TO DO», se anota en CREDITOS y se suma solo a tu RESUMEN FINANCIERO.</p>
      <button class="boton boton-primario" type="submit">Crear crédito</button>
    </form>`);
  $('#detalle input[name="nombre"]')?.focus();
}

/**
 * Anota un pago de interés de un cliente en REGISTRO PRESTAMOS (FECHA, OP,
 * CANT en U:W; PRESTAMO, DIVISA, NOMBRE y AUXILIAR se llenan solos con sus
 * fórmulas). Escribe en la primera fila vacía del registro.
 */
async function confirmarPagoInteres(boton) {
  const op = Number(boton.dataset.op);
  const inversor = boton.dataset.tipo === 'pagar';
  const entrada = document.querySelector(`input[data-pago-int="${op}"]`);
  const texto = String(entrada?.value ?? '').trim().replace(/[$,\s]/g, '');
  const monto = Number(texto);
  if (!texto || !Number.isFinite(monto) || monto <= 0) { alert(`Escribe la cantidad que ${inversor ? 'le pagaste' : 'te pagó'}, por ejemplo 1000.`); entrada?.focus(); return; }
  const hoyTxt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const hoja = inversor ? 'REGISTRO DE INVERSORES' : 'REGISTRO PRESTAMOS';
  if (!confirm(`¿Confirmar pago de ${dinero(monto)} ${inversor ? 'a' : 'de'} ${boton.dataset.nombre} (op. ${op})?\n\nSe anotará hoy (${hoyTxt}) en el registro de pagos de ${hoja}.`)) return;
  boton.disabled = true; boton.textContent = 'Guardando…';
  try {
    const token = await tokenParaEscribir();
    const id = ARCHIVOS.prestamos.id;
    const inicio = inversor ? 10 : 9;
    // Clientes: OP = fila − 8. Inversores: la OP es un conteo, se busca en la columna A.
    const [registro, tabla] = await leerRangos(token, id, [`'${hoja}'!U${inicio}:W3000`, inversor ? `'${hoja}'!A10:K1000` : `'${hoja}'!A${op + 8}:K${op + 8}`]);
    const filaOp = (tabla ?? []).find((f) => Number(f?.[0]) === op) ?? [];
    if (Number(filaOp[0]) !== op || normalizar(filaOp[3]) !== normalizar(boton.dataset.nombre) || normalizar(filaOp[10]) !== 'ACTIVO') {
      throw new Error(`La op. ${op} ya no corresponde a ${boton.dataset.nombre} activo en tu hoja. Toca «Actualizar» y vuelve a intentarlo.`);
    }
    let i = 0;
    while ((registro ?? [])[i]?.slice(0, 3).some((v) => String(v ?? '').trim() !== '')) i += 1;
    const fila = inicio + i;
    // Clientes: FECHA, OP, CANT. Inversores: OP, FECHA, CANTIDAD (el resto lo llenan sus fórmulas).
    const valores = inversor ? [op, hoyTxt, monto] : [hoyTxt, op, monto];
    await escribirRango(token, id, `'${hoja}'!U${fila}:W${fila}`, [valores], { entrada: 'USER_ENTERED' });
    // Misma presentación que tus filas: fecha «d mmm» (los colores alternos los pone tu hoja).
    const sheetId = ARCHIVOS.prestamos.pestanas?.[hoja];
    const col = inversor ? 21 : 20;
    if (sheetId !== undefined) {
      await actualizarHoja(token, id, [{ repeatCell: { range: { sheetId, startRowIndex: fila - 1, endRowIndex: fila, startColumnIndex: col, endColumnIndex: col + 1 },
        cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'd mmm' } } }, fields: 'userEnteredFormat.numberFormat' } }]).catch(() => {});
    }
    E.avisoTemporal = `Pago de ${dinero(monto)} ${inversor ? 'a' : 'de'} ${boton.dataset.nombre} (op. ${op}) anotado en tu hoja.`;
    const credito = inversor ? null : (E.modelo?.prestamos?.sinInteres ?? []).find((c) => Number(c.op) === op);
    const resumen = credito ? resumenRenovacion(credito, monto) : null;
    if ($('#detalle').open) $('#detalle').close();
    await actualizar({ interactivo: true });
    if (resumen) {
      E.ultimaRenovacion = resumen;
      abrirDialogo(`<header class="det-cab"><span class="chip u-sin-fecha"><i class="punto" aria-hidden="true"></i>Anotado</span><h2>Pago de ${esc(boton.dataset.nombre)}</h2></header>
        <p class="nota">Se anotó ${esc(dinero(monto))} (op. ${op}) en tu hoja. Este es el resumen para mandarle:</p>
        <div class="int-renov"><div class="int-renov-cab"><span>Renovación de préstamo</span><button class="boton boton-chico boton-primario" data-accion="copiar-renov" data-ultimo="1">Copiar</button></div><pre class="linea-hoja">${esc(ocultarImportes(resumen))}</pre></div>`);
    }
  } catch (error) {
    alert(error.message);
    boton.disabled = false; boton.textContent = 'Confirmar pago';
  }
}

/**
 * Resumen «RENOVACIÓN DE PRÉSTAMO» con la misma fórmula que tu hoja
 * (REGISTRO PRESTAMOS!F2 con «REESTRUCTURACION DE CREDITO»):
 *   total = capital × (1 + tasa); nuevo préstamo = total − abonado;
 *   interés = nuevo préstamo × tasa; periodos de mes en mes desde FECHA INICIO.
 */
function resumenRenovacion(x, abono) {
  if (!(abono > 0) || typeof x?.capital !== 'number' || typeof x?.tasa !== 'number' || x.inicioIdx === null || x.inicioIdx === undefined) return null;
  const miles = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
  const mesMas = (idx, k) => { const { y, m, d } = ymdDesdeIdx(idx); const mm = m - 1 + k; const yy = y + Math.floor(mm / 12); const mes = ((mm % 12) + 12) % 12 + 1;
    const ult = ymdDesdeIdx(idxDesdeYMD(mes === 12 ? yy + 1 : yy, mes === 12 ? 1 : mes + 1, 1) - 1).d; return idxDesdeYMD(yy, mes, Math.min(d, ult)); };
  const f = (idx) => { const { m, d } = ymdDesdeIdx(idx); return `${String(d).padStart(2, '0')}-${MES_CORTO[m - 1]}`; };
  const pct = `${Math.round(x.tasa * 100)}%`;
  const total = x.capital * (1 + x.tasa);
  const saldo = total - abono;
  const cab = `📌 *RENOVACIÓN DE PRÉSTAMO*\n\n👤 *Cliente:* ${x.nombre}\n📆 *Periodo anterior:* ${f(x.inicioIdx)} a ${f(mesMas(x.inicioIdx, 1))}\n💰 *Total a pagar:* ${miles(total)}\n💵 *Abonado:* ${miles(abono)}\n\n`;
  if (saldo <= 0.5) return `${cab}✅ *Préstamo liquidado.*${saldo < -0.5 ? `\n💸 Pagó ${miles(-saldo)} de más.` : ''}`;
  return `${cab}🔁 *Nuevo préstamo:* ${miles(saldo)}\n📈 *Interés (${pct}):* ${miles(saldo * x.tasa)}\n📆 *Nuevo periodo:* ${f(mesMas(x.inicioIdx, 1))} a ${f(mesMas(x.inicioIdx, 2))}\n💳 *A pagar:* ${miles(saldo * (1 + x.tasa))}`;
}

/** Actualiza la vista previa del resumen de renovación al escribir la cantidad. */
function pintarRenovacion(entrada) {
  const op = entrada.dataset.pagoInt;
  const caja = document.querySelector(`[data-renov="${CSS.escape(op)}"]`);
  if (!caja) return;
  const x = (E.modelo?.prestamos?.sinInteres ?? []).find((c) => String(c.op) === String(op));
  const abono = Number(String(entrada.value ?? '').replace(/[$,\s]/g, ''));
  const texto = resumenRenovacion(x, abono);
  caja.hidden = !texto;
  if (texto) caja.querySelector('pre').textContent = ocultarImportes(texto);
}

/** Copia el resumen de renovación (siempre con los importes reales). */
async function copiarRenovacion(boton) {
  let texto = null;
  if (boton.dataset.ultimo) texto = E.ultimaRenovacion;
  else {
    const x = (E.modelo?.prestamos?.sinInteres ?? []).find((c) => String(c.op) === boton.dataset.op);
    const entrada = document.querySelector(`input[data-pago-int="${CSS.escape(boton.dataset.op)}"]`);
    texto = resumenRenovacion(x, Number(String(entrada?.value ?? '').replace(/[$,\s]/g, '')));
  }
  if (!texto) return;
  try { await navigator.clipboard.writeText(texto); boton.textContent = 'Copiado ✓'; } catch { boton.textContent = 'No se pudo copiar'; }
  setTimeout(() => { boton.textContent = 'Copiar'; }, 1600);
}

/** Detalle de intereses atrasados: cada crédito o inversión con su número de OP. */
function abrirSinInteres(tipo = 'cobrar') {
  const cobrar = tipo === 'cobrar';
  const lista = (cobrar ? E.modelo?.prestamos?.sinInteres : E.modelo?.prestamos?.sinInteresInversores) ?? [];
  // Una tarjeta por crédito: cabe en el celular sin cortarse.
  const tarjetas = lista.map((x) => `<li class="int-tarjeta">
      <div class="int-cab"><b>${esc(x.nombre)}</b><span class="int-op">${x.op ? `op. ${esc(x.op)}` : '—'}</span></div>
      <dl class="int-datos">
        <div><dt>Interés restante</dt><dd>${esc(importeInteres(x.interes, x.divisa))}</dd></div>
        <div><dt>Pago del mes</dt><dd>${esc(importeInteres(x.pago, x.divisa))}</dd></div>
        <div><dt>Inicio</dt><dd>día ${esc(x.diaInicio)}</dd></div>
      </dl>
      <div class="pago-int"><label>Cantidad <span class="campo-dinero campo-pago-int">${x.divisa === 'USDT' ? 'USDT' : '$'}<input inputmode="decimal" data-pago-int="${esc(x.op)}" placeholder="${esc(String(Math.round(x.interes * 100) / 100))}" aria-label="Cantidad pagada por ${esc(x.nombre)}"></span></label>
        <button class="boton boton-chico boton-exito" data-accion="confirmar-pago-int" data-tipo="${tipo}" data-op="${esc(x.op)}" data-nombre="${esc(x.nombre)}">Confirmar pago</button></div>
      ${cobrar ? `<div class="int-renov" data-renov="${esc(x.op)}" hidden><div class="int-renov-cab"><span>Resumen para el cliente</span><button class="boton boton-chico boton-primario" data-accion="copiar-renov" data-op="${esc(x.op)}">Copiar</button></div><pre class="linea-hoja"></pre></div>` : ''}
    </li>`).join('');
  abrirDialogo(`
    <header class="det-cab"><span class="chip u-aviso"><i class="punto" aria-hidden="true"></i>Interés</span><h2>${cobrar ? 'No ha pagado interés' : 'No les he pagado interés'}</h2></header>
    ${lista.length ? `<ul class="int-lista">${tarjetas}</ul>`
    : `<p class="vacio">${cobrar ? 'Nadie debe interés.' : 'Estás al corriente con tus inversores.'}</p>`}
    ${cobrar ? '<p class="nota">Escribe cuánto te pagó: abajo sale el resumen de renovación (igual que «Reestructuración de crédito» de tu hoja) para copiar y mandar. Toca «Confirmar pago» para anotarlo en REGISTRO PRESTAMOS (columnas U:W) con la fecha de hoy.</p>' : '<p class="nota">Escribe cuánto le pagaste y toca «Confirmar pago»: se anota en el registro de pagos de REGISTRO DE INVERSORES (columnas U:W) con la fecha de hoy. Si es en USDT, escribe los USDT.</p>'}`);
}

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
      const editar = p.pago && r
        ? (esPrivado() ? '<div class="pago-dj nota">Muestra los importes (ojo) para editar el pago al DJ.</div>'
          : `<div class="pago-dj"><label>Pago al DJ <span class="campo-dinero">$<input type="number" inputmode="decimal" min="0" step="1" value="${typeof r.pagoDj === 'number' ? r.pagoDj : ''}" placeholder="Sin registro" data-fila-pagodj="${r.fila}" data-pendiente-pago="${esc(p.id)}"></span></label>
            <button class="boton boton-chico" data-accion="guardar-pagodj" data-pendiente-pago="${esc(p.id)}" data-fila="${r.fila}">Guardar</button><span class="pagodj-estado" data-estado-pagodj="${r.fila}" aria-live="polite"></span></div>`)
        : '';
      // La vista previa solo se activa si la fórmula replicada da lo mismo que la hoja.
      const previa = r && typeof r.importe?.valor === 'number' && entregarCon(r, r.pagoDj) !== null
        && Math.abs(entregarCon(r, r.pagoDj) - r.importe.valor) < 0.01;
      const horas = typeof r?.horas === 'number' ? r.horas : Number(String(r?.horas ?? '').replace(',', '.'));
      const duracion = Number.isFinite(horas) && horas > 0 ? ` · <span class="det-duracion">${esc(String(horas))} ${horas === 1 ? 'hora' : 'horas'}</span>` : '';
      return `<li>${esc(capitalizar(fechaLarga(f.idx)))}${duracion}${r?.importe?.valor !== undefined && r?.importe?.valor !== null ? ` · Enviar <b class="enviar-valor" ${previa ? `data-enviar-fila="${r.fila}"` : ''}>${esc(dinero(r.importe.valor))}</b>` : ''}${r?.url ? ` <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">fila ${r.fila} ↗</a>` : ''}${unoSolo}${editar}</li>`;
    }).join('')}</ul></section>`;
  } else if (p.registros?.length) {
    registros = `<section><h3>Registro</h3><ul class="det-lista">${p.registros.map((r) => `<li>${r.rango ?? r.hora ? `${esc(r.rango ?? r.hora)} · ` : ''}${r.tipo ? `${esc(r.tipo)} · ` : ''}${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">fila ${r.fila} ↗</a>` : `fila ${r.fila}`}${r.banderas?.length ? ` · ${esc(r.banderas.map((b) => b.texto).join(', '))}` : ''}</li>`).join('')}</ul></section>`;
  }
  if ((p.tipo === 'deuda' || p.tipo === 'agenda') && p.hoy?.length) {
    registros += `<section class="det-hoy"><h3>Evento de hoy · cobro anticipado</h3>
      <p class="nota">Anota desde ya el pago al DJ para sacar el resumen completo. Se guarda en la pestaña PAGOS DJ con la llave del evento; entra a la deuda cuando se registre como realizado.</p>
      <ul class="det-lista">${p.hoy.map((r) => {
        const horas = typeof r.horas === 'number' ? r.horas : Number(String(r.horas ?? '').replace(',', '.'));
        const duracion = Number.isFinite(horas) && horas > 0 ? ` · <span class="det-duracion">${esc(String(horas))} ${horas === 1 ? 'hora' : 'horas'}</span>` : '';
        const enviar = ` · Enviar (estimado) <b class="enviar-valor" data-enviar-fila="${r.fila}">${typeof r.entregar === 'number' ? esc(dinero(r.entregar)) : '—'}</b>`;
        const editar = p.pago
          ? (esPrivado() ? '<div class="pago-dj nota">Muestra los importes (ojo) para editar el pago al DJ.</div>'
            : `<div class="pago-dj"><label>Pago al DJ <span class="campo-dinero">$<input type="number" inputmode="decimal" min="0" step="1" value="${typeof r.pagoDj === 'number' ? r.pagoDj : ''}" placeholder="Sin registro" data-fila-pagodj="${r.fila}" data-pendiente-pago="${esc(p.id)}"></span></label>
              <button class="boton boton-chico" data-accion="guardar-pagodj" data-pendiente-pago="${esc(p.id)}" data-fila="${r.fila}">Guardar</button><span class="pagodj-estado" data-estado-pagodj="${r.fila}" aria-live="polite"></span></div>`)
          : '';
        return `<li><b>Hoy</b>, ${esc(fechaLarga(r.idx))}${duracion}${enviar}${r.url ? ` <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">fila ${r.fila} ↗</a>` : ''}${editar}</li>`;
      }).join('')}</ul></section>`;
  }
  const mensaje = p.mensaje ? `<section class="det-mensaje">
      <div class="det-mensaje-cab"><h3>Mensaje para enviar</h3>
        <span class="det-mensaje-botones">${botonWhatsApp(p)}<button class="boton boton-primario boton-chico" data-accion="copiar-mensaje" data-pendiente-msg="${esc(p.id)}">Copiar</button></span></div>
      ${avisoTelefono(p)}
      ${p.esperar ? `<p class="det-esperar ${p.esperar.estado}">${esc(textoEsperar(p))}. Si mandas el resumen ahora, al terminar tendrías que mandar otro.</p>` : ''}
      ${p.mensajeAnticipado ? `<label class="det-incluir-hoy"><input type="checkbox" data-accion="incluir-hoy" data-pendiente-msg="${esc(p.id)}" ${E.incluirHoy !== false ? 'checked' : ''}> Incluir el evento de hoy (resumen anticipado)</label>` : ''}
      <pre class="linea-hoja">${esc(ocultarImportes(mensajeDe(p)))}</pre>
      ${p.tipo === 'deuda' ? '<p class="nota">Mismo total que tu hoja (AGENDA Y VENTAS, celda I3). En eventos con sonido de otro socio se desglosa su ganancia para que cuadre.</p>' : ''}
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
  // Agrupado por ciudad; dentro de cada ciudad, un renglón por evento ordenado
  // por hora de inicio (de más temprano a más tarde). Los sin DJ van en su ciudad.
  const porCiudad = new Map();
  for (const p of pendientes) {
    const ciudad = normalizar(p.sinDj ? (p.subtitulo || 'Sin ciudad') : p.ciudad) || 'SIN CIUDAD';
    if (!porCiudad.has(ciudad)) porCiudad.set(ciudad, { nombre: ciudad, filas: [] });
    const regs = (p.registros ?? []).filter((r) => r);
    if (regs.length) {
      for (const r of regs) porCiudad.get(ciudad).filas.push({ p, inicio: r.inicioMin ?? Infinity, hora: r.rango ?? r.hora ?? '', banderas: r.banderas ?? [] });
    } else {
      porCiudad.get(ciudad).filas.push({ p, inicio: Infinity, hora: (p.horas ?? []).join(' · '), banderas: p.banderas ?? [] });
    }
  }
  const grupos = [...porCiudad.values()].map((g) => ({ ...g, filas: g.filas.sort((a, b) => a.inicio - b.inicio || a.p.titulo.localeCompare(b.p.titulo)) }))
    .sort((a, b) => a.filas[0].inicio - b.filas[0].inicio || b.filas.length - a.filas.length);
  const bloques = grupos.map((g) => `
    <section><h3 class="det-ciudad">${chipCiudad(g.nombre)}<span>${g.filas.length} ${g.filas.length === 1 ? 'evento' : 'eventos'}</span></h3>
    <ul class="det-lista det-horario">${g.filas.map((f) => `<li><span class="det-hora">${esc(f.hora || 'Sin hora')}</span>
      <button class="boton-texto" data-pendiente="${esc(f.p.id)}">${f.p.sinDj ? 'Sin DJ asignado' : esc(f.p.titulo)}</button>${f.banderas.length ? ` <span class="mal">${esc(f.banderas.map((b) => b.texto).join(', '))}</span>` : ''}</li>`).join('')}</ul></section>`).join('');
  abrirDialogo(`
    <header class="det-cab">${chipUrgencia({ urgencia: idx <= hoyIdx ? 'hoy' : 'proximo', fechaIdx: idx }, hoyIdx)}<h2>${esc(capitalizar(fechaLarga(idx)))}</h2></header>
    <p><b>${dia.eventos ?? '—'}</b> ${dia.eventos === 1 ? 'evento' : 'eventos'} · <b>${pendientes.length}</b> ${pendientes.length === 1 ? 'pendiente' : 'pendientes'}${dia.realizados ? ` · <b>${dia.realizados}</b> ya ${dia.realizados === 1 ? 'realizado' : 'realizados'}` : ''}</p>
    ${bloques}
    ${bloqueOrigen({ origen: E.modelo.nayarsound.agenda.origen, linea: dia.lineas.join('\n') })}`);
}

arrancar();
