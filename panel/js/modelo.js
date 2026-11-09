// Convierte lo leído de las hojas en lo que muestra el panel:
// pendientes, agenda, deudas, préstamos y finanzas del mes.
//
// Regla general: el panel muestra lo que tus DASHBOARD ya calculan
// (recordatorios y tabla mensual). Las tablas de registros solo se usan para
// añadir hora y enlace a la fila, nunca para cambiar una cifra.

import {
  normalizar, idxDesdeSerial, idxDesdeYMD, ymdDesdeIdx, inferirFecha, etiquetaMes, leerEtiquetaMes, horaDesdeFraccion, fechaLarga,
} from './fechas.js?v=202611092213';
import { leerAgenda, leerDeuda, leerPrestamos, leerControl } from './parsers.js?v=202611092213';
import {
  textoBajoEncabezado, tablaPorEncabezados, buscarFilaEncabezado, inicioRango, urlHoja,
  numeroCelda, letraColumna,
} from './sheets.js?v=202611092213';
import { ARCHIVOS, TIPO_CAMBIO_USDT, CATEGORIAS_IGUALES } from './fuentes.js?v=202611092213';
import { leerDashboardPrestamos } from './dashprestamos.js?v=202611092213';
import { modeloST } from './st.js?v=202611092213';
import { modeloOperacion } from './nsops.js?v=202611092213';
import { dinero } from './formato.js?v=202611092213';

export const URGENCIAS = ['vencido', 'hoy', 'proximo', 'sin-fecha', 'aviso'];
const RANGO_URGENCIA = Object.fromEntries(URGENCIAS.map((u, i) => [u, i]));

