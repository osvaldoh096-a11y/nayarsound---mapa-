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
| Fotos | Guárdalas en `public/products/` y ponlas en `images` del producto |
| Número de WhatsApp, URL pública, envío, formas de pago, textos generales | `src/config/store.js` |
| Fin de la promoción (temporizador), hora de Ciudad de México | `promo.endsAt` en `src/config/store.js`, formato `'2026-10-31T23:59'` |
| Logotipo | `public/brand/` |
| Colores y estilos | `src/styles.css` (variables al inicio) |

Tipografías: **Cinzel** (logo/títulos, la más cercana al branding) y **Montserrat** (texto, precios, tallas).
Se incluyen en el proyecto con `@fontsource`, sin depender de servicios externos.

## Antes de publicar

- Número de WhatsApp Business en `store.whatsappNumber`.
- Fotos, descripciones, piezas incluidas, tallas y medidas reales (los 3 productos actuales son de demostración).
- Dominio en `store.siteUrl` para que el enlace del mensaje apunte a la tienda publicada.
- Fecha real de fin de la promoción en `promo.endsAt` (vacío = temporizador oculto y "Precio de lanzamiento").
- Generar la versión final con `npm run build` (carpeta `dist/`).
