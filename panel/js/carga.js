// Lee cada archivo configurado en paralelo. Cada archivo tiene su propio
// estado: si uno falla, los demás se actualizan y el que falló conserva sus
// datos anteriores, marcados como no actualizados.

import { ARCHIVOS, ORDEN_ARCHIVOS } from './fuentes.js?v=202611082119';
import { leerRangos } from './api.js?v=202611082119';

export async function leerArchivo(token, clave, archivo, lector = leerRangos) {
  const def = ARCHIVOS[clave];
  const claves = Object.keys(def.rangos);
  const valores = await lector(token, archivo.id, claves.map((k) => def.rangos[k]));
  return {
    clave,
    id: archivo.id,
    meta: { titulo: def.nombre, zona: archivo.zona ?? '', pestanas: archivo.pestanas ?? {} },
    rangos: Object.fromEntries(claves.map((k, i) => [k, valores[i]])),
  };
}

/**
 * estadoPrevio: { [clave]: { datos, actualizado } }
 * Devuelve el nuevo estado por archivo, sin perder datos anteriores.
 */
export async function leerTodo(token, archivos, estadoPrevio = {}, lector = leerRangos) {
  const resultados = await Promise.allSettled(
    ORDEN_ARCHIVOS.map((clave) => leerArchivo(token, clave, archivos[clave], lector)),
  );
  const ahora = new Date();
  const estado = {};
  ORDEN_ARCHIVOS.forEach((clave, i) => {
    const r = resultados[i];
    const previo = estadoPrevio[clave] ?? {};
    if (r.status === 'fulfilled') {
      estado[clave] = { estado: 'ok', datos: r.value, actualizado: ahora, intento: ahora, error: null };
    } else {
      estado[clave] = {
        estado: 'error',
        datos: previo.datos ?? null,
        actualizado: previo.actualizado ?? null,
        intento: ahora,
        error: { mensaje: r.reason?.message ?? String(r.reason), tipo: r.reason?.tipo ?? 'lectura' },
      };
    }
  });
  return estado;
}

/** Datos utilizables por archivo (los últimos que se leyeron bien). */
export function datosDisponibles(estado) {
  return Object.fromEntries(ORDEN_ARCHIVOS.map((clave) => [clave, estado[clave]?.datos ?? null]));
}
