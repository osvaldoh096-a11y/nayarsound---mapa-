// Interfaz del panel: Inicio, NayarSound, Préstamos e inversores, Finanzas y Fuentes.

import { leerPreferencias, guardarPreferencias } from './config.js';
import { prepararSesion, iniciarSesion, tokenVigente, olvidarToken, cerrarSesion } from './auth.js';
import { leerTodo, datosDisponibles } from './carga.js';
import { construirModelo } from './modelo.js';
import {
  hoyCDMX, fechaLarga, fechaCorta, diasRelativos, momento, hora, nombreMes, MESES, normalizar,
} from './fechas.js';
import { dinero, monto, esc, plural, capitalizar } from './formato.js';
import { barras, lineas, activarTips, ocultarTip } from './graficas.js';
import { ARCHIVOS, ORDEN_ARCHIVOS, TIPO_CAMBIO_USDT, CLIENTE_GOOGLE } from './fuentes.js';
import { fuentesDemo } from './demo.js';

const VISTAS = {
  inicio: { titulo: 'Inicio', archivos: ORDEN_ARCHIVOS },
  nayarsound: { titulo: 'NayarSound', archivos: ['nayarsound', 'agenda'] },
  prestamos: { titulo: 'Préstamos e inversores', archivos: ['prestamos'] },
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

async function arrancar() {
  E.demo = new URLSearchParams(location.search).has('demo');
  E.ruta = rutaDesdeHash();
  window.addEventListener('hashchange', () => { E.ruta = rutaDesdeHash(); E.filtro = null; pintar(); window.scrollTo(0, 0); });
  document.addEventListener('click', alHacerClic);
  document.addEventListener('change', alCambiar);
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
    E.fuentes = await leerTodo(token, E.cfg.archivos, E.fuentes);
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
  if (accion === 'salir') {
    cerrarSesion();
    Object.assign(E, { modelo: null, fuentes: {}, ultimaCompleta: null, ultimoIntento: 0 });
    location.hash = '#/inicio';
    pintar();
  }
  if (accion === 'tabla') { const t = $(`#${el.dataset.objetivo}`); if (t) t.hidden = !t.hidden; }
}

function alCambiar(evento) {
  const el = evento.target;
  if (el.id === 'sel-mes') { E.mes = Number(el.value); pintar(); }
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
  const estado = $('#estado-lectura');
  const errores = ORDEN_ARCHIVOS.filter((k) => E.fuentes[k]?.estado === 'error');
  if (E.cargando) estado.innerHTML = 'Leyendo tus hojas…';
  else if (!E.modelo) estado.innerHTML = '';
  else if (errores.length) {
    estado.innerHTML = `<span class="estado-error">⚠ ${errores.length === ORDEN_ARCHIVOS.length ? 'Sin actualizar' : 'Actualización parcial'}</span>${E.ultimaCompleta ? ` · última completa ${esc(hora(E.ultimaCompleta))}` : ''}`;
  } else {
    estado.innerHTML = `Actualizado <time>${esc(momento(E.ultimaCompleta))}</time>${E.pref.autoMinutos ? ` · auto ${E.pref.autoMinutos} min` : ''}`;
  }
}

function pintarAvisoGlobal() {
  const partes = [];
  if (E.demo) {
    partes.push('<div class="banda banda-demo"><b>DATOS DE EJEMPLO.</b> Nombres y cifras inventados para probar el panel. No son tus datos reales.</div>');
  }
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
  return `<span class="chip u-${p.urgencia}"><i class="punto" aria-hidden="true"></i>${esc(texto)}</span>`;
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
  return `<span class="accion-tag ${accion === 'COBRAR' ? 'cobrar' : 'pagar'}">${accion}</span>`;
}

function filaPendiente(p, hoyIdx) {
  const fecha = p.fechaIdx !== null && p.fechaIdx !== undefined ? fechaCorta(p.fechaIdx) : '';
  const detalle = [
    p.subtitulo,
    fecha,
    p.op ? `op. ${p.op}` : '',
    p.tipo === 'deuda' && p.fechas?.length ? p.fechas.map((f) => fechaCorta(f.idx)).join(', ') : '',
  ].filter(Boolean).join(' · ');
  const importe = typeof p.monto === 'number'
    ? `<span class="fp-monto">${esc(dinero(p.monto, p.decimales ?? 2))}${p.usdt ? `<small>${esc(monto(p.usdt, 'USDT'))}</small>` : ''}</span>` : '';
  return `<button class="fila-pend u-${p.urgencia}" data-pendiente="${esc(p.id)}">
    ${chipUrgencia(p, hoyIdx)}
    <span class="fp-texto">${accionTag(p.accion)}<span class="fp-titulo">${esc(p.titulo)}</span><small>${esc(detalle)}</small></span>
    ${importe}
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
    sinDj ? `${sinDj} sin DJ` : '', conAccion ? `${conAccion} requieren acción` : ''].filter(Boolean).join(' · ');
  return `<button class="fila-pend u-${urgencia}" data-dia="${dia.idx}">
    ${chipUrgencia({ urgencia, fechaIdx: dia.idx }, hoyIdx)}
    <span class="fp-texto"><span class="fp-titulo">${esc(titulo)}</span><small>${esc(detalle)}</small></span>
    <span class="fp-monto fp-conteo">${pendientes.length}<small>pendientes</small></span>
  </button>`;
}

function tilesFinanzas(mes, { conOrigen = true } = {}) {
  if (!mes) {
    const f = E.fuentes.gastos;
    return `<article class="tarjeta tarjeta-error">No hay datos de finanzas${f?.error ? `: ${esc(f.error.mensaje)}` : '.'}</article>`;
  }
  const nombre = mes.y ? nombreMes(mes.y, mes.m) : mes.etiqueta;
  const sinGastos = mes.registrosGastos === 0;
  return `
  <article class="tarjeta tile">
    <h3 class="etq">Ganancia mensual</h3>
    <div class="cifra">${valorCelda(mes.ganancia)}</div>
    <div class="sub">${esc(nombre)} · suma de tus negocios</div>
    ${conOrigen ? enlaceOrigen(mes.ganancia.origen) : ''}
  </article>
  <article class="tarjeta tile">
    <h3 class="etq">Gastos personales</h3>
    <div class="cifra">${valorCelda(mes.gastos)}</div>
    <div class="sub">${sinGastos ? '<span class="marca-aviso">Sin gastos registrados este mes</span>' : esc(`${mes.registrosGastos ?? '—'} registros`)}</div>
    ${conOrigen ? enlaceOrigen(mes.gastos.origen) : ''}
  </article>
  <article class="tarjeta tile tile-resultado">
    <h3 class="etq">Sobrante mensual</h3>
    <div class="cifra ${mes.sobrante.valor < 0 ? 'negativo' : ''}">${valorCelda(mes.sobrante)}</div>
    <div class="sub">Ganancia − gastos personales. Resultado calculado, no saldo bancario.</div>
    ${conOrigen ? enlaceOrigen(mes.sobrante.origen) : ''}
  </article>`;
}

// ------------------------------------------------------------------ Inicio

function vistaInicio(m) {
  const hoyIdx = m.hoy.idx;
  const chips = ['hoy', 'proximo', 'sin-fecha'].map((u) => `
    <a href="#/inicio" class="chip chip-filtro u-${u} ${E.filtro === u ? 'activo' : ''}" data-filtro="${u}" aria-pressed="${E.filtro === u}">
      <i class="punto" aria-hidden="true"></i>${URG[u]} <b>${m.conteo[u]}</b></a>`).join('');
  return `
  <h1 class="titulo-vista">${esc(capitalizar(fechaLarga(hoyIdx)))}</h1>
  <section class="rejilla-resumen">
    <article class="tarjeta kpi">
      <h2 class="etq">Pendientes</h2>
      <div class="cifra cifra-xl">${m.pendientes.length}</div>
      <div class="chips">${chips}</div>
    </article>
    <article class="tarjeta kpi">
      <h2 class="etq">Eventos NayarSound</h2>
      ${m.eventos.agendaDisponible ? `<div class="par">
        <div><div class="cifra">${m.eventos.hoy}</div><div class="sub">hoy</div></div>
        <div><div class="cifra">${m.eventos.manana}</div><div class="sub">mañana</div></div>
      </div><p class="nota">Se cuentan aparte de los pendientes.</p>` : '<p class="sin-dato">Sin datos de agenda.</p>'}
    </article>
  </section>
  <section class="rejilla-tiles compacta">${tilesFinanzas(m.mesActual, { conOrigen: false })}</section>
  <section>
    <h2 class="titulo-seccion">Alertas por negocio${E.filtro ? ` · ${URG[E.filtro]} <button class="boton-texto" data-filtro="${E.filtro}">quitar filtro</button>` : ''}</h2>
    ${alertasPorNegocio(m)}
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
  const otros = ns.filter((x) => x.tipo !== 'agenda' && (x.tipo !== 'deuda' || E.filtro === 'sin-fecha'));
  for (const p of otros) filasNs.push({ urg: p.urgencia, fecha: p.fechaIdx, html: filaPendiente(p, hoyIdx) });
  const controles = (m.nayarsound.controles ?? []).filter((c) => c.estado !== 'ok');
  if ((!E.filtro || E.filtro === 'aviso') && controles.length) {
    filasNs.push({ urg: 'aviso', fecha: null, html: `<a class="fila-pend u-aviso" href="#/nayarsound">
      <span class="chip u-aviso"><i class="punto" aria-hidden="true"></i>Captura</span>
      <span class="fp-texto"><span class="fp-titulo">Avisos de captura en tus hojas</span><small>${esc(controles.map((c) => c.etiqueta).join(' · '))}</small></span>
      <span class="fp-monto fp-conteo">${controles.length}<small>${controles.length === 1 ? 'aviso' : 'avisos'}</small></span></a>` });
  }
  bloques.push({ nombre: 'NayarSound', ruta: 'nayarsound', filas: filasNs, disponible: m.nayarsound.disponible });

  const pr = filtrar(m.pendientes.filter((p) => p.negocio === 'Préstamos'));
  bloques.push({ nombre: 'Préstamos e inversores', ruta: 'prestamos', disponible: m.prestamos.disponible,
    filas: pr.map((p) => ({ urg: p.urgencia, fecha: p.fechaIdx, html: filaPendiente(p, hoyIdx) })) });

  const rango = { vencido: 0, hoy: 1, proximo: 2, 'sin-fecha': 3, aviso: 4 };
  for (const b of bloques) b.filas.sort((a, z) => (rango[a.urg] - rango[z.urg]) || ((a.fecha ?? Infinity) - (z.fecha ?? Infinity)));
  bloques.sort((a, z) => (rango[a.filas[0]?.urg] ?? 9) - (rango[z.filas[0]?.urg] ?? 9));

  return bloques.map((b) => `
    <article class="tarjeta bloque-alertas">
      <header class="tarjeta-cab"><h3>${esc(b.nombre)}</h3><a class="enlace-vista" href="#/${b.ruta}">Ver sección →</a></header>
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
    return `<button class="dj ${accion ? 'requiere' : ''}" ${p ? `data-pendiente="${esc(p.id)}"` : ''}>
            <b>${esc(dj.nombre)}</b>${dj.eventos > 1 ? `<span class="dj-n">×${dj.eventos}</span>` : ''}
            ${dj.horas?.length ? `<span class="dj-hora">${esc(dj.horas.join(' · '))}</span>` : ''}
            ${accion ? `<span class="dj-accion">${esc(dj.banderas.map((b) => b.texto).join(' · '))}</span>` : ''}
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
      <td><b>${esc(p.nombre)}</b></td>
      <td class="num">${p.eventos}</td>
      <td class="num">${(() => { const n = diasDeuda(p, E.modelo.hoy.idx); return n === null ? '—' : esc(textoDias(n)); })()}</td>
      <td>${p.fechas.map((f) => `<span class="fecha-mini">${esc(fechaCorta(f.idx))}</span>`).join(' ')}</td>
      <td class="num">${esc(dinero(p.monto, 0))}</td></tr>`;
  }).join('');
  const cruce = deuda.cruce ? `<p class="nota ${deuda.cruce.coincide ? 'ok' : 'mal'}">${deuda.cruce.coincide ? '✓' : '⚠'} ${deuda.cruce.eventos} eventos por liquidar; tu hoja marca «${esc(deuda.cruce.texto.replace(/[❌✅]/gu, '').trim())}».</p>` : '';
  return `<article class="tarjeta">${cab}
    <div class="cifra-linea"><span class="cifra">${esc(dinero(deuda.total, 0))}</span><span class="sub">total por cobrar a ${plural(deuda.personas.length, 'persona', 'personas')}</span></div>
    <table class="tabla"><thead><tr><th>Persona</th><th class="num">Eventos</th><th class="num">Debe hace</th><th>Fechas</th><th class="num">Importe</th></tr></thead>
    <tbody>${filas}</tbody>
    <tfoot><tr><td colspan="4">Total general por cobrar</td><td class="num">${esc(dinero(deuda.total, 0))}</td></tr></tfoot></table>
    <p class="nota">Días desde el evento más antiguo que se debe. Importes redondeados a pesos, como en tu hoja.</p>${cruce}
  </article>`;
}

function tarjetaControles(controles) {
  if (!controles?.length) return '';
  const fallas = controles.filter((c) => c.estado !== 'ok');
  const bien = controles.length - fallas.length;
  return `<article class="tarjeta">
    <header class="tarjeta-cab"><h2>Avisos de captura</h2></header>
    ${fallas.length ? `<ul class="lista-controles">${fallas.map((c) => `<li><span class="chip u-aviso"><i class="punto" aria-hidden="true"></i>${esc(c.texto.replace(/[❌✅]/gu, '').trim())}</span> ${esc(c.etiqueta)} ${enlaceOrigen(c.origen)}</li>`).join('')}</ul>` : '<p class="vacio">Todo en orden.</p>'}
    ${bien ? `<p class="nota">${plural(bien, 'control', 'controles')} en orden.</p>` : ''}
  </article>`;
}

function listaAvisos(avisos, titulo) {
  if (!avisos?.length) return '';
  const unicos = [...new Set(avisos.map((a) => a.texto))];
  return `<details class="tarjeta avisos"><summary>${esc(titulo)} · ${unicos.length}</summary>
    <ul>${unicos.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></details>`;
}

// ------------------------------------------------------------------ Préstamos

function vistaPrestamos(m) {
  const pr = m.prestamos;
  if (!pr.disponible) return '<article class="tarjeta tarjeta-error">No hay datos de préstamos.</article>';
  const hoyIdx = m.hoy.idx;
  const idDe = (accion, item) => [...E.pendientes.values()].find((p) => p.accion === accion && p.tipo !== 'liquidar'
    && p.titulo === item.nombre && p.fechaIdx === item.fechaIdx && p.linea === item.linea)?.id;
  const lista = (items, accion) => (items.length
    ? `<div class="lista-pend">${items.map((it) => {
      const p = E.pendientes.get(idDe(accion, it));
      return p ? filaPendiente(p, hoyIdx) : '';
    }).join('')}</div>`
    : '<p class="vacio">Nada en los próximos 5 días.</p>');
  const t = pr.totales ?? { cobrarMXN: 0, pagarMXN: 0, pagarUSDT: 0, capitalMXN: 0 };
  const sinTexto = pr.estado === 'sin-recordatorios';
  const liquidaciones = pr.liquidaciones.length
    ? `<div class="lista-pend">${[...E.pendientes.values()].filter((p) => p.tipo === 'liquidar').map((p) => filaPendiente(p, hoyIdx)).join('')}</div>`
    : '<p class="vacio">Sin capital por liquidar en los próximos 30 días.</p>';
  return `
  <h1 class="titulo-vista">Préstamos e inversores</h1>
  ${sinTexto ? '<p class="banda banda-info">Tu hoja no muestra recordatorios para los próximos 5 días.</p>' : ''}
  <section class="rejilla-dos">
    <article class="tarjeta lado lado-cobrar">
      <header class="tarjeta-cab"><h2>Me deben pagar</h2>${accionTag('COBRAR')}</header>
      <div class="cifra-linea"><span class="cifra">${esc(dinero(t.cobrarMXN, 0))}</span><span class="sub">${plural(pr.cobrar.length, 'cobro', 'cobros')} en 5 días${t.cobrarUSDT ? ` · incluye ${esc(monto(t.cobrarUSDT, 'USDT'))} × ${TIPO_CAMBIO_USDT}` : ''}</span></div>
      ${lista(pr.cobrar, 'COBRAR')}
    </article>
    <article class="tarjeta lado lado-pagar">
      <header class="tarjeta-cab"><h2>Yo debo pagar</h2>${accionTag('PAGAR')}</header>
      <div class="cifra-linea"><span class="cifra">${esc(dinero(t.pagarMXN, 0))}</span><span class="sub">${plural(pr.pagar.length, 'pago', 'pagos')} en 5 días${t.pagarUSDT ? ` · incluye ${esc(monto(t.pagarUSDT, 'USDT'))} × ${TIPO_CAMBIO_USDT}` : ''}</span></div>
      ${lista(pr.pagar, 'PAGAR')}
    </article>
  </section>
  <article class="tarjeta">
    <header class="tarjeta-cab"><h2>Capital por liquidar a inversores</h2>${accionTag('PAGAR')}</header>
    ${pr.liquidaciones.length ? `<div class="cifra-linea"><span class="cifra">${esc(dinero(t.capitalMXN, 0))}</span><span class="sub">en los próximos 30 días</span></div>` : ''}
    ${liquidaciones}
  </article>
  <p class="nota">Fuente: recordatorio de 5 días de tu hoja ${enlaceOrigen(pr.origen)}. Montos en MXN redondeados como en tu hoja; USDT convertido a ${TIPO_CAMBIO_USDT} MXN, la tasa de tus fórmulas. No se incluyen vencidos.</p>
  ${listaAvisos(pr.avisos, 'Revisión de la lectura')}`;
}

// ------------------------------------------------------------------ Finanzas

function vistaFinanzas(m) {
  const fi = m.finanzas;
  if (!fi.disponible || !fi.meses.length) {
    return `<h1 class="titulo-vista">Finanzas</h1><article class="tarjeta tarjeta-error">No hay datos de finanzas.</article>${listaAvisos(fi.avisos, 'Revisión de la lectura')}`;
  }
  if (E.mes === null || !fi.meses[E.mes]) E.mes = fi.indiceActual >= 0 ? fi.indiceActual : fi.meses.length - 1;
  const mes = fi.meses[E.mes];
  const opciones = fi.meses.map((x, i) => `<option value="${i}" ${i === E.mes ? 'selected' : ''}>${esc(x.y ? nombreMes(x.y, x.m) : x.etiqueta)}${i === fi.indiceActual ? ' (actual)' : ''}</option>`).join('');
  const negocios = mes.negocios.map((n) => ({ nombre: n.nombre, valor: n.valor, nota: n.estado === 'vacia' ? 'Celda vacía' : n.estado === 'error' ? n.texto : '' }));
  const top = 8;
  const cats = mes.categorias ?? [];
  const catItems = cats.slice(0, top).map((c) => ({ nombre: c.nombre, valor: c.total, detalle: plural(c.registros, 'registro', 'registros') }));
  if (cats.length > top) {
    const resto = cats.slice(top);
    catItems.push({ nombre: `Otras (${resto.length})`, valor: resto.reduce((s, c) => s + c.total, 0), detalle: resto.map((c) => c.nombre).join(', ') });
  }
  const avisosMes = [...mes.avisos, ...fi.avisos.map((a) => a.texto)];
  return `
  <div class="cab-vista">
    <h1 class="titulo-vista">Finanzas</h1>
    <label class="selector">Mes <select id="sel-mes">${opciones}</select></label>
  </div>
  <section class="rejilla-tiles">${tilesFinanzas(mes)}</section>
  <section class="rejilla-dos">
    <article class="tarjeta">
      <header class="tarjeta-cab"><h2>Ganancia por negocio</h2>${enlaceOrigen(mes.ganancia.origen, `fila ${mes.fila}`)}</header>
      ${barras(negocios, { divergente: true })}
    </article>
    <article class="tarjeta">
      <header class="tarjeta-cab"><h2>Gastos por categoría</h2></header>
      ${barras(catItems, { vacio: mes.registrosGastos === 0 ? 'Sin gastos registrados este mes.' : 'Sin desglose disponible.' })}
      ${mes.gastosCuadran === true ? '<p class="nota ok">✓ Las categorías suman lo mismo que tu hoja.</p>' : ''}
    </article>
  </section>
  <article class="tarjeta">
    <header class="tarjeta-cab"><h2>Evolución mensual</h2>
      <button class="boton-texto" data-accion="tabla" data-objetivo="tabla-mensual">Ver tabla</button></header>
    <div class="leyenda"><span><i class="muestra s-ganancia"></i>Ganancia</span><span><i class="muestra s-gastos"></i>Gastos personales</span><span><i class="muestra s-sobrante"></i>Sobrante</span></div>
    <div id="grafica-mensual" class="grafica"></div>
    <div id="tabla-mensual" hidden>${tablaMensual(fi)}</div>
  </article>
  ${avisosMes.length ? `<article class="tarjeta avisos-abiertos"><h2>Revisión de ${esc(mes.y ? nombreMes(mes.y, mes.m) : mes.etiqueta)}</h2><ul>${[...new Set(avisosMes)].map((a) => `<li>${esc(a)}</li>`).join('')}</ul></article>` : ''}
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
  ${avisos.length ? `<article class="tarjeta avisos-abiertos"><h2>Revisión de la lectura</h2><ul>${[...new Set(avisos.map((a) => a.texto))].map((t) => `<li>${esc(t)}</li>`).join('')}</ul></article>` : ''}
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
    <p>Entra con tu cuenta de Google para leer tus hojas. Solo se pide permiso de <b>lectura</b>.</p>
    ${E.errorSesion ? `<p class="mal" role="alert">${esc(E.errorSesion)}</p>` : ''}
    <button class="boton boton-primario boton-grande" data-accion="entrar" ${E.sesion !== 'lista' ? 'disabled' : ''}>${E.sesion === 'preparando' ? 'Preparando…' : 'Entrar con Google'}</button>
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
  if (!d.open) d.showModal();
}

function bloqueOrigen(p) {
  const o = p.origen;
  return `<section class="det-origen">
    <h3>Origen</h3>
    <p>${esc(o?.archivo || '')} › ${esc(o?.pestana || '')}${o?.a1 ? ` › ${esc(o.a1)}` : ''} ${enlaceOrigen(o, 'Abrir celda')}</p>
    ${p.linea ? `<pre class="linea-hoja">${esc(p.linea)}</pre>` : ''}
  </section>`;
}

function abrirPendiente(p) {
  if (!p) return;
  const hoyIdx = E.modelo.hoy.idx;
  const filas = [];
  if (p.accion) filas.push(['Acción', accionTag(p.accion)]);
  filas.push([p.tipo === 'agenda' ? 'DJ' : 'Nombre', `<b>${esc(p.titulo)}</b>`]);
  if (p.tipo === 'agenda') filas.push(['Ciudad', esc(p.subtitulo)]);
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
      return `<li>${esc(capitalizar(fechaLarga(f.idx)))}${r?.importe?.valor !== undefined && r?.importe?.valor !== null ? ` · ${esc(dinero(r.importe.valor))}` : ''}${r?.url ? ` <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">fila ${r.fila} ↗</a>` : ''}</li>`;
    }).join('')}</ul></section>`;
  } else if (p.registros?.length) {
    registros = `<section><h3>Registro</h3><ul class="det-lista">${p.registros.map((r) => `<li>${r.hora ? `${esc(r.hora)} · ` : ''}${r.tipo ? `${esc(r.tipo)} · ` : ''}${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">fila ${r.fila} ↗</a>` : `fila ${r.fila}`}${r.banderas?.length ? ` · ${esc(r.banderas.map((b) => b.texto).join(', '))}` : ''}</li>`).join('')}</ul></section>`;
  }
  abrirDialogo(`
    <header class="det-cab">${chipUrgencia(p, hoyIdx)}<h2>${esc(p.negocio)}</h2></header>
    <dl class="det-datos">${filas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
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
    <p><b>${dia.eventos ?? '—'}</b> eventos · <b>${pendientes.length}</b> pendientes (uno por DJ y uno por evento sin DJ)</p>
    ${bloques}
    ${bloqueOrigen({ origen: E.modelo.nayarsound.agenda.origen, linea: dia.lineas.join('\n') })}`);
}

arrancar();
