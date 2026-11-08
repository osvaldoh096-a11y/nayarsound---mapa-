// Genera panel/acceso.json: los enlaces de tus hojas cifrados con tu contraseña.
//
//   node panel/herramientas/cifrar-acceso.mjs /ruta/fuera-del-repo/config.json
//
// La contraseña se pide al ejecutar (o en la variable PANEL_CONTRASENA).
// config.json (guárdalo FUERA del repositorio):
// {
//   "archivos": {
//     "nayarsound": { "id": "…", "pestanas": { "DASHBOARD": 123, "AGENDA Y VENTAS": 456 }, "zona": "America/Los_Angeles" },
//     "agenda":     { "id": "…", "pestanas": { "AGENDA": 0 }, "zona": "America/Mexico_City" },
//     "prestamos":  { "id": "…", "pestanas": { … } },
//     "gastos":     { "id": "…", "pestanas": { … } }
//   }
// }
// "id" puede ser el enlace completo de la hoja. "pestanas" (gid de cada
// pestaña, el número después de #gid= en el enlace) solo sirve para que los
// enlaces abran la pestaña correcta.

import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { cifrar, descifrar } from '../js/acceso.js';
import { idDesdeEnlace, validarConfig } from '../js/config.js';

const ruta = process.argv[2];
if (!ruta) {
  console.error('Uso: node panel/herramientas/cifrar-acceso.mjs /ruta/config.json');
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(ruta, 'utf8'));
for (const archivo of Object.values(cfg.archivos ?? {})) archivo.id = idDesdeEnlace(archivo.id) ?? archivo.id;
const errores = validarConfig(cfg);
if (errores.length) {
  console.error(errores.join('\n'));
  process.exit(1);
}

let contrasena = process.env.PANEL_CONTRASENA;
if (!contrasena) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  contrasena = await rl.question('Contraseña nueva (10+ caracteres): ');
  rl.close();
}
if (!contrasena || contrasena.length < 10) {
  console.error('Usa una contraseña de al menos 10 caracteres: este archivo es público y se puede atacar sin conexión.');
  process.exit(1);
}

const paquete = await cifrar(cfg, contrasena);
await descifrar(paquete, contrasena); // comprobación
const destino = fileURLToPath(new URL('../acceso.json', import.meta.url));
writeFileSync(destino, `${JSON.stringify(paquete, null, 2)}\n`);
console.log(`Listo: ${destino}. Súbelo al repositorio; la contraseña nueva reemplaza a la anterior.`);