function vacio(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function hacerOrigen(fuente, rangoClave, pestana, a1) {
  const gid = fuente?.meta?.pestanas?.[pestana];
  return {
    archivo: fuente?.meta?.titulo || '',
    pestana,
    a1,
    url: fuente && !fuente.demo ? urlHoja(fuente.id, gid, a1) : null,
    rango: fuente ? ARCHIVOS[fuente.clave]?.rangos?.[rangoClave] : null,
  };
}

function urlFila(fuente, pestana, fila) {
  const gid = fuente?.meta?.pestanas?.[pestana];
  return fuente && !fuente.demo ? urlHoja(fuente.id, gid, `A${fila}:Z${fila}`) : null;
}

function urgenciaPorFecha(fechaIdx, hoyIdx) {
  if (fechaIdx === null || fechaIdx === undefined) return 'sin-fecha';
  return fechaIdx <= hoyIdx ? 'hoy' : 'proximo';
}

// ---------------------------------------------------------------- NayarSound

const REGLAS_EVENTO = [
  { id: 'buscar', texto: 'DJ por buscar', prueba: (e) => e.realizado === 'NO' && normalizar(e.dj) === 'BUSCAR' },
  { id: 'sin-dj', texto: 'Sin DJ', prueba: (e) => e.realizado === 'NO' && vacio(e.dj) },
  { id: 'sin-total', texto: 'Sin total del evento', prueba: (e) => vacio(e.total) },
  { id: 'sin-gas', texto: 'Sin gas a cobrar', prueba: (e) => normalizar(e.ciudad) === 'GUADALAJARA' && vacio(e.gas) },
];

function filasAgenda(fuente) {
  const filas = fuente?.rangos?.agenda;
  if (!filas) return { eventos: null, controles: [], encabezado: -1 };
  const inicio = inicioRango(ARCHIVOS.agenda.rangos.agenda);
  const encabezado = buscarFilaEncabezado(filas, ['CIUDAD', 'DJ', 'FECHA', 'REALIZADO']);
  if (encabezado < 0) return { eventos: null, controles: [], encabezado, error: 'No encontré los encabezados de AGENDA.' };
  const { registros, faltan } = tablaPorEncabezados(filas, encabezado, {
    ciudad: 'CIUDAD', dj: 'DJ', fecha: 'FECHA', tipo: 'TIPO EVENTO', inicio: 'INICIO DEL EVENTO',
    horas: 'TOT.HORAS', total: 'TOTAL EVENTO', gas: 'GAS A COBRAR', realizado: 'REALIZADO', op: 'OP',
  }, inicio);
  const eventos = registros
    .map((r) => ({ ...r, fila: filaPorOp(r, 12), idx: idxDesdeSerial(r.fecha), realizado: normalizar(r.realizado) }))
    .filter((r) => r.idx !== null);
  for (const e of eventos) {
    // Hora de término: inicio + TOT.HORAS (puede pasar de medianoche).
    e.inicioMin = minutosDeHora(e.inicio);
    e.hora = e.inicioMin !== null ? horaDesdeFraccion(e.inicioMin / 1440) : null;
    const horas = typeof e.horas === 'number' ? e.horas : Number(String(e.horas ?? '').replace(',', '.').trim() || NaN);
    e.finMin = e.inicioMin !== null && Number.isFinite(horas) && horas > 0 ? e.inicioMin + Math.round(horas * 60) : null;
    e.horaFin = e.finMin !== null ? horaDesdeFraccion((e.finMin % 1440) / 1440) : null;
    e.rango = e.hora ? (e.horaFin ? `${e.hora} a ${e.horaFin}` : e.hora) : null;
    e.banderas = REGLAS_EVENTO.filter((r) => r.prueba(e)).map((r) => ({ id: r.id, texto: r.texto }));
  }
  // Celdas de control (filas 9 a 11 de AGENDA) con su encabezado de la fila 12.
  const controles = [];
  const nombres = filas[encabezado] ?? [];
  for (let f = 0; f < encabezado; f++) {
    (filas[f] ?? []).forEach((valor, c) => {
      const control = leerControl(valor);
      if (!control) return;
      controles.push({
        ...control,
        a1: `${letraColumna(inicio.col + c)}${inicio.fila + f}`,
        columna: String(nombres[c] ?? '').trim(),
      });
    });
  }
  return { eventos, controles, faltan, encabezado };
}

// ---------------------------------------------------------------- Teléfonos de DJs

const ENC_TELEFONO = ['TELEFONO', 'TELEFONOS', 'TEL', 'CELULAR', 'CEL', 'WHATSAPP', 'NUMERO', 'NUMERO DE TELEFONO'];

/** Número para WhatsApp: solo dígitos; 10 dígitos se toman como de México (52). */
export function numeroWhatsApp(texto) {
  const d = String(texto ?? '').replace(/\D/g, '');
  if (d.length === 10) return `52${d}`;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

/**
 * Teléfonos de AMAL AGENDA › DATA: busca la fila con «NOMBRE» y una columna
 * de teléfono («TELEFONO», «CELULAR», «WHATSAPP»…) y los empareja por fila.
 * Devuelve { estado: 'ok'|'sin-columna'|'sin-datos', mapa, origen }.
 */
export function telefonosDjs(fuente) {
  const filas = fuente?.rangos?.djs;
  const vacio = (estado) => ({ estado, mapa: new Map(), url: fuente && !fuente.demo ? urlHoja(fuente.id, fuente.meta?.pestanas?.DATA) : null });
  if (!filas) return vacio('sin-datos');
  const inicio = inicioRango(ARCHIVOS.agenda.rangos.djs);
  for (let f = 0; f < filas.length; f++) {
    const enc = (filas[f] ?? []).map(normalizar);
    const cNombre = enc.indexOf('NOMBRE');
    if (cNombre < 0) continue;
    const cTel = enc.findIndex((e) => ENC_TELEFONO.includes(e));
    if (cTel < 0) return { ...vacio('sin-columna'), columna: letraColumna(inicio.col + cNombre + 1) };
    const mapa = new Map();
    for (let k = f + 1; k < filas.length; k++) {
      const nombre = normalizar(filas[k]?.[cNombre]);
      if (!nombre) continue;
      const texto = String(filas[k]?.[cTel] ?? '').trim();
      mapa.set(nombre, { numero: numeroWhatsApp(texto), texto, a1: `${letraColumna(inicio.col + cTel)}${inicio.fila + k}` });
    }
    return { ...vacio('ok'), mapa };
  }
  return vacio('sin-columna');
}

/** Minutos desde medianoche de una hora de la hoja: fracción de día o texto («16:30», «6:00 p.m.»). */
export function minutosDeHora(valor) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return Math.round((valor - Math.floor(valor)) * 1440) % 1440;
  const m = String(valor ?? '').trim().toLowerCase().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?\s*m?\.?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (m[3] === 'p' && h < 12) h += 12;
  if (m[3] === 'a' && h === 12) h = 0;
  return h < 24 && min < 60 ? h * 60 + min : null;
}

// La columna OP de tus hojas es el número de fila menos un desfase
// (AGENDA: ROW()-12; REGISTRO PRESTAMOS: ROW()-8). Si está, es la fila exacta.
function filaPorOp(registro, desfase) {
  return typeof registro.op === 'number' && Number.isInteger(registro.op) && registro.op > 0
    ? registro.op + desfase : registro.fila;
}

const ETIQUETA_BUSCAR = 'Eventos con DJ «buscar»';
const CONTROLES_OCULTOS = ['Eventos sin DJ', 'Orden de fechas en la agenda', 'Eventos sin hora de inicio'];

function etiquetaControl(c) {
  const col = normalizar(c.columna);
  const t = normalizar(c.texto);
  if (col === 'DJ' && t.includes('BUSCAR')) return ETIQUETA_BUSCAR;
  if (col === 'DJ' && t.includes('VACIO')) return 'Eventos sin DJ';
  if (col === 'FECHA') return 'Orden de fechas en la agenda';
  if (col === 'INICIO DEL EVENTO') return 'Eventos sin hora de inicio';
  if (col === 'TOTAL EVENTO') return 'Eventos sin total';
  if (col === 'GAS A COBRAR') return 'Guadalajara sin gas a cobrar';
  if (col === 'DJ' && t.includes('ERROR')) return 'Eventos realizados sin pago de DJ';
  return c.columna || 'Control';
}

function tablaVentas(fuente) {
  const filas = fuente?.rangos?.ventas;
  if (!filas) return null;
  const inicio = inicioRango(ARCHIVOS.nayarsound.rangos.ventas);
  const encabezado = buscarFilaEncabezado(filas, ['FECHA', 'PAGADO', 'ENTREGAR A OSVALDO']);
  if (encabezado < 0) return null;
  const { registros, indices } = tablaPorEncabezados(filas, encabezado, {
    dj: ['DJ', 1], fecha: 'FECHA', ciudad: 'CIUDAD', entregar: 'ENTREGAR A OSVALDO',
    total: 'TOTAL EVENTO', anticipo: 'ANTICIPO', gas: 'GAS A COBRAR', horas: 'TOT.HORAS', dia: 'DIA',
    pagado: 'PAGADO', pago: 'PAGO', pagoDj: ['DJ', 2], realizado: 'REALIZADO', op: 'OP', sonido: 'SONIDO DE',
    tipo: 'TIPO EVENTO', ganancia: 'GANANCIA', ganancia2: 'GANANCIA 2',
  }, inicio);
  const letra = (clave) => (indices[clave] >= 0 ? letraColumna(inicio.col + indices[clave]) : null);
  const columnas = { dj: letra('dj'), fecha: letra('fecha'), pagado: letra('pagado'), pago: letra('pago'), pagoDj: letra('pagoDj') };
  const controles = [];
  const nombres = filas[encabezado] ?? [];
  for (let f = 0; f < encabezado; f++) {
    (filas[f] ?? []).forEach((valor, c) => {
      const control = leerControl(valor);
      if (!control) return;
      controles.push({ ...control, a1: `${letraColumna(inicio.col + c)}${inicio.fila + f}`, columna: String(nombres[c] ?? '').trim() });
    });
  }
  return { registros: registros.map((r) => ({ ...r, fila: filaPorOp(r, 12), idx: idxDesdeSerial(r.fecha) })), controles, columnas };
}

const MESES_TEXTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const DIAS_TEXTO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const miles = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Mensaje «PAGOS PENDIENTES» con la misma fórmula de AGENDA Y VENTAS!I3:
 * filas DEUDOR del DJ; cobrado = TOTAL − ANTICIPO + GAS; total a enviar =
 * suma de ENTREGAR de los eventos con pago de DJ registrado. Los eventos de
 * lunes a jueves van en mayúsculas, como en la hoja.
 */
/**
 * «ENTREGAR A OSVALDO» con la fórmula de AGENDA Y VENTAS (columnas M, N y O)
 * para un pago al DJ dado. Sirve para la vista previa al editar el pago.
 *   Sonido de OSVALDO: total − anticipo − DJ (+ gas desde feb 2026).
 *   Otro sonido: total − anticipo − DJ − ganancia del socio, donde la
 *   ganancia es (total − DJ) y se divide entre 2 si el sonido es de JORGE o PAUL.
 */
export function entregarCon(r, pagoDj) {
  if (normalizar(r.realizado) !== 'SI') return null;
  const sonido = normalizar(r.sonido);
  const desdeFebrero = typeof r.fecha === 'number' && r.fecha >= idxDesdeYMD(2026, 2, 1) + 25569;
  const I = num(r.total); const J = num(r.anticipo); const K = num(r.gas); const L = num(pagoDj);
  if (sonido === 'OSVALDO') return desdeFebrero ? I - J - L + K : I - J - L;
  const ganancia = I - L;
  const socio = ganancia / (sonido === 'JORGE' || sonido === 'PAUL' ? 2 : 1);
  return I - J - L - socio;
}

export function mensajeDeuda(nombre, filas) {
  const bloques = filas.map((r) => {
    const idx = typeof r.fecha === 'number' ? Math.floor(r.fecha) - 25569 : null;
    const f = idx === null ? null : new Date(idx * 86400000);
    const fecha = f ? `${String(f.getUTCDate()).padStart(2, '0')}-${MESES_TEXTO[f.getUTCMonth()]}` : '';
    const dia = String(r.dia ?? '').trim() || (f ? DIAS_TEXTO[f.getUTCDay()] : '');
    const horas = vacio(r.horas) ? '' : `, ${r.horas}h`;
    const pagoDj = num(r.pagoDj);
    let bloque = `🎵 *${fecha} (${dia}${horas})*\n`;
    bloque += pagoDj <= 0 ? '⚠️ *NO HAY REGISTRO DE PAGO DEL DJ*'
      : `💵 $${miles.format(num(r.total) - num(r.anticipo) + num(r.gas))}\n➖ DJ: $${miles.format(pagoDj)}\n✅ Enviar: *$${miles.format(num(r.entregar))}*`;
    const semana = f ? ((f.getUTCDay() + 6) % 7) + 1 : 7; // WEEKDAY(fecha, 2): lunes = 1
    return semana <= 4 ? bloque.toUpperCase() : bloque;
  });
  const total = filas.filter((r) => num(r.pagoDj) > 0).reduce((t, r) => t + num(r.entregar), 0);
  return `*PAGOS PENDIENTES - ${nombre}*\n\n${bloques.join('\n\n')}\n\n━━━━━━━━━━━━━━\n💰 *TOTAL A ENVIAR: $${miles.format(total)}*`;
}

/**
 * ¿El evento ya se realizó? REALIZADO = SI en AMAL AGENDA, o ya pasó su hora
 * de término (inicio + TOT.HORAS) en Ciudad de México. Sin TOT.HORAS no se
 * puede saber la hora de término y solo cuenta REALIZADO.
 */
export function eventoTerminado(e, hoyIdx, minuto) {
  if (e.realizado === 'SI') return true;
  if (e.idx < hoyIdx) return true;
  return e.idx === hoyIdx && typeof minuto === 'number' && e.finMin !== null && e.finMin <= minuto;
}

export function modeloNayarsound({ nayarsound, agenda }, hoyIdx, minuto = null) {
  const avisos = [];
  const pendientes = [];
  const salida = { disponible: !!nayarsound?.rangos, avisos, pendientes, agenda: null, deuda: null, controles: [] };
  if (!nayarsound?.rangos) return salida;

  const dashboard = nayarsound.rangos.dashboard ?? [];
  const inicioDash = inicioRango(ARCHIVOS.nayarsound.rangos.dashboard);
  const datosAgenda = filasAgenda(agenda);
  if (agenda?.rangos && datosAgenda.error) avisos.push({ texto: datosAgenda.error, tipo: 'lectura' });
  if (datosAgenda.faltan?.length) {
    avisos.push({ texto: `En AMAL AGENDA faltan las columnas: ${datosAgenda.faltan.join(', ')}.`, tipo: 'lectura' });
  }

  // ---- Agenda (RECORDATORIOS)
  const celdaAgenda = textoBajoEncabezado(dashboard, 'RECORDATORIOS', inicioDash);
  const origenAgenda = hacerOrigen(nayarsound, 'dashboard', 'DASHBOARD', celdaAgenda.a1);
  if (!celdaAgenda.encontrado) {
    salida.agenda = { estado: 'no-encontrado', dias: [], origen: origenAgenda };
    avisos.push({ texto: 'No encontré el encabezado «RECORDATORIOS» en DASHBOARD.', tipo: 'lectura' });
  } else {
    const agendaLeida = leerAgenda(celdaAgenda.texto, hoyIdx);
    for (const dia of agendaLeida.dias) {
      const delDia = datosAgenda.eventos?.filter((e) => e.idx === dia.idx) ?? null;
      dia.diferencia = dia.idx - hoyIdx;
      for (const grupo of dia.ciudades) {
        for (const dj of grupo.djs) {
          dj.registros = delDia
            ? delDia.filter((e) => normalizar(e.dj) === normalizar(dj.nombre)
              && (normalizar(e.ciudad) === normalizar(grupo.ciudad) || (vacio(e.ciudad) && normalizar(grupo.ciudad) === 'SIN CIUDAD')))
              .map((e) => ({ ...e, url: urlFila(agenda, 'AGENDA', e.fila) }))
            : null;
          for (const e of dj.registros ?? []) e.terminado = eventoTerminado(e, hoyIdx, minuto);
          dj.horas = dj.registros ? dj.registros.map((e) => e.rango).filter(Boolean) : [];
          dj.banderas = dj.registros ? [...new Map(dj.registros.flatMap((e) => e.banderas).map((b) => [b.id, b])).values()] : [];
          if (dj.registros && dj.registros.length !== dj.eventos) {
            avisos.push({ texto: `No ubiqué en AMAL AGENDA todos los eventos de ${dj.nombre} (${grupo.ciudad}, ${fechaLarga(dia.idx)}).`, tipo: 'enlace' });
          }
          // Los eventos que ya se realizaron dejan de ser pendientes.
          const activos = dj.registros && dj.registros.length === dj.eventos ? dj.registros.filter((e) => !e.terminado) : null;
          dj.realizados = activos ? dj.registros.length - activos.length : 0;
          dia.realizados = (dia.realizados ?? 0) + dj.realizados;
          if (activos && !activos.length) continue;
          pendientes.push({
            id: `agenda|${dia.idx}|${normalizar(grupo.ciudad)}|${normalizar(dj.nombre)}`,
            negocio: 'NayarSound', tipo: 'agenda', grupo: `agenda|${dia.idx}`,
            titulo: dj.nombre, subtitulo: grupo.ciudad, ciudad: grupo.ciudad, marca: grupo.marca,
            fechaIdx: dia.idx, urgencia: urgenciaPorFecha(dia.idx, hoyIdx), eventos: activos ? activos.length : dj.eventos,
            horas: activos ? activos.map((e) => e.rango).filter(Boolean) : dj.horas,
            banderas: activos ? [...new Map(activos.flatMap((e) => e.banderas).map((b) => [b.id, b])).values()] : dj.banderas,
            registros: activos ?? dj.registros, origen: origenAgenda,
            linea: grupo.linea,
          });
        }
      }
      // Eventos del día sin DJ asignado: la hoja los cuenta pero no los lista.
      dia.sinDj = delDia ? delDia.filter((e) => vacio(e.dj)).map((e) => ({ ...e, url: urlFila(agenda, 'AGENDA', e.fila) })) : null;
      const cantidadSinDj = dia.eventosSinDj ?? 0;
      for (let i = 0; i < cantidadSinDj; i++) {
        const fila = dia.sinDj?.[i] ?? null;
        if (fila && eventoTerminado(fila, hoyIdx, minuto)) { dia.realizados = (dia.realizados ?? 0) + 1; continue; }
        pendientes.push({
          id: `agenda-sin-dj|${dia.idx}|${fila?.fila ?? i}`,
          negocio: 'NayarSound', tipo: 'agenda', grupo: `agenda|${dia.idx}`,
          titulo: 'Evento sin DJ asignado', subtitulo: fila?.ciudad ? String(fila.ciudad).trim() : 'Sin ciudad',
          ciudad: fila?.ciudad ?? '', fechaIdx: dia.idx, urgencia: urgenciaPorFecha(dia.idx, hoyIdx), eventos: 1,
          horas: fila?.rango ? [fila.rango] : [], banderas: fila?.banderas ?? [{ id: 'sin-dj', texto: 'Sin DJ' }],
          registros: fila ? [fila] : null, origen: origenAgenda, sinDj: true,
        });
      }
      if (!dia.cuadra) avisos.push({ texto: `El recordatorio de ${fechaLarga(dia.idx)} lista más DJs que eventos.`, tipo: 'formato' });
      if (dia.desfase !== null && dia.idx - dia.desfase !== hoyIdx) {
        avisos.push({ texto: `La hoja calcula «hoy» como ${fechaLarga(dia.idx - dia.desfase)}; en Ciudad de México hoy es ${fechaLarga(hoyIdx)}.`, tipo: 'zona' });
      }
    }
    for (const l of agendaLeida.noReconocidas) avisos.push({ texto: `Línea no reconocida en RECORDATORIOS: «${l}»`, tipo: 'formato' });
    salida.agenda = { ...agendaLeida, origen: origenAgenda, conRegistros: !!datosAgenda.eventos };
  }

  // ---- Recordatorio de deuda
  const celdaDeuda = textoBajoEncabezado(dashboard, 'RECORDATORIO DE DEUDA', inicioDash);
  const origenDeuda = hacerOrigen(nayarsound, 'dashboard', 'DASHBOARD', celdaDeuda.a1);
  const ventas = tablaVentas(nayarsound);
  salida.operacion = modeloOperacion(ventas?.registros ?? [], dashboard, hoyIdx);
  if (!celdaDeuda.encontrado) {
    salida.deuda = { estado: 'no-encontrado', personas: [], origen: origenDeuda };
    avisos.push({ texto: 'No encontré el encabezado «RECORDATORIO DE DEUDA» en DASHBOARD.', tipo: 'lectura' });
  } else {
    const deuda = leerDeuda(celdaDeuda.texto, hoyIdx);
    const deudores = ventas?.registros.filter((r) => normalizar(r.pagado) === 'DEUDOR') ?? null;
    for (const p of deuda.personas) {
      p.registros = deudores
        ? deudores.filter((r) => normalizar(r.dj) === normalizar(p.nombre))
          .map((r) => ({ ...r, url: urlFila(nayarsound, 'AGENDA Y VENTAS', r.fila), importe: numeroCelda(r.entregar) }))
        : null;
      if (p.registros && p.registros.length !== p.eventos) {
        avisos.push({ texto: `No ubiqué en AGENDA Y VENTAS todos los eventos que debe ${p.nombre}.`, tipo: 'enlace' });
      }
      pendientes.push({
        id: `deuda|${normalizar(p.nombre)}`,
        negocio: 'NayarSound', tipo: 'deuda', accion: 'COBRAR',
        titulo: p.nombre, subtitulo: `Debe ${p.eventos === 1 ? '1 evento' : `${p.eventos} eventos`}`,
        fechaIdx: null, urgencia: 'sin-fecha', eventos: p.eventos, monto: p.monto, moneda: 'MXN', decimales: 0,
        fechas: p.fechas, registros: p.registros, origen: origenDeuda, linea: p.lineas.join('\n'),
        mensaje: p.registros?.length ? mensajeDeuda(p.nombre, p.registros) : null,
        ciudades: [...new Set((p.registros ?? []).map((r) => String(r.ciudad ?? '').trim()).filter(Boolean))],
        pago: ventas?.columnas?.pago && !nayarsound.demo
          ? { archivo: nayarsound.id, pestana: 'AGENDA Y VENTAS', columnas: ventas.columnas } : null,
      });
    }
    if (deuda.cuadraTotal === false) {
      avisos.push({ texto: `En el recordatorio de deuda, la suma por persona (${dinero(deuda.suma, 0)}) no coincide con el total (${dinero(deuda.total, 0)}).`, tipo: 'formato' });
    }
    if (!deuda.cuadraFechas) avisos.push({ texto: 'En el recordatorio de deuda, el número de fechas no coincide con el de eventos.', tipo: 'formato' });
    for (const l of deuda.noReconocidas) avisos.push({ texto: `Línea no reconocida en RECORDATORIO DE DEUDA: «${l}»`, tipo: 'formato' });
    // Comprobación cruzada con «❌ FALTAN N DE PAGAR» (AGENDA Y VENTAS, columna PAGADO).
    const faltan = ventas?.controles.find((c) => normalizar(c.columna) === 'PAGADO');
    if (faltan && faltan.cantidad !== null && deuda.estado === 'ok') {
      const eventos = deuda.personas.reduce((s, p) => s + p.eventos, 0);
      deuda.cruce = { texto: faltan.texto, coincide: faltan.cantidad === eventos, eventos };
    }
    salida.deuda = { ...deuda, origen: origenDeuda };
  }

  // ---- Controles de captura (avisos, no pendientes)
  const controles = [
    ...datosAgenda.controles.map((c) => ({ ...c, fuente: agenda, pestana: 'AGENDA', rango: 'agenda' })),
    ...(ventas?.controles ?? [])
      .filter((c) => normalizar(c.columna) === 'DJ') // pago de DJ; PAGADO ya es el recordatorio de deuda
      .map((c) => ({ ...c, fuente: nayarsound, pestana: 'AGENDA Y VENTAS', rango: 'ventas' })),
  ];
  // Eventos con DJ «buscar» (misma regla que AGENDA!D9: REALIZADO = NO), de la fecha más cercana a la más lejana.
  const porBuscar = (datosAgenda.eventos ?? [])
    .filter((e) => e.banderas.some((b) => b.id === 'buscar'))
    .sort((a, b) => a.idx - b.idx || String(a.hora ?? '').localeCompare(String(b.hora ?? '')))
    .map((e) => ({
      idx: e.idx, ciudad: String(e.ciudad ?? '').trim(), hora: e.rango, tipo: String(e.tipo ?? '').trim(), fila: e.fila,
      origen: hacerOrigen(agenda, 'agenda', 'AGENDA', `D${e.fila}`),
    }));
  salida.controles = controles
    // Sin DJ, orden de fechas y hora de inicio los revisa tu equipo: no se muestran.
    .filter((c) => !CONTROLES_OCULTOS.includes(etiquetaControl(c)))
    .map((c) => {
      const etiqueta = etiquetaControl(c);
      return {
        estado: c.estado, texto: c.texto, cantidad: c.cantidad, etiqueta,
        origen: hacerOrigen(c.fuente, c.rango, c.pestana, c.a1),
        eventos: etiqueta === ETIQUETA_BUSCAR && datosAgenda.eventos ? porBuscar : null,
      };
    });
  return salida;
}

// ---------------------------------------------------------------- Préstamos

function tablaPrestamos(fuente, clave, encabezadosClave) {
  const filas = fuente?.rangos?.[clave];
  if (!filas) return null;
  const inicio = inicioRango(ARCHIVOS.prestamos.rangos[clave]);
  const encabezado = buscarFilaEncabezado(filas, encabezadosClave);
  if (encabezado < 0) return null;
  const { registros } = tablaPorEncabezados(filas, encabezado, {
    op: 'OP.', nombre: 'NOMBRE', divisa: 'DIVISA', capital: 'CANTIDAD', compromiso: 'FECHA COMPROMISO',
    estado: 'ESTADO', pagoMes: 'PAGO MES', dinamica: 'FECHA DINAMICA',
  }, inicio);
  // En REGISTRO PRESTAMOS, OP = fila − 8. En inversores OP es un conteo, no una fila.
  return clave === 'registro' ? registros.map((r) => ({ ...r, fila: filaPorOp(r, 8) })) : registros;
}

function tomarFila(candidatos, usadas) {
  const fila = candidatos.find((r) => !usadas.has(r.fila));
  if (fila) usadas.add(fila.fila);
  return fila ?? null;
}

// ---------------------------------------------------------------- Inversiones activas

const MESES_TXT = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DIC: 12 };

