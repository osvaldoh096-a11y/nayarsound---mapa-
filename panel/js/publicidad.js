// Gasto de hoy en anuncios (Meta) por cuenta de NayarSound, desde tu API en
// Vercel. El enlace lleva una clave: se guarda solo en este navegador (no va
// en el código publicado).

/** Enlace válido de la API, siempre pidiendo JSON. Devuelve null si no lo es. */
export function normalizarEnlaceGasto(texto) {
  let u;
  try { u = new URL(String(texto ?? '').trim()); } catch { return null; }
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.vercel.app') || !u.searchParams.get('key')) return null;
  u.searchParams.set('format', 'json');
  return u.toString();
}

/** { cuentas: [{ nombre, gasto, moneda }], total, moneda, actualizado } */
export async function leerGasto(enlace) {
  const url = new URL(enlace);
  url.searchParams.set('_', String(Date.now()));
  let r;
  try {
    r = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new Error('Sin conexión con la API de gasto.');
  }
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'La clave del enlace no es válida.' : `La API de gasto respondió ${r.status}.`);
  const d = await r.json();
  if (!Array.isArray(d?.cuentas) || typeof d?.total !== 'number') throw new Error('La API de gasto respondió algo que no reconozco.');
  return d;
}
