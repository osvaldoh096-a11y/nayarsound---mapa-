import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Rutas relativas: la misma compilación funciona en localhost y en
  // GitHub Pages (https://<usuario>.github.io/<repo>/tienda/).
  base: './',
  build: { outDir: '../tienda', emptyOutDir: true },
  plugins: [react()],
  server: { port: 3000, strictPort: true, host: true },
  preview: { port: 3000, strictPort: true, host: true },
})