/** Fecha de una celda: número de serie, o texto «27 jul» / «27-jul» (año del AUXILIAR o el más cercano). */
function fechaCelda(v, hoyIdx, anio = null) {
  if (typeof v === 'number' && Number.isFinite(v)) return idxDesdeSerial(v);
  const m = normalizar(v).match(/^(\d{1,2})[\s\-/]+([A-Z]{3,4})/);
  if (!m || !MESES_TXT[m[2]]) return null;
  return anio ? idxDesdeYMD(anio, MESES_TXT[m[2]], Number(m[1])) : inferirFecha(Number(m[1]), MESES_TXT[m[2]], hoyIdx);
}

/** Fecha de pago número k (mensual) a partir del inicio; el día se ajusta al último del mes si no existe. */
function vencimiento(inicioIdx, k) {
  const { y, m, d } = ymdDesdeIdx(inicioIdx);
  const total = (m - 1) + k;
  const ya = y + Math.floor(total / 12); const ma = (total % 12) + 1;
  const ultimo = ymdDesdeIdx(idxDesdeYMD(ma === 12 ? ya + 1 : ya, ma === 12 ? 1 : ma + 1, 1) - 1).d;
  return idxDesdeYMD(ya, ma, Math.min(d, ultimo));
}

/**
 * Cada inversión ACTIVO de REGISTRO DE INVERSORES con:
 *  - liquidar: fecha compromiso y días que faltan (alerta si son 30 o menos).
 *  - pagoMes: estado del pago de intereses de este mes, según el registro de
 *    pagos de la misma hoja (columnas U:AA): pagos hechos vs. vencimientos
 *    mensuales desde la fecha de inicio.
 */
