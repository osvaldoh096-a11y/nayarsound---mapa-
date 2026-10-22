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
| Fotos | Guárdalas en `public/products/` y ponlas en `images` del producto, p. ej. `'/products/enfermera-1.jpg'` |
| Número de WhatsApp, URL pública, envío, formas de pago, textos generales | `src/config/store.js` |
| Fin de la promoción (temporizador), hora de Ciudad de México | `promo.endsAt` en `src/config/store.js`, formato `'2026-10-31T23:59'` |
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

- Número de WhatsApp Business en `store.whatsappNumber`.
- Medidas pendientes ("Por confirmar") de cada producto.
- Dominio en `store.siteUrl` para que el enlace del mensaje apunte a la tienda publicada.
- Fecha real de fin de la promoción en `promo.endsAt` (vacío = temporizador oculto y "Precio de lanzamiento").
