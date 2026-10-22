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

// Ahorro por pieza frente al precio regular (0 si no hay precio tachado).
export const savingsOf = (product) => Math.max(0, (product.compareAtPrice || 0) - product.price)
export const discountPct = (product) =>
  product.compareAtPrice > product.price ? Math.round((savingsOf(product) / product.compareAtPrice) * 100) : 0

// Rellena {ahorro} y {pct} en un texto de `store.pricing`.
export const pricingText = (template, product, quantity = 1) =>
  template
    .replaceAll('{ahorro}', formatPrice(savingsOf(product) * quantity))
    .replaceAll('{pct}', String(discountPct(product)))

export function paymentMethodsText() {
  return store.paymentMethods.map((m) => m.charAt(0).toLowerCase() + m.slice(1)).join(' o ')
}

export function buildOrderMessage(product, size, quantity) {
  const lines = [
    `Hola, quiero pedir en ${store.name}:`,
    `Producto: ${product.name} (${product.code})`,
    `Talla: ${size}`,
    `Cantidad: ${quantity}`,
  ]
  if (savingsOf(product)) {
    lines.push(`Precio regular: ${formatPrice(product.compareAtPrice)}`)
    lines.push(`Precio de promoción: ${formatPrice(product.price)}`)
  } else {
    lines.push(`Precio unitario: ${formatPrice(product.price)}`)
  }
  lines.push(`Total: ${formatPrice(product.price * quantity)}`)
  if (savingsOf(product)) lines.push(`Ahorro: ${formatPrice(savingsOf(product) * quantity)}`)
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

const { lastDay, timeZone, cycle } = store.promo

// Fecha 'AAAA-MM-DD' desplazada `days` días (aritmética de calendario, sin horas).
const shiftDay = (day, days) => {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5)
const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '')

const cycleOn = Boolean(cycle?.enabled) && isDay(cycle.firstLastDay)
const validDay = isDay(lastDay)
if (lastDay && !validDay) console.warn(`PLACEX: promo.lastDay "${lastDay}" no tiene el formato AAAA-MM-DD`)
if (cycle?.enabled && !cycleOn) console.warn('PLACEX: promo.cycle.firstLastDay debe tener el formato AAAA-MM-DD')

// Medianoche de CDMX al terminar el día `day`.
const midnightAfter = (day) => parseZonedDate(`${shiftDay(day, 1)}T00:00`, timeZone)

// Fin de la promoción con fecha fija (sin ciclo).
const fixedEndsAt = validDay ? midnightAfter(lastDay) : null

// Fecha de hoy en CDMX como 'AAAA-MM-DD'.
export const todayIn = (ms) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms)

// true si la promoción puede seguir mostrando algo después de `now`.
export const promoRunning = (now) => cycleOn || (fixedEndsAt !== null && now < fixedEndsAt)

// Etapa en el instante `now` ('last', 'dayBefore', 'earlier' o null) y su fin.
export function promoState(now) {
  const today = todayIn(now)
  if (cycleOn) {
    const n = daysBetween(cycle.firstLastDay, today)
    if (n < 0) return { stage: null }
    return n % 2 === 0 ? { stage: 'last', endsAt: midnightAfter(today) } : { stage: 'dayBefore' }
  }
  if (fixedEndsAt === null || now >= fixedEndsAt) return { stage: null }
  if (today === lastDay) return { stage: 'last', endsAt: fixedEndsAt }
  if (today === shiftDay(lastDay, -1)) return { stage: 'dayBefore' }
  return { stage: 'earlier' }
}

export const promoEndDateText = () =>
  validDay
    ? new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(
        new Date(`${lastDay}T12:00:00Z`)
      )
    : ''

// Diferencia entre la hora del servidor y la del dispositivo, para que el
// contador sea igual aunque el reloj del celular esté adelantado o atrasado.
export async function fetchClockOffset() {
  try {
    const sent = Date.now()
    const res = await fetch(window.location.pathname, { method: 'HEAD', cache: 'no-store' })
    const received = Date.now()
    const server = Date.parse(res.headers.get('date'))
    if (Number.isNaN(server)) return 0
    // El encabezado Date tiene resolución de 1 s: se toma la mitad del segundo.
    return server + 500 - (sent + received) / 2
  } catch {
    return 0
  }
}

// Tiempo restante como HH:MM:SS (las horas pueden pasar de 24).
export function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const pad = (n) => String(n).padStart(2, '0')
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60].map(pad).join(':')
}
