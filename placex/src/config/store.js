// ============================================================
//  CONFIGURACIÓN GENERAL DE LA TIENDA PLACEX
//  Edita aquí el número de WhatsApp y los textos generales.
// ============================================================

export const store = {
  name: 'PLACEX',
  tagline: 'Tentación · Deseo · Placer',

  // Número de WhatsApp Business en formato internacional, SOLO dígitos,
  // sin "+", espacios ni guiones. México: 52 + 10 dígitos.
  // Ejemplo de formato (no es un número real): '523300000000'
  // PENDIENTE: mientras esté vacío, WhatsApp se abrirá sin destinatario.
  whatsappNumber: '',

  // URL pública de la tienda para el enlace del producto en el mensaje.
  // Déjalo vacío para usar la dirección actual (p. ej. http://localhost:3000).
  // Al publicar, pon aquí tu dominio: 'https://www.tudominio.com'
  siteUrl: '',

  currency: 'MXN',

  // Si el precio incluye envío. Se muestra en fichas y en el mensaje.
  shippingIncluded: true,

  // Cantidad máxima que se puede pedir de un producto en un mismo mensaje.
  maxQuantity: 10,

  // Texto mientras no haya condiciones de entrega definitivas.
  deliveryNote: 'Confirma tu entrega por WhatsApp',

  // Aviso opcional en una franja superior (p. ej. campaña de Halloween).
  // Déjalo vacío ('') para ocultarlo.
  announcement: '',

  // Pregunta final del mensaje de WhatsApp.
  whatsappClosing: '¿Me confirmas disponibilidad y fecha de entrega?',

  // Aviso de edad en el pie de página.
  ageNotice: 'Productos para personas mayores de 18 años.',
}
