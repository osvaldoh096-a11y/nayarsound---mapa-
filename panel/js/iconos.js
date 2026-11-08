// Iconos de línea (24×24, trazo 1.8) con un mismo estilo en todo el panel.

const TRAZOS = {
  inicio: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
  musica: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  prestamos: '<path d="M7 7h12l-3-3"/><path d="M17 17H5l3 3"/>',
  finanzas: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  actualizar: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/>',
  calendario: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
  cobrar: '<path d="M12 19V5"/><path d="m5 12 7 7 7-7"/>',
  pagar: '<path d="M12 5v14"/><path d="m5 12 7-7 7 7"/>',
  aviso: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  pendientes: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  ganancia: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  gasto: '<path d="m3 7 6 6 4-4 8 8"/><path d="M14 17h7v-7"/>',
  sobrante: '<rect x="2.5" y="6" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/><path d="M16.5 15h2"/>',
  dinero: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.4 0-2.6-.6-3.2-1.6M12 6.5v11"/>',
  ojo: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  ojoCerrado: '<path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.1"/><path d="M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M2 2l20 20"/>',
  flecha: '<path d="M9 6l6 6-6 6"/>',
  google: '<path d="M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5c-.2 1.2-.9 2.2-1.9 2.8v2.3h3.1c1.8-1.7 2.8-4.1 2.8-6.8z"/><path d="M12 21c2.6 0 4.7-.9 6.2-2.3L15.1 16c-.8.6-1.9 1-3.1 1-2.4 0-4.5-1.6-5.2-3.9H3.6v2.4A9.3 9.3 0 0 0 12 21z"/><path d="M6.8 13.1a5.6 5.6 0 0 1 0-3.6V7.1H3.6a9.3 9.3 0 0 0 0 8.4z"/><path d="M12 6.4c1.4 0 2.6.5 3.6 1.4l2.7-2.7A9.3 9.3 0 0 0 3.6 7.1l3.2 2.4C7.5 7.9 9.6 6.4 12 6.4z"/>',
};

export function icono(nombre, clase = '') {
  return `<svg class="icono ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRAZOS[nombre] ?? ''}</svg>`;
}
