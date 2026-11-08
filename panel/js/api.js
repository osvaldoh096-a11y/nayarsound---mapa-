// Lectura de Google Sheets con la API oficial y el token de tu sesión de
// Google. Funciona con hojas privadas: Google solo entrega datos a cuentas
// con acceso al archivo. Solo lectura: no se llama a ningún método que escriba.

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export class ErrorLectura extends Error {
  constructor(mensaje, tipo = 'lectura') {
    super(mensaje);
    this.tipo = tipo;
  }
}

/** Varios rangos de un archivo, con números sin formato y fechas como número de serie. */
export async function leerRangos(token, id, rangos) {
  const params = new URLSearchParams({
    valueRenderOption: 'UNFORMATTED_VALUE',
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
  let detalle = '';
  try { detalle = (await respuesta.json())?.error?.message ?? ''; } catch { /* sin cuerpo */ }
  const s = respuesta.status;
  if (s === 401) throw new ErrorLectura('La sesión de Google expiró. Toca «Actualizar» para entrar de nuevo.', 'sesion');
  if (s === 403) throw new ErrorLectura('Tu cuenta de Google no tiene acceso a este archivo, o falta habilitar la API de Google Sheets.', 'permiso');
  if (s === 404) throw new ErrorLectura('No encontré el archivo.', 'archivo');
  if (s === 400) throw new ErrorLectura(`Rango no válido: ¿cambió el nombre de una pestaña? ${detalle}`.trim(), 'rango');
  if (s === 429) throw new ErrorLectura('Google limitó las lecturas por un momento. Intenta en un minuto.', 'limite');
  throw new ErrorLectura(`Error ${s} de Google Sheets. ${detalle}`.trim());
}
