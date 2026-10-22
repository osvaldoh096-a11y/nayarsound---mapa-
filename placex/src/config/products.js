// ============================================================
//  CATÁLOGO PLACEX  (máximo 5 productos)
//
//  Cada producto:
//    id           → se usa en el enlace: /#/producto/<id>  (sin espacios ni acentos)
//    code         → código interno que aparece en el mensaje de WhatsApp
//    name         → nombre visible
//    price        → precio unitario en MXN (número, sin "$"), envío incluido
//    images       → rutas de fotos. Guarda las fotos en  public/products/
//                   y escribe '/products/archivo.jpg'. Si la lista está vacía
//                   se muestran espacios "FOTO PROVISIONAL".
//                   También admite videos: { video: '/products/video.mp4', poster: '/products/portada.webp' }
//                   y fotos completas sin recortar (p. ej. tablas): { src: '/products/tabla.webp', fit: 'contain' }
//                   La primera FOTO de la lista es la portada del catálogo.
//    description  → texto de la ficha
//    includes     → lista de piezas que incluye
//    sizes        → tallas: { label, available }  (available: false = no se puede elegir)
//    measurements → tabla de medidas: columnas y una fila por talla.
//                   Usa null en un valor que aún no tengas: se muestra "Por confirmar".
//    provisional  → true muestra la etiqueta "Provisional" (quítalo con datos reales)
//
//  PX-001 tiene datos reales. PX-002 y PX-003 son DE DEMOSTRACIÓN: no tienen fotos, medidas
//  ni materiales reales. Reemplázalos antes de publicar.
// ============================================================

// Precio y tallas comunes. Puedes cambiar el precio o las tallas de un
// producto concreto escribiendo otro valor en ese producto.
const PRICE = 299
const SIZES = ['S', 'M', 'L', 'XL']

const sizes = (labels = SIZES) => labels.map((label) => ({ label, available: true }))

const pendingMeasurements = (labels = SIZES) => ({
  columns: ['Busto (cm)', 'Cintura (cm)', 'Cadera (cm)'],
  rows: labels.map((size) => ({ size, values: [null, null, null] })),
})

export const products = [
  {
    id: 'conjunto-colegiala',
    code: 'PX-001',
    name: 'Conjunto Colegiala',
    price: PRICE,
    images: [
      '/products/colegiala-1.webp',
      {
        video: '/products/colegiala-video.mp4',
        webm: '/products/colegiala-video.webm',
        poster: '/products/colegiala-video-poster.webp',
      },
      '/products/colegiala-3.webp',
      { src: '/products/colegiala-tallas.webp', fit: 'contain' },
    ],
    description:
      'Top de encaje blanco con lazo frontal y minifalda de cuadros rojos. Un conjunto atrevido para sorprender en una noche especial.',
    includes: ['Top', 'Minifalda', 'Tanga'],
    sizes: sizes(),
    // Medidas de la tabla del proveedor. La talla S no viene en la tabla.
    measurements: {
      columns: ['Pecho (cm)', 'Cintura (cm)'],
      rows: [
        { size: 'S', values: [null, null] },
        { size: 'M', values: [89, 70] },
        { size: 'L', values: [93, 74] },
        { size: 'XL', values: [98, 78] },
      ],
    },
  },
  {
    id: 'conjunto-oficial',
    code: 'PX-002',
    name: 'Conjunto Oficial',
    price: PRICE,
    images: [],
    description:
      'Producto de demostración. Sustituye este texto por la descripción real cuando tengas la prenda.',
    includes: ['Pieza 1 (por confirmar)', 'Pieza 2 (por confirmar)'],
    sizes: sizes(),
    measurements: pendingMeasurements(),
    provisional: true,
  },
  {
    id: 'conjunto-diablita',
    code: 'PX-003',
    name: 'Conjunto Diablita',
    price: PRICE,
    images: [],
    description:
      'Producto de demostración. Sustituye este texto por la descripción real cuando tengas la prenda.',
    includes: ['Pieza 1 (por confirmar)', 'Pieza 2 (por confirmar)', 'Accesorio (por confirmar)'],
    sizes: sizes(),
    measurements: pendingMeasurements(),
    provisional: true,
  },
]