export function inversionesActivas(fuente, hoyIdx) {
  const filas = fuente?.rangos?.inversores;
  if (!filas?.length) return null;
  const inicio = inicioRango(ARCHIVOS.prestamos.rangos.inversores);
  const enc = buscarFilaEncabezado(filas, ['NOMBRE', 'ESTADO', 'PAGO MES']);
  if (enc < 0) return null;
  const { registros } = tablaPorEncabezados(filas, enc, {
    op: 'OP.', inicio: 'FECHA INICIO', nombre: 'NOMBRE', divisa: 'DIVISA', cantidad: 'CANTIDAD', tasa: 'INT/MES',
    compromiso: 'FECHA COMPROMISO', estado: 'ESTADO', pagoMes: 'PAGO MES',
  }, inicio);
  // Registro de pagos: segunda aparición de CANTIDAD / DIVISA / NOMBRE en la misma fila de encabezados.
  const h = (filas[enc] ?? []).map(normalizar);
  const cFecha = h.findIndex((x, i) => x === 'FECHA' && i > h.indexOf('ESTADO'));
  const pagos = [];
  if (cFecha > 0) {
    const cAux = h.indexOf('AUXILIAR', cFecha);
    for (let f = enc + 1; f < filas.length; f++) {
      const fila = filas[f] ?? [];
      const op = Number(fila[cFecha - 1]);
      const monto = typeof fila[cFecha + 1] === 'number' ? fila[cFecha + 1] : Number(String(fila[cFecha + 1] ?? '').replace(/[$,\s]/g, ''));
      if (!Number.isFinite(op) || op <= 0 || !Number.isFinite(monto)) continue;
      const aux = leerEtiquetaMes(String(fila[cAux] ?? '').trim());
      pagos.push({ op, idx: fechaCelda(fila[cFecha], hoyIdx, aux?.y ?? null), monto, divisa: normalizar(fila[cFecha + 3]) || 'MXN' });
    }
  }
  const hoy = ymdDesdeIdx(hoyIdx);
  const activos = registros.filter((r) => normalizar(r.estado) === 'ACTIVO' && !vacio(r.nombre));
  return activos.map((r) => {
    const op = Number(r.op);
    const divisa = normalizar(r.divisa) === 'USDT' ? 'USDT' : 'MXN';
    const cantidad = typeof r.cantidad === 'number' ? r.cantidad : null;
    const inicioIdx = fechaCelda(r.inicio, hoyIdx);
    const compromisoIdx = fechaCelda(r.compromiso, hoyIdx);
    const pagoMes = typeof r.pagoMes === 'number' ? r.pagoMes : null;
    const suyos = pagos.filter((p) => p.op === op).sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
    const dias = compromisoIdx === null ? null : compromisoIdx - hoyIdx;
    const item = {
      op, fila: r.fila, nombre: String(r.nombre).trim(), divisa, cantidad,
      capitalMXN: cantidad === null ? null : (divisa === 'USDT' ? cantidad * TIPO_CAMBIO_USDT : cantidad),
      tasa: typeof r.tasa === 'number' ? r.tasa : null, inicioIdx, compromisoIdx, diasLiquidar: dias,
      alertaLiquidar: dias !== null && dias <= 30, pagoMes, pagosHechos: suyos.length, ultimoPago: suyos.at(-1) ?? null,
    };
    // Estado del pago de este mes
    let pago;
    if (pagoMes === null) pago = { estado: 'sin-dato' };
    else if (pagoMes === 0) pago = { estado: 'sin-interes' };
    else if (inicioIdx === null) pago = { estado: 'sin-dato' };
    else {
      let k = 1;
      while (vencimiento(inicioIdx, k) < idxDesdeYMD(hoy.y, hoy.m, 1)) k++;
      const vence = vencimiento(inicioIdx, k);
      const esteMes = ymdDesdeIdx(vence).m === hoy.m && ymdDesdeIdx(vence).y === hoy.y;
      if (!esteMes) pago = { estado: 'sin-pago', idx: vence, monto: pagoMes, moneda: divisa };
      else if (suyos.length >= k) {
        const p = suyos.at(-1);
        pago = { estado: 'pagado', idx: p.idx, monto: p.monto, moneda: p.divisa === 'USDT' ? 'USDT' : 'MXN', vence };
      } else if (suyos.length < k - 1 || vence < hoyIdx) {
        pago = { estado: 'atrasado', idx: vence, monto: pagoMes, moneda: divisa, faltan: k - suyos.length };
      } else pago = { estado: 'pendiente', idx: vence, monto: pagoMes, moneda: divisa, dias: vence - hoyIdx };
    }
    item.pago = pago;
    return item;
  }).sort((a, b) => (a.compromisoIdx ?? Infinity) - (b.compromisoIdx ?? Infinity));
}

