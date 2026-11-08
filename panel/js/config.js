// Preferencias guardadas solo en este navegador.

const CLAVE_PREF = 'panel.preferencias.v1';
const PREF_INICIAL = { autoMinutos: 15 };

export function leerPreferencias() {
  try { return { ...PREF_INICIAL, ...(JSON.parse(localStorage.getItem(CLAVE_PREF) ?? 'null') ?? {}) }; } catch { return { ...PREF_INICIAL }; }
}

export function guardarPreferencias(pref) {
  try { localStorage.setItem(CLAVE_PREF, JSON.stringify(pref)); } catch { /* sin almacenamiento */ }
}
