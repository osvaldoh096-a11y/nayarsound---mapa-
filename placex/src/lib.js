import { store } from './config/store.js'

// Ruta de un archivo de public/ que funciona en localhost y en una subcarpeta
// publicada (p. ej. GitHub Pages). Acepta '/products/foto.jpg' o 'products/foto.jpg'.
export function assetUrl(path) {
  if (/^(https?:|data:)/.test(path)) return path
  return import.meta.env.BASE_URL + String(path).replace(/^\/+/, '')
}

const numberFormat = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 })

export function formatPrice(amount) {
  return `$${numberFormat.format(amount)} ${store.currency}`
}

export function productUrl(product) {
  const base = store.siteUrl
    ? store.siteUrl.replace(/\/+$/, '') + '/'
    : window.location.origin + window.location.pathname
  return `${base}#/producto/${product.id}`
}

export function paymentMethodsText() {
  return store.paymentMethods.map((m) => m.charAt(0).toLowerCase() + m.slice(1)).join(' o ')
}

export function buildOrderMessage(product, size, quantity) {
  const lines = [
    `Hola, quiero pedir en ${store.name}:`,
    `Producto: ${product.name} (${product.code})`,
    `Talla: ${size}`,
    `Cantidad: ${quantity}`,
    `Precio unitario: ${formatPrice(product.price)}`,
    `Total: ${formatPrice(product.price * quantity)}`,
  ]
  if (store.shippingNote) lines.push(`${store.shippingNote}.`)
  if (store.paymentMethods.length) lines.push(`Métodos de pago disponibles: ${paymentMethodsText()}.`)
  lines.push(store.whatsappClosing)
  lines.push(`Producto: ${productUrl(product)}`)
  return lines.join('\n')
}

export function whatsappLink(message) {
  const number = String(store.whatsappNumber || '').replace(/\D/g, '')
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export const whatsappConfigured = () =>
  String(store.whatsappNumber || '').replace(/\D/g, '').length >= 10

// Precio común del catálogo, o null si los productos tienen precios distintos.
export function uniformPrice(products) {
  const prices = new Set(products.map((p) => p.price))
  return prices.size === 1 ? [...prices][0] : null
}

// ---------- Promoción ----------

// Diferencia (ms) entre la hora local de `timeZone` y UTC en el instante `date`.
function zoneOffset(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  )
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

// Convierte 'AAAA-MM-DDTHH:MM' (hora de `timeZone`) a milisegundos UTC.
export function parseZonedDate(value, timeZone) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const naive = Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6] || 0)
  let utc = naive - zoneOffset(new Date(naive), timeZone)
  utc = naive - zoneOffset(new Date(utc), timeZone)
  return utc
}

export const promoEndsAt = parseZonedDate(store.promo.endsAt, store.promo.timeZone)

if (store.promo.endsAt && promoEndsAt === null) {
  console.warn(`PLACEX: promo.endsAt "${store.promo.endsAt}" no tiene el formato AAAA-MM-DDTHH:MM`)
}

const dayKey = (ms, timeZone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms)

// Etiqueta de urgencia: "Solo por hoy" únicamente si termina hoy (hora de CDMX).
export function promoLabel(now) {
  const { timeZone, todayLabel } = store.promo
  if (dayKey(now, timeZone) === dayKey(promoEndsAt, timeZone)) return todayLabel
  const date = new Intl.DateTimeFormat('es-MX', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(promoEndsAt)
  return `Termina el ${date}`
}

export function splitRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}
