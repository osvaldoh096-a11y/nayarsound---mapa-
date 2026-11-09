// Lectura de Google Sheets con la API oficial y el token de tu sesión de
// Google. Funciona con hojas privadas: Google solo entrega datos a cuentas
// con acceso al archivo. Escrituras: escribirCelda (pagos, pago al DJ) y las
// de la lista de tareas (agregarFila, escribirRango, borrarRango).

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export class ErrorLectura extends Error {
  constructor(mensaje, tipo = 'lectura') {
    super(mensaje);
    this.tipo = tipo;
  }
}

/** Varios rangos de un archivo, con números sin formato y fechas como número de serie. */
export async function leerRangos(token, id, rangos, { modo = 'UNFORMATTED_VALUE' } = {}) {
  const params = new URLSearchParams({
    valueRenderOption: modo,
    dateTimeRenderOption: 'SERIAL_NUMBER',
    majorDimension: 'ROWS',
  });
  for (const r of rangos) params.append('ranges', r);
  let respuesta;
  try {
    respuesta = await fetch(`${API}/${encodeURIComponent(id)}/values:batchGet?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ErrorLectura('Sin conexión con Google Sheets. Revisa tu internet.', 'red');
  }
  if (respuesta.ok) return ((await respuesta.json()).valueRanges ?? []).map((v) => v.values ?? []);
  return lanzarError(respuesta);
}

async function pedir(token, url, metodo, cuerpo) {
  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorLectura('Sin conexión con Google Sheets. Revisa tu internet.', 'red');
  }
  if (respuesta.ok) return respuesta.json().catch(() => ({}));
  return lanzarError(respuesta);
}

/** Escribe un valor en una sola celda, como si lo teclearas. */
export async function escribirCelda(token, id, celda, valor) {
  await escribirRango(token, id, celda, [[valor]], { entrada: 'USER_ENTERED' });
  return true;
}

/** Escribe una cuadrícula de valores. RAW: el texto se guarda tal cual (sin fórmulas). */
export function escribirRango(token, id, rango, valores, { entrada = 'RAW' } = {}) {
  const params = new URLSearchParams({ valueInputOption: entrada });
  return pedir(token, `${API}/${encodeURIComponent(id)}/values/${encodeURIComponent(rango)}?${params}`, 'PUT',
    { range: rango, majorDimension: 'ROWS', values: valores });
}

/** Agrega una fila al final de una tabla. Devuelve el número de fila escrita (o null). */
export async function agregarFila(token, id, rango, fila, { entrada = 'RAW', texto = [] } = {}) {
  const params = new URLSearchParams({ valueInputOption: entrada, insertDataOption: 'INSERT_ROWS' });
  // Con USER_ENTERED, las columnas de texto llevan ' para que nunca se lean como fórmula.
  const valores = entrada === 'USER_ENTERED' ? fila.map((v, i) => (texto.includes(i) && v !== '' ? `'${v}` : v)) : fila;
  const r = await pedir(token, `${API}/${encodeURIComponent(id)}/values/${encodeURIComponent(rango)}:append?${params}`, 'POST',
    { majorDimension: 'ROWS', values: [valores] });
  const m = String(r?.updates?.updatedRange ?? '').match(/![A-Z]+(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Vacía un rango (no borra la fila de la hoja). */
export function borrarRango(token, id, rango) {
  return pedir(token, `${API}/${encodeURIComponent(id)}/values/${encodeURIComponent(rango)}:clear`, 'POST', {});
}

async function lanzarError(respuesta) {
  let detalle = '';
  try { detalle = (await respuesta.json())?.error?.message ?? ''; } catch { /* sin cuerpo */ }
  const s = respuesta.status;
  if (s === 401) throw new ErrorLectura('La sesión de Google expiró. Toca «Actualizar» para entrar de nuevo.', 'sesion');
  if (s === 403) throw new ErrorLectura('Tu cuenta de Google no tiene permiso para esto. Toca «Cerrar sesión» en ⚙ y vuelve a entrar para aceptar el permiso nuevo.', 'permiso');
  if (s === 404) throw new ErrorLectura('No encontré el archivo.', 'archivo');
  if (s === 400) throw new ErrorLectura(`Rango no válido: ¿cambió el nombre de una pestaña? ${detalle}`.trim(), 'rango');
  if (s === 429) throw new ErrorLectura('Google limitó las lecturas por un momento. Intenta en un minuto.', 'limite');
  throw new ErrorLectura(`Error ${s} de Google Sheets. ${detalle}`.trim());
}