export function modeloPrestamos({ prestamos }, hoyIdx) {
  const avisos = [];
  const pendientes = [];
  const salida = { disponible: !!prestamos?.rangos, avisos, pendientes, cobrar: [], pagar: [], liquidaciones: [] };
  if (!prestamos?.rangos) return salida;
  const dashboard = prestamos.rangos.dashboard ?? [];
  salida.dashboard = leerDashboardPrestamos(dashboard, inicioRango(ARCHIVOS.prestamos.rangos.dashboard));
  salida.dashboard.url = !prestamos.demo ? urlHoja(prestamos.id, prestamos.meta?.pestanas?.DASHBOARD) : null;
  salida.inversiones = inversionesActivas(prestamos, hoyIdx);
  salida.inversionesUrl = !prestamos.demo ? urlHoja(prestamos.id, prestamos.meta?.pestanas?.['REGISTRO DE INVERSORES']) : null;
  const celda = textoBajoEncabezado(dashboard, 'RESUMEN GENERAL', inicioRango(ARCHIVOS.prestamos.rangos.dashboard));
  const origen = hacerOrigen(prestamos, 'dashboard', 'DASHBOARD', celda.a1);
  salida.origen = origen;
  if (!celda.encontrado) {
    salida.estado = 'no-encontrado';
    avisos.push({ texto: 'No encontré el encabezado «RESUMEN GENERAL» en DASHBOARD de préstamos.', tipo: 'lectura' });
    return salida;
  }
  const leido = leerPrestamos(celda.texto, hoyIdx);
  salida.estado = leido.estado;
  const registro = tablaPrestamos(prestamos, 'registro', ['NOMBRE', 'ESTADO', 'PAGO MES', 'FECHA COMPROMISO']);
  const inversores = tablaPrestamos(prestamos, 'inversores', ['NOMBRE', 'ESTADO', 'PAGO MES', 'FECHA DINAMICA']);
  const usadas = { registro: new Set(), inversores: new Set() };

  for (const dia of leido.dias) {
    if (dia.desfase !== null && dia.idx - dia.desfase !== hoyIdx) {
      avisos.push({ texto: `La hoja de préstamos calcula «hoy» como ${fechaLarga(dia.idx - dia.desfase)} (su zona horaria es ${prestamos.meta?.zona || 'otra'}); en Ciudad de México hoy es ${fechaLarga(hoyIdx)}.`, tipo: 'zona' });
    }
    for (const mov of dia.movimientos) {
      const item = {
        ...mov, fechaIdx: dia.idx, diferencia: dia.idx - hoyIdx, montoMXN: mov.monto, fila: null, url: null,
      };
      if (mov.accion === 'COBRAR' && registro) {
        const fila = tomarFila(registro.filter((r) => r.estado === 'ACTIVO'
          && idxDesdeSerial(r.compromiso) === dia.idx
          && normalizar(r.nombre) === normalizar(mov.nombre)
          && typeof r.pagoMes === 'number' && Math.round(r.pagoMes) === mov.monto), usadas.registro);
        if (fila) {
          Object.assign(item, { fila: fila.fila, op: fila.op, url: urlFila(prestamos, 'REGISTRO PRESTAMOS', fila.fila) });
          if (normalizar(fila.divisa) === 'USDT') {
            // La hoja escribe el pago en USDT con signo $; se convierte con la tasa del archivo.
            Object.assign(item, { moneda: 'USDT', usdt: mov.monto, montoMXN: mov.monto * TIPO_CAMBIO_USDT });
            avisos.push({ texto: `El cobro de ${mov.nombre} (op. ${fila.op}) es en USDT, pero el recordatorio lo muestra como $${mov.monto}. Se convierte a MXN con ${TIPO_CAMBIO_USDT}.`, tipo: 'moneda' });
          }
        }
      }
      if (mov.accion === 'PAGAR' && inversores) {
        const fila = tomarFila(inversores.filter((r) => r.estado === 'ACTIVO'
          && idxDesdeSerial(r.dinamica) === dia.idx
          && normalizar(r.nombre) === normalizar(mov.nombre)
          && typeof r.pagoMes === 'number'
          && (mov.usdt !== null
            ? normalizar(r.divisa) === 'USDT' && Math.round(r.pagoMes) === mov.usdt
            : normalizar(r.divisa) === 'MXN' && Math.round(r.pagoMes) === mov.monto)), usadas.inversores);
        if (fila) Object.assign(item, { fila: fila.fila, op: fila.op, url: urlFila(prestamos, 'REGISTRO DE INVERSORES', fila.fila) });
        if (mov.usdt !== null) item.moneda = 'USDT';
      }
      if (!item.fila && (registro || inversores)) {
        avisos.push({ texto: `No ubiqué la fila de ${mov.accion} · ${mov.nombre} (${fechaLarga(dia.idx)}).`, tipo: 'enlace' });
      }
      (mov.accion === 'COBRAR' ? salida.cobrar : salida.pagar).push(item);
      pendientes.push({
        id: `${mov.accion}|${normalizar(mov.nombre)}|${dia.idx}|${mov.monto}|${item.op ?? ''}`,
        negocio: 'Préstamos', tipo: mov.accion === 'COBRAR' ? 'cobrar' : 'pagar', accion: mov.accion,
        titulo: mov.nombre, subtitulo: mov.accion === 'COBRAR' ? 'Me debe pagar' : 'Debo pagar',
        fechaIdx: dia.idx, urgencia: urgenciaPorFecha(dia.idx, hoyIdx), monto: item.montoMXN, moneda: 'MXN',
        usdt: item.usdt, decimales: 0, op: item.op,
        registros: item.url ? [{ fila: item.fila, url: item.url }] : null, origen, linea: mov.linea,
      });
    }
  }
  for (const liq of leido.liquidaciones) {
    const item = { ...liq, fechaIdx: liq.idx, diferencia: liq.idx === null ? null : liq.idx - hoyIdx, fila: null, url: null };
    if (inversores) {
      const fila = tomarFila(inversores.filter((r) => r.estado === 'ACTIVO'
        && idxDesdeSerial(r.compromiso) === liq.idx && normalizar(r.nombre) === normalizar(liq.nombre)), new Set());
      if (fila) Object.assign(item, { fila: fila.fila, op: fila.op, url: urlFila(prestamos, 'REGISTRO DE INVERSORES', fila.fila) });
    }
    salida.liquidaciones.push(item);
    pendientes.push({
      id: `LIQUIDAR|${normalizar(liq.nombre)}|${liq.idx}|${liq.capital}`,
      negocio: 'Préstamos', tipo: 'liquidar', accion: 'PAGAR',
      titulo: liq.nombre, subtitulo: 'Liquidar capital a inversor',
      fechaIdx: liq.idx, urgencia: urgenciaPorFecha(liq.idx, hoyIdx), monto: liq.capital, moneda: 'MXN', decimales: 0,
      registros: item.url ? [{ fila: item.fila, url: item.url }] : null, origen, linea: liq.lineas.join('\n'),
    });
  }
  for (const l of leido.noReconocidas) avisos.push({ texto: `Línea no reconocida en RESUMEN GENERAL: «${l}»`, tipo: 'formato' });

  const suma = (lista, campo) => lista.reduce((s, x) => s + (x[campo] ?? 0), 0);
  salida.totales = {
    cobrarMXN: suma(salida.cobrar, 'montoMXN'),
    pagarMXN: suma(salida.pagar, 'montoMXN'),
    pagarUSDT: suma(salida.pagar.filter((p) => p.usdt !== null), 'usdt'),
    cobrarUSDT: suma(salida.cobrar.filter((p) => p.moneda === 'USDT'), 'usdt'),
    capitalMXN: suma(salida.liquidaciones, 'capital'),
  };
  return salida;
}

