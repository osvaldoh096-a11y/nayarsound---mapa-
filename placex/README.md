# PLACEX — tienda web

Catálogo pequeño (máx. 5 productos) con ficha por producto y pedido por WhatsApp.
React + Vite. Sin pagos, cuentas ni base de datos.

## Abrir en local

```bash
cd placex
npm install      # solo la primera vez
npm run dev      # http://localhost:3000
```

## Qué editar

| Qué | Dónde |
| --- | --- |
| Productos: nombre, código, precio, descripción, qué incluye, tallas, disponibilidad, medidas | `src/config/products.js` |
| Precio tachado (regular) y texto de ahorro | `COMPARE_AT` en `src/config/products.js`; textos en `pricing` de `src/config/store.js` |
| Fotos | Guárdalas en `public/products/` y ponlas en `images` del producto, p. ej. `'/products/enfermera-1.jpg'` |
| Número de WhatsApp, URL pública, envío, formas de pago, textos generales | `src/config/store.js` |
| Promoción (último día real, hora de Ciudad de México) | `promo.lastDay` en `src/config/store.js`, formato `'2026-10-31'` |
| Logotipo | `public/brand/` |
| Colores y estilos | `src/styles.css` (variables al inicio) |

Tipografías: **Cinzel** (logo/títulos, la más cercana al branding) y **Montserrat** (texto, precios, tallas).
Se incluyen en el proyecto con `@fontsource`, sin depender de servicios externos.

## Versión publicada (GitHub Pages)

`npm run build` genera la tienda lista para publicar en la carpeta `tienda/`
(en la raíz del repositorio). Esa carpeta es la que sirve GitHub Pages:
https://osvaldoh096-a11y.github.io/nayarsound---mapa-/tienda/

Cada vez que cambies productos, precios o la promoción: `npm run build`,
y sube los cambios de `placex/` y `tienda/` a la rama `main`.

## Antes de publicar


- Dominio en `store.siteUrl` para que el enlace del mensaje apunte a la tienda publicada.
- Promoción: ciclo automático de 2 días en `promo.cycle` (enabled: false para apagarlo) o último día fijo en `promo.lastDay`.
