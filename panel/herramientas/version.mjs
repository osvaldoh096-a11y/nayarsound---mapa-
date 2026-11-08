// Pone un número de versión en las rutas de CSS y JS (?v=…) para que el
// navegador no use archivos viejos del caché después de publicar.
//   node panel/herramientas/version.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const version = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
const conVersion = (ruta) => `${ruta.replace(/\?v=\w+$/, '')}?v=${version}`;

const archivos = [join(raiz, 'index.html'), ...readdirSync(join(raiz, 'js')).filter((f) => f.endsWith('.js')).map((f) => join(raiz, 'js', f))];
for (const archivo of archivos) {
  const antes = readFileSync(archivo, 'utf8');
  const despues = antes
    .replace(/(from\s+['"])(\.\/[\w-]+\.js)(\?v=\w+)?(['"])/g, (_, a, ruta, _v, b) => `${a}${conVersion(ruta)}${b}`)
    .replace(/(import\(\s*['"])(\.\/[\w-]+\.js)(\?v=\w+)?(['"])/g, (_, a, ruta, _v, b) => `${a}${conVersion(ruta)}${b}`)
    .replace(/((?:src|href)=")((?:js|css)\/[\w-]+\.(?:js|css))(\?v=\w+)?(")/g, (_, a, ruta, _v, b) => `${a}${conVersion(ruta)}${b}`);
  if (despues !== antes) writeFileSync(archivo, despues);
}
console.log(`Versión ${version}`);
