// ============================================================
//  CATÁLOGO PLACEX  (máximo 5 productos)
//
//  Cada producto:
//    id           → se usa en el enlace: /#/producto/<id>  (sin espacios ni acentos)
//    code         → código interno que aparece en el mensaje de WhatsApp
//    name         → nombre visible
//    price        → precio unitario en MXN (número, sin "$")
//    images       → rutas de fotos. Guarda las fotos en  public/products/
//                   y escribe '/products/archivo.jpg'. Si la lista está vacía
//                   se muestran espacios "FOTO PROVISIONAL".
//    description  → texto de la ficha
//    includes     → lista de piezas que incluye
//    sizes        → tallas: { label, available }  (available: false = no se puede elegir)
//    measurements → tabla de medidas: columnas y una fila por talla.
//                   Usa null en un valor que aún no tengas: se muestra "Por confirmar".
//    provisional  → true muestra la etiqueta "Provisional" (quítalo con datos reales)
//
//  Los 3 productos siguientes son DE DEMOSTRACIÓN: no tienen fotos, medidas
//  ni materiales reales. Reemplázalos antes de publicar.
// ============================================================

const pendingMeasurements = (sizes) => ({
  columns: ['Busto (cm)', 'Cintura (cm)', 'Cadera (cm)'],
  rows: sizes.map((size) => ({ size, values: [null, null, null] })),
})

export const products = [
  {
    id: 'conjunto-enfermera',
    code: 'PX-001',
    name: 'Conjunto Enfermera',
    price: 350,
    images: [],
    description:
      'Producto de demostración. Aquí irá la descripción real del conjunto: estilo, ajuste y detalles confirmados por el proveedor.',
    includes: ['Pieza 1 (por confirmar)', 'Pieza 2 (por confirmar)', 'Accesorio (por confirmar)'],
    sizes: [
      { label: 'CH', available: true },
      { label: 'M', available: true },
      { label: 'G', available: true },
    ],
    measurements: pendingMeasurements(['CH', 'M', 'G']),
    provisional: true,
  },
  {
    id: 'conjunto-oficial',
    code: 'PX-002',
    name: 'Conjunto Oficial',
    price: 350,
    images: [],
    description:
      'Producto de demostración. Sustituye este texto por la descripción real cuando tengas la prenda.',
    includes: ['Pieza 1 (por confirmar)', 'Pieza 2 (por confirmar)'],
    sizes: [
      { label: 'CH', available: true },
      { label: 'M', available: true },
      { label: 'G', available: true },
    ],
    measurements: pendingMeasurements(['CH', 'M', 'G']),
    provisional: true,
  },
  {
    id: 'conjunto-diablita',
    code: 'PX-003',
    name: 'Conjunto Diablita',
    price: 380,
    images: [],
    description:
      'Producto de demostración. Sustituye este texto por la descripción real cuando tengas la prenda.',
    includes: ['Pieza 1 (por confirmar)', 'Pieza 2 (por confirmar)', 'Accesorio (por confirmar)'],
    sizes: [
      { label: 'Unitalla', available: true },
    ],
    measurements: pendingMeasurements(['Unitalla']),
    provisional: true,
  },
]
