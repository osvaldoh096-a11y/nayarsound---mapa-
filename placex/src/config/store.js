// ============================================================
//  CONFIGURACIÓN GENERAL DE LA TIENDA PLACEX
//  Edita aquí el número de WhatsApp, la promoción y los textos generales.
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

  // Texto de envío en catálogo, fichas y mensaje. Déjalo vacío ('') para ocultarlo.
  shippingNote: 'Envío gratis',

  // Formas de pago aceptadas. El pago se coordina por WhatsApp:
  // aquí NO van cuentas, CLABE ni referencias.
  paymentMethods: ['Transferencia bancaria', 'Pago en OXXO'],
  paymentSummary: 'Paga por transferencia o en OXXO',

  // Cantidad máxima que se puede pedir de un producto en un mismo mensaje.
  maxQuantity: 10,

  // Texto mientras no haya condiciones de entrega definitivas.
  deliveryNote: 'Confirma tu entrega por WhatsApp',

  // Pregunta final del mensaje de WhatsApp.
  whatsappClosing: '¿Me confirmas disponibilidad y fecha de entrega?',

  // Aviso de edad en el pie de página.
  ageNotice: 'Productos para personas mayores de 18 años.',

  // ---------- PROMOCIÓN ----------
  // endsAt: fecha y hora REAL en que termina la promoción, en hora de
  // Ciudad de México, con el formato 'AAAA-MM-DDTHH:MM'.
  //   Ejemplo: '2026-10-31T23:59'
  // Mientras esté vacío (''), o cuando la fecha ya pasó, el temporizador
  // y el mensaje de urgencia se ocultan y se muestra `fallbackLabel`.
  // Al terminar la promoción el precio NO cambia.
  promo: {
    endsAt: '',
    timeZone: 'America/Mexico_City',
    fallbackLabel: 'Precio de lanzamiento',
    // Se usa solo si la promoción termina el mismo día (hora de CDMX).
    todayLabel: 'Solo por hoy',
  },
}
