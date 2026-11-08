// Contraseña del panel. Los enlaces de tus hojas se guardan en acceso.json
// cifrados con AES-GCM; la clave sale de la contraseña (PBKDF2-SHA256,
// 600 000 vueltas). Sin la contraseña, la página no sabe qué hojas leer.
// Funciona igual en el navegador y en Node (para generar acceso.json).

const VUELTAS = 600000;
const texto = new TextEncoder();

function aBase64(bytes) {
  let s = '';
  new Uint8Array(bytes).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}

function deBase64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function derivarClave(contrasena, sal, vueltas) {
  const base = await crypto.subtle.importKey('raw', texto.encode(contrasena), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sal, iterations: vueltas, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function cifrar(datos, contrasena, { vueltas = VUELTAS } = {}) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const clave = await derivarClave(contrasena, sal, vueltas);
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, texto.encode(JSON.stringify(datos)));
  return { version: 1, kdf: 'PBKDF2-SHA256', vueltas, sal: aBase64(sal), iv: aBase64(iv), datos: aBase64(cifrado) };
}

export class ContrasenaIncorrecta extends Error {}

export async function descifrar(paquete, contrasena) {
  if (!paquete?.datos || !paquete.sal || !paquete.iv) throw new Error('El archivo de acceso está incompleto.');
  const clave = await derivarClave(contrasena, deBase64(paquete.sal), paquete.vueltas || VUELTAS);
  try {
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deBase64(paquete.iv) }, clave, deBase64(paquete.datos));
    return JSON.parse(new TextDecoder().decode(claro));
  } catch {
    throw new ContrasenaIncorrecta('Contraseña incorrecta.');
  }
}