// ---------------------------------------------------------------- Finanzas

/** Importe de una celda: número, o texto como «$ 18,696.68», « $ -   » (cero) o «20730». */
function importe(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const t = String(v ?? '').trim();
  if (!t) return null;
  if (/^\$?\s*-\s*$/.test(t)) return 0;
  const limpio = t.replace(/[$\s,]/g, '');
  const n = Number(limpio);
  return limpio && Number.isFinite(n) ? n : NaN;
}

/**
 * Totales por año. Ganancia de cada negocio: tablas «GANANCIA MES …» de
 * ANALISIS BALANCE GENERAL (la misma fuente que suma tu tabla mensual).
 * Gastos y categorías: ANALISIS GASTOS PERSONALES por la columna AUX.
 */
function finanzasPorAnio(gastos, salida) {
  const filas = gastos.rangos.analisis;
  if (!filas?.length) return [];
  const fEnc = filas.findIndex((f) => (f ?? []).some((v) => normalizar(v) === 'MES'));
  if (fEnc < 0) return [];
  const tablas = [];
  (filas[fEnc] ?? []).forEach((v, c) => {
    if (normalizar(v) !== 'MES') return;
    let titulo = '';
    for (let k = fEnc - 1; k >= 0 && !titulo; k--) titulo = String(filas[k]?.[c] ?? '').trim();
    tablas.push({ c, nombre: normalizar(titulo).replace(/^GANANCIA (DEL )?MES\s*/, '') || `Columna ${letraColumna(c)}` });
  });
  // Mismo orden y nombres que la tabla mensual (NAYARSOUND, ST, …).
  const orden = salida.negocios.map(normalizar);
  tablas.sort((a, b) => (orden.indexOf(a.nombre) + 1 || 99) - (orden.indexOf(b.nombre) + 1 || 99));
  const anios = new Map();
  const delAnio = (y) => {
    if (!anios.has(y)) anios.set(y, { y, negocios: new Map(tablas.map((t) => [t.nombre, 0])), conDatos: false, sinNumero: 0, meses: new Set() });
    return anios.get(y);
  };
  for (let f = fEnc + 1; f < filas.length; f++) {
    for (const t of tablas) {
      const mes = leerEtiquetaMes(String(filas[f]?.[t.c] ?? '').trim());
      if (!mes) continue;
      const v = importe(filas[f]?.[t.c + 1]);
      if (v === null) continue;
      const a = delAnio(mes.y);
      if (Number.isNaN(v)) { a.sinNumero++; continue; }
      a.negocios.set(t.nombre, a.negocios.get(t.nombre) + v);
      a.conDatos = true;
      a.meses.add(mes.m);
    }
  }
  const registros = salida.gastosRegistros ?? [];
  const nombreDe = (n) => salida.negocios.find((x) => normalizar(x) === n) ?? capitalizarNombre(n);
  const resultado = [];
  for (const a of [...anios.values()].filter((x) => x.conDatos).sort((x, y) => x.y - y.y)) {
    const negocios = [...a.negocios].map(([n, valor]) => ({ nombre: nombreDe(n), valor: redondear(valor), estado: 'ok' }));
    const ganancia = redondear(negocios.reduce((t, n) => t + n.valor, 0));
    const delAnioG = registros.filter((r) => leerEtiquetaMes(String(r.mes).trim())?.y === a.y);
    const categorias = new Map();
    let totalGastos = 0;
    for (const r of delAnioG) {
      if (typeof r.cantidad !== 'number') continue;
      const nombre = nombreCategoria(r.motivo);
      const c = categorias.get(nombre) ?? { nombre, total: 0, registros: 0 };
      c.total += r.cantidad; c.registros += 1; totalGastos += r.cantidad;
      categorias.set(nombre, c);
    }
    const avisos = [];
    if (a.sinNumero) avisos.push(`${a.sinNumero} celda(s) de ganancia de ${a.y} en ANALISIS BALANCE GENERAL tienen texto y no se sumaron.`);
    const celda = (valor) => ({ valor, estado: 'ok', origen: null });
    const anio = {
      esAnio: true, y: a.y, etiqueta: String(a.y), negocios,
      ganancia: celda(ganancia), gastos: celda(redondear(totalGastos)), sobrante: celda(redondear(ganancia - totalGastos)),
      categorias: [...categorias.values()].sort((x, y) => y.total - x.total),
      registrosGastos: delAnioG.length, mesesConGanancia: a.meses.size, avisos,
    };
    // Comprobación con el resumen anual de tu hoja (AÑO / TOTAL GANANCIA / TOTAL GASTOS), si lo trae.
    const r = salida.resumenAnual?.find((x) => x.y === a.y);
    if (r) {
      anio.cuadraHoja = (r.ganancia === null || Math.abs(r.ganancia - ganancia) < 0.01) && (r.gastos === null || Math.abs(r.gastos - totalGastos) < 0.01);
      if (!anio.cuadraHoja) avisos.push(`Tu hoja marca para ${a.y} ganancia ${dinero(r.ganancia)} y gastos ${dinero(r.gastos)}; el panel suma ${dinero(ganancia)} y ${dinero(totalGastos)}.`);
    }
    resultado.push(anio);
  }
  return resultado;
}

