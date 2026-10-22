import { store } from './config/store.js'

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

export function buildOrderMessage(product, size, quantity) {
  const lines = [
    `Hola, quiero pedir en ${store.name}:`,
    `Producto: ${product.name} (${product.code})`,
    `Talla: ${size}`,
    `Cantidad: ${quantity}`,
    `Precio unitario: ${formatPrice(product.price)}`,
    `Total: ${formatPrice(product.price * quantity)}`,
  ]
  if (store.shippingIncluded) lines.push('Envío incluido.')
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
