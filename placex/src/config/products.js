// ============================================================
//  CATÁLOGO PLACEX  (máximo 5 productos)
//
//  Cada producto:
//    id           → se usa en el enlace: /#/producto/<id>  (sin espacios ni acentos)
//    code         → código interno que aparece en el mensaje de WhatsApp
//    name         → nombre visible
//    price        → precio unitario en MXN (número, sin "$"), envío incluido
//    compareAtPrice → (opcional) precio regular que se muestra tachado
//    images       → rutas de fotos. Guarda las fotos en  public/products/
//                   y escribe '/products/archivo.jpg'. Si la lista está vacía
//                   se muestran espacios "FOTO PROVISIONAL".
//                   También admite videos: { video: '/products/video.mp4', poster: '/products/portada.webp' }
//                   y fotos completas sin recortar (p. ej. tablas): { src: '/products/tabla.webp', fit: 'contain' }
//                   La primera FOTO de la lista es la portada del catálogo.
//    description  → texto de la ficha
//    color        → (opcional) color o colores de la prenda
//    material     → (opcional) material, solo si está confirmado
//    details      → (opcional) lista de detalles de diseño
//    includes     → lista de piezas que incluye
//    sizes        → tallas: { label, available }  (available: false = no se puede elegir)
//    sizeNote     → (opcional) aclaración bajo el selector de talla
//                   (las tablas de tallas van como foto en `images`)
//    provisional  → true muestra la etiqueta "Provisional" (quítalo con datos reales)
//
// ============================================================

// Precio y tallas comunes. Puedes cambiar el precio o las tallas de un
// producto concreto escribiendo otro valor en ese producto.
const PRICE = 299
const COMPARE_AT = 700 // precio regular, se muestra tachado
const SIZES = ['S', 'M', 'L', 'XL']

const sizes = (labels = SIZES) => labels.map((label) => ({ label, available: true }))

export const products = [
  {
    id: 'conjunto-colegiala',
    code: 'PX-001',
    name: 'Conjunto Colegiala',
    price: PRICE,
    compareAtPrice: COMPARE_AT,
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
  },
  {
    id: 'conjunto-caperucita',
    code: 'PX-002',
    name: 'Conjunto Caperucita Roja',
    price: PRICE,
    compareAtPrice: COMPARE_AT,
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
    sizes: sizes(['M', 'L', 'XL', '2XL']),
  },
  {
    id: 'conjunto-mucama',
    code: 'PX-003',
    name: 'Conjunto Mucama de Encaje',
    price: PRICE,
    compareAtPrice: COMPARE_AT,
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
    sizes: sizes(['Unitalla']),
    sizeNote: 'El proveedor recomienda un peso de 40–65 kg. Es orientativo y no garantiza el ajuste.',
  },
  {
    id: 'babydoll-corse',
    code: 'PX-004',
    name: 'Babydoll Corsé Rojo y Negro',
    price: PRICE,
    compareAtPrice: COMPARE_AT,
    images: [
      '/products/babydoll-1.webp',
      {
        video: '/products/babydoll-video.mp4',
        webm: '/products/babydoll-video.webm',
        poster: '/products/babydoll-video-poster.webp',
      },
      '/products/babydoll-2.webp',
      { src: '/products/babydoll-tallas.webp', fit: 'contain' },
    ],
    description:
      'Un look atrevido con acabado satinado, encaje y lazos rojos. Su diseño tipo corsé con cordones laterales ajustables y falda corta de tul es ideal para sorprender en una noche especial.',
    color: 'Negro y rojo',
    details: ['Cordones laterales ajustables', 'Escote con encaje', 'Falda con volantes'],
    includes: ['Vestido de lencería'],
    sizes: sizes(),
  },
]