/** Nombre único de una categoría: sin distinguir mayúsculas/acentos/espacios y con los sinónimos de CATEGORIAS_IGUALES. */
export function nombreCategoria(motivo) {
  if (vacio(motivo)) return 'Sin motivo';
  const n = normalizar(motivo);
  const equivalencias = Object.fromEntries(Object.entries(CATEGORIAS_IGUALES).map(([a, b]) => [normalizar(a), normalizar(b)]));
  return equivalencias[n] ?? n;
}

const redondear = (v) => Math.round(v * 100) / 100;
const capitalizarNombre = (n) => n;

/** Tabla «AÑO | TOTAL … | TOTAL GANANCIA | TOTAL GASTOS» de DASHBOARD BALANCE GENERAL. */
function resumenAnual(filas) {
  const f = filas.findIndex((x) => (x ?? []).some((v) => normalizar(v) === 'ANO') && (x ?? []).some((v) => normalizar(v) === 'TOTAL GANANCIA'));
  if (f < 0) return [];
  const enc = filas[f].map(normalizar);
  const cA = enc.indexOf('ANO'); const cG = enc.indexOf('TOTAL GANANCIA'); const cS = enc.indexOf('TOTAL GASTOS');
  const salida = [];
  for (let k = f + 1; k < filas.length; k++) {
    const y = Number(filas[k]?.[cA]);
    if (!Number.isInteger(y) || y < 2000) break;
    const num = (c) => { const v = c >= 0 ? importe(filas[k]?.[c]) : null; return typeof v === 'number' && !Number.isNaN(v) ? v : null; };
    salida.push({ y, ganancia: num(cG), gastos: num(cS) });
  }
  return salida;
}

