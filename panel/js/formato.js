// Formato de dinero (pesos mexicanos) y utilidades de texto.

const mxn2 = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const mxn0 = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const entero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

// Modo privado: los importes se muestran como asteriscos (para enseñar el panel).
let privado = false;
export const OCULTO = '$*****';
export function fijarPrivado(valor) { privado = !!valor; }
export function esPrivado() { return privado; }

/** Oculta los importes dentro de un texto de la hoja ("$2,900", "$12.000", "87 USDT"). */
export function ocultarImportes(texto) {
  const t = String(texto ?? '');
  if (!privado) return t;
  return t.replace(/-?\$\s*-?[\d][\d.,]*/g, OCULTO).replace(/[\d][\d.,]*\s*USDT/gi, '***** USDT');
}

/** $4,853.32 — decimales: 2 (cifras de la hoja) o 0 (montos que la hoja ya redondea). */
export function dinero(valor, decimales = 2) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
  if (privado) return OCULTO;
  const texto = (decimales === 0 ? mxn0 : mxn2).format(valor);
  return texto.replace(/^MX/, '');
}

export function numero(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
  return entero.format(valor);
}

export function monto(valor, moneda = 'MXN', decimales = 2) {
  if (moneda === 'USDT') return privado ? '***** USDT' : `${numero(valor)} USDT`;
  return dinero(valor, decimales);
}

/**
 * Los recordatorios usan TEXT(x,"#,##0"), a veces con "." como separador de
 * miles ("$12.000"). Siempre son enteros: se quitan los separadores.
 */
export function leerMontoTexto(texto) {
  const t = String(texto ?? '').trim();
  const m = t.match(/(-?)\$?\s*(-?)([\d.,]+)/);
  if (!m) return null;
  const digitos = m[3].replace(/[.,]/g, '');
  if (!digitos) return null;
  const n = Number(digitos);
  return (m[1] || m[2]) ? -n : n;
}

export function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

export function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function capitalizar(texto) {
  const t = String(texto ?? '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
