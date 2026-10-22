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
  // Si queda vacío, WhatsApp se abre sin destinatario.
  whatsappNumber: '523112851465',

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

  // Textos del precio tachado ({ahorro} = precio regular − precio, {pct} = % de descuento).
  pricing: {
    savings: 'Ahorras {ahorro} solo durante la promoción',
    badge: '-{pct}%',
  },

  // Cantidad máxima que se puede pedir de un producto en un mismo mensaje.
  maxQuantity: 10,

  // Texto mientras no haya condiciones de entrega definitivas.
  deliveryNote: 'Confirma tu entrega por WhatsApp',

  // Pregunta final del mensaje de WhatsApp.
  whatsappClosing: '¿Me confirmas disponibilidad y fecha de entrega?',

  // Aviso de edad en el pie de página.
  ageNotice: 'Productos para personas mayores de 18 años.',

  // ---------- BARRA SUPERIOR Y PORTADA ----------
  // {precio} se reemplaza por el precio común del catálogo (p. ej. $299).
  // Si los productos tienen precios distintos, los textos con {precio} se ocultan.
  marquee: ['Envío gratis a toda la República', 'Envíos rápidos', 'Todos los conjuntos a {precio} MXN'],
  hero: {
    title: 'Tu próximo look atrevido, a un clic.',
    support: 'Consulta por WhatsApp cuándo llega a tu código postal.',
    cta: 'Ver conjuntos',
  },

  // ---------- PROMOCIÓN ----------
  // lastDay: ÚLTIMO día REAL de la promoción, formato 'AAAA-MM-DD'.
  //   La promoción termina a la medianoche (00:00) de Ciudad de México
  //   al terminar ese día. Ejemplo: '2026-10-31'
  //
  // Lo que se muestra se calcula con esa fecha, igual para todas las personas:
  //   - el día anterior:   "¡Solo hoy y mañana!"
  //   - el último día:     "¡Último día de promoción!" + contador hasta medianoche
  //   - antes de eso:      "Promoción por tiempo limitado" + fecha de fin
  //   - vacío o ya pasó:   no se muestra urgencia ni contador
  // Para una nueva promoción, cambia la fecha. El precio NO cambia al terminar.
  //
  // cycle: ciclo automático de 2 días que se repite sin fin. Si está activo,
  //   ignora `lastDay`. `firstLastDay` es el primer "último día" (con contador);
  //   desde ahí se alternan: "¡Solo hoy y mañana!" → "¡Último día!" → ...
  //   Para apagarlo: enabled: false.
  promo: {
    cycle: { enabled: true, firstLastDay: '2026-10-21' },
    lastDay: '',
    timeZone: 'America/Mexico_City',
    lastDayLabel: '¡Último día de promoción!',
    dayBeforeLabel: '¡Solo hoy y mañana!',
    earlierLabel: 'Promoción por tiempo limitado',
    timerLabel: 'Tiempo de la promoción',
    // Oferta destacada; {precio} se reemplaza por el precio del catálogo.
    offer: '{precio} + envío gratis',
  },

}