export function modeloFinanzas({ gastos }, hoy) {
  const avisos = [];
  const salida = { disponible: !!gastos?.rangos, avisos, meses: [], negocios: [] };
  if (!gastos?.rangos) return salida;
  const filas = gastos.rangos.balance ?? [];
  const inicio = inicioRango(ARCHIVOS.gastos.rangos.balance);
  const enc = buscarFilaEncabezado(filas, ['MES', 'GANANCIA MENSUAL', 'GASTOS PERSONALES', 'SOBRANTE MENSUAL']);
  if (enc < 0) {
    avisos.push({ texto: 'No encontré la tabla MES / GANANCIA MENSUAL / GASTOS PERSONALES / SOBRANTE MENSUAL en DASHBOARD BALANCE GENERAL.', tipo: 'lectura' });
    salida.estado = 'no-encontrado';
    return salida;
  }
  const encabezados = (filas[enc] ?? []).map(normalizar);
  const colMes = encabezados.indexOf('MES');
  const colGanancia = encabezados.indexOf('GANANCIA MENSUAL');
  const colGastos = encabezados.indexOf('GASTOS PERSONALES');
  const colSobrante = encabezados.indexOf('SOBRANTE MENSUAL');
  // Las columnas entre MES y GANANCIA MENSUAL son los negocios (NAYARSOUND, ST, ...).
  const negocios = [];
  for (let c = colMes + 1; c < colGanancia; c++) {
    if (!vacio(filas[enc][c])) negocios.push({ col: c, nombre: String(filas[enc][c]).trim() });
  }
  salida.negocios = negocios.map((n) => n.nombre);
  const pestana = 'DASHBOARD BALANCE GENERAL';
  const a1 = (fila, col) => `${letraColumna(inicio.col + col)}${fila}`;
  for (let f = enc + 1; f < filas.length; f++) {
    const fila = filas[f] ?? [];
    if (vacio(fila[colMes])) break;
    const filaHoja = inicio.fila + f;
    const mes = leerEtiquetaMes(fila[colMes]);
    const celda = (col) => ({ ...numeroCelda(fila[col]), origen: hacerOrigen(gastos, 'balance', pestana, a1(filaHoja, col)) });
    const registro = {
      etiqueta: String(fila[colMes]).trim(), y: mes?.y ?? null, m: mes?.m ?? null, fila: filaHoja,
      negocios: negocios.map((n) => ({ nombre: n.nombre, ...celda(n.col) })),
      ganancia: celda(colGanancia), gastos: celda(colGastos), sobrante: celda(colSobrante),
      avisos: [],
    };
    const { ganancia: g, gastos: s, sobrante: r } = registro;
    if (g.valor !== null && s.valor !== null && r.valor !== null && Math.abs(g.valor - s.valor - r.valor) > 0.005) {
      registro.avisos.push(`El sobrante (${dinero(r.valor)}) no es ganancia − gastos (${dinero(g.valor - s.valor)}).`);
    }
    const sumaNegocios = registro.negocios.reduce((t, n) => t + (n.valor ?? 0), 0);
    if (g.valor !== null && registro.negocios.every((n) => n.valor !== null) && Math.abs(sumaNegocios - g.valor) > 0.005) {
      registro.avisos.push(`La ganancia (${dinero(g.valor)}) no es la suma de los negocios (${dinero(sumaNegocios)}).`);
    }
    for (const [nombre, c] of [['Ganancia', g], ['Gastos', s], ['Sobrante', r], ...registro.negocios.map((n) => [n.nombre, n])]) {
      if (c.estado === 'error') registro.avisos.push(`${nombre}: la celda muestra ${c.texto}.`);
      if (c.estado === 'vacia') registro.avisos.push(`${nombre}: celda vacía (no se muestra como cero).`);
      if (c.estado === 'texto') registro.avisos.push(`${nombre}: la celda tiene texto («${c.texto}»), no un número.`);
    }
    salida.meses.push(registro);
  }
  const actual = etiquetaMes(hoy.y, hoy.m);
  salida.indiceActual = salida.meses.findIndex((m) => normalizar(m.etiqueta) === normalizar(actual));
  if (salida.indiceActual < 0 && salida.meses.length) {
    avisos.push({ texto: `La tabla mensual de tu hoja no incluye ${actual}. Se muestra el último mes disponible.`, tipo: 'mes' });
  }

  // Detalle de gastos por categoría (MOTIVO) — misma regla que la hoja:
  // SUMIF de CANTIDAD donde AUX = mes; los montos con texto no se suman.
  const filasGastos = gastos.rangos.gastos ?? [];
  const inicioG = inicioRango(ARCHIVOS.gastos.rangos.gastos);
  const encG = buscarFilaEncabezado(filasGastos, ['CANTIDAD', 'MOTIVO', 'AUX']);
  if (encG >= 0) {
    const { registros } = tablaPorEncabezados(filasGastos, encG, {
      fecha: 'FECHA', cantidad: 'CANTIDAD', motivo: 'MOTIVO', con: 'GASTADO CON', mes: 'AUX',
    }, inicioG);
    salida.gastosRegistros = registros;
    for (const mes of salida.meses) {
      const clave = mes.etiqueta.toUpperCase();
      const delMes = registros.filter((r) => String(r.mes).toUpperCase() === clave);
      const casi = registros.filter((r) => String(r.mes).toUpperCase() !== clave && normalizar(r.mes) === normalizar(mes.etiqueta));
      const sinNumero = delMes.filter((r) => typeof r.cantidad !== 'number');
      const categorias = new Map();
      for (const r of delMes) {
        if (typeof r.cantidad !== 'number') continue;
        const nombre = nombreCategoria(r.motivo);
        const c = categorias.get(nombre) ?? { nombre, total: 0, registros: 0 };
        c.total += r.cantidad; c.registros += 1;
        categorias.set(nombre, c);
      }
      mes.categorias = [...categorias.values()].sort((a, b) => b.total - a.total);
      mes.registrosGastos = delMes.length;
      const sumaCat = mes.categorias.reduce((t, c) => t + c.total, 0);
      mes.gastosCuadran = mes.gastos.valor === null ? null : Math.abs(sumaCat - mes.gastos.valor) < 0.005;
      if (mes.gastosCuadran === false) {
        mes.avisos.push(`Las categorías suman ${dinero(sumaCat)} y la hoja muestra ${dinero(mes.gastos.valor)} de gastos.`);
      }
      if (sinNumero.length) mes.avisos.push(`${sinNumero.length} gasto(s) de este mes tienen texto en CANTIDAD y tu hoja no los suma.`);
      if (casi.length) mes.avisos.push(`${casi.length} gasto(s) tienen el mes escrito con espacios o acentos distintos y tu hoja no los suma.`);
    }
  } else {
    avisos.push({ texto: 'No encontré los encabezados CANTIDAD / MOTIVO / AUX en ANALISIS GASTOS PERSONALES; no hay desglose por categoría.', tipo: 'lectura' });
  }
  salida.resumenAnual = resumenAnual(filas);
  salida.anios = finanzasPorAnio(gastos, salida);
  return salida;
}

// ---------------------------------------------------------------- Inicio

export function ordenarPendientes(lista) {
  return [...lista].sort((a, b) => (RANGO_URGENCIA[a.urgencia] - RANGO_URGENCIA[b.urgencia])
    || ((a.fechaIdx ?? Infinity) - (b.fechaIdx ?? Infinity))
    || ((b.monto ?? 0) - (a.monto ?? 0))
    || String(a.titulo).localeCompare(String(b.titulo), 'es'));
}

export function construirModelo(fuentes, hoy) {
  const nayarsound = modeloNayarsound(fuentes, hoy.idx, hoy.minuto ?? null);
  nayarsound.telefonos = telefonosDjs(fuentes.agenda);
  const prestamos = modeloPrestamos(fuentes, hoy.idx);
  const finanzas = modeloFinanzas(fuentes, hoy);
  const st = modeloST(fuentes.st, hoy);
  if (st.disponible) st.url = fuentes.st.demo ? null : urlHoja(fuentes.st.id, fuentes.st.meta?.pestanas?.DASHBOARD);
  if (st.disponible) st.urlVentas = fuentes.st.demo ? null : urlHoja(fuentes.st.id, fuentes.st.meta?.pestanas?.['HOJA DE VENTAS']);

  // Un pendiente = una acción concreta; si se repite (misma clave), cuenta una vez.
  const unicos = new Map();
  let duplicados = 0;
  for (const p of [...nayarsound.pendientes, ...prestamos.pendientes]) {
    if (unicos.has(p.id)) { duplicados += 1; continue; }
    unicos.set(p.id, p);
  }
  const pendientes = ordenarPendientes([...unicos.values()]);
  const conteo = Object.fromEntries(URGENCIAS.map((u) => [u, 0]));
  for (const p of pendientes) conteo[p.urgencia] += 1;

  const dias = nayarsound.agenda?.dias ?? [];
  const eventosDe = (idx) => dias.find((d) => d.idx === idx)?.eventos ?? 0;
  const mesActual = finanzas.indiceActual >= 0 ? finanzas.meses[finanzas.indiceActual]
    : finanzas.meses[finanzas.meses.length - 1] ?? null;

  return {
    hoy,
    pendientes,
    conteo,
    duplicados,
    eventos: { hoy: eventosDe(hoy.idx), manana: eventosDe(hoy.idx + 1), agendaDisponible: !!nayarsound.agenda },
    mesActual,
    nayarsound,
    prestamos,
    finanzas,
    st,
  };
}
