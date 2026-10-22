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
//    color        → (opcional) color o colores de la prenda
//    material     → (opcional) material, solo si está confirmado
//    includes     → lista de piezas que incluye
//    note         → (opcional) aclaración visible bajo "Incluye"
//    sizes        → tallas: { label, available }  (available: false = no se puede elegir)
//    sizeNote     → (opcional) aclaración bajo el selector de talla
//    measurements → tabla de medidas: columnas y una fila por talla (null = sin tabla).
//                   Usa null en un valor que aún no tengas: se muestra "Por confirmar".
//    provisional  → true muestra la etiqueta "Provisional" (quítalo con datos reales)
//
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
    id: 'conjunto-caperucita',
    code: 'PX-002',
    name: 'Conjunto Caperucita Roja',
    price: PRICE,
    images: [
      '/products/caperucita-1.webp',
      {
        video: '/products/caperucita-video.mp4',
        webm: '/products/caperucita-video.webm',
        poster: '/products/caperucita-video-poster.webp',
      },
      '/products/caperucita-2.webp',
      '/products/caperucita-3.webp',
    ],
    description:
      'Dale un giro atrevido al cuento. Top con lazo y minifalda con volantes de encaje en rojo, negro y blanco. Ideal para una noche especial o una fiesta temática.',
    color: 'Rojo, negro y blanco',
    includes: ['Top', 'Minifalda', 'Cinta para el cuello'],
    // Las fotos muestran piezas que no vienen en el paquete.
    note: 'La capa y la diadema que aparecen en las fotos no están incluidas.',
    sizes: sizes(['M', 'L', 'XL', '2XL']),
    measurements: pendingMeasurements(['M', 'L', 'XL', '2XL']),
  },
  {
    id: 'conjunto-mucama',
    code: 'PX-003',
    name: 'Conjunto Mucama de Encaje',
    price: PRICE,
    images: [
      '/products/mucama-1.webp',
      '/products/mucama-2.webp',
      '/products/mucama-3.webp',
      '/products/mucama-4.webp',
    ],
    description:
      'Encaje, transparencias y un toque coqueto para una noche especial. Un conjunto de mucama con medias incluidas para completar el look.',
    material: 'Poliéster con cierta elasticidad',
    includes: ['Vestido de encaje', 'Diadema', 'Medias'],
    // Las fotos muestran piezas que no vienen en el paquete.
    note: 'El collar con moño y las mangas que aparecen en las fotos no están incluidos.',
    sizes: sizes(['Unitalla']),
    sizeNote: 'El proveedor recomienda un peso de 40–65 kg. Es orientativo y no garantiza el ajuste.',
    measurements: null,
  },
]
