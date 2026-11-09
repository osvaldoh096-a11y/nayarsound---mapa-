// Gráficas sencillas sin librerías: barras en HTML y líneas en SVG, con
// información al pasar el dedo o el cursor.

import { dinero, esc, esPrivado } from './formato.js?v=202611090319';

function compacto(v) {
  if (esPrivado()) return '$***';
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}k`;
  return `${s}$${Math.round(a)}`;
}

/**
 * Barras horizontales. items: [{ nombre, valor (número o null), nota }]
 * divergente: los negativos crecen hacia la izquierda desde el cero.
 */
export function barras(items, { divergente = false, decimales = 2, vacio = 'Sin datos' } = {}) {
  if (!items.length) return `<p class="vacio">${esc(vacio)}</p>`;
  const valores = items.map((i) => i.valor).filter((v) => typeof v === 'number');
  const max = Math.max(0, ...valores);
  const min = divergente ? Math.min(0, ...valores) : 0;
  const rango = (max - min) || 1;
  const cero = (-min / rango) * 100;
  const filas = items.map((i) => {
    const tieneValor = typeof i.valor === 'number';
    const ancho = tieneValor ? (Math.abs(i.valor) / rango) * 100 : 0;
    const izquierda = tieneValor && i.valor < 0 ? cero - ancho : cero;
    const clase = tieneValor && i.valor < 0 ? 'neg' : 'pos';
    const valorTexto = tieneValor ? dinero(i.valor, decimales) : (i.nota || 'Sin dato');
    const tip = `${i.nombre}: ${valorTexto}${i.detalle ? ` · ${i.detalle}` : ''}`;
    return `<div class="graf-fila" data-tip="${esc(tip)}" tabindex="0">
      <span class="graf-nombre">${esc(i.nombre)}</span>
      <span class="graf-pista">${divergente && min < 0 ? `<span class="graf-cero" style="left:${cero}%"></span>` : ''}
        ${tieneValor ? `<span class="graf-relleno ${clase}" style="left:${izquierda}%;width:${Math.max(ancho, 0.6)}%"></span>` : ''}
      </span>
      <span class="graf-valor ${tieneValor ? '' : 'sin-dato'}">${esc(valorTexto)}</span>
    </div>`;
  }).join('');
  return `<div class="graf-barras">${filas}</div>`;
}

function escalaBonita(min, max, pasos = 4) {
  if (min === max) { max = min + 1; }
  const crudo = (max - min) / pasos;
  const mag = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((p) => p >= crudo);
  const desde = Math.floor(min / paso) * paso;
  const hasta = Math.ceil(max / paso) * paso;
  const marcas = [];
  for (let v = desde; v <= hasta + paso / 2; v += paso) marcas.push(Math.round(v * 100) / 100);
  return { desde, hasta, marcas };
}

/**
 * Líneas mensuales. series: [{ nombre, clase, valores: [número|null] }]
 * Se dibuja al ancho real del contenedor; se vuelve a dibujar al girar el celular.
 */
export function lineas(contenedor, { etiquetas, etiquetasCortas, series }) {
  const dibujar = () => {
    const ancho = Math.max(300, contenedor.clientWidth || 600);
    const alto = 230;
    const m = { izq: 52, der: 14, arr: 12, abj: 28 };
    const todos = series.flatMap((s) => s.valores).filter((v) => typeof v === 'number');
    if (!todos.length) { contenedor.innerHTML = '<p class="vacio">Sin datos para graficar.</p>'; return; }
    const { desde, hasta, marcas } = escalaBonita(Math.min(0, ...todos), Math.max(0, ...todos));
    const n = etiquetas.length;
    const x = (i) => m.izq + (n === 1 ? (ancho - m.izq - m.der) / 2 : (i * (ancho - m.izq - m.der)) / (n - 1));
    const y = (v) => m.arr + (1 - (v - desde) / (hasta - desde)) * (alto - m.arr - m.abj);
    const cadaCuanto = Math.ceil(n / Math.max(1, Math.floor((ancho - m.izq) / 46)));
    let svg = `<svg width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Evolución mensual">`;
    for (const v of marcas) {
      svg += `<line class="${v === 0 ? 'eje-cero' : 'rejilla'}" x1="${m.izq}" x2="${ancho - m.der}" y1="${y(v)}" y2="${y(v)}"/>`;
      svg += `<text class="eje-texto" x="${m.izq - 8}" y="${y(v) + 4}" text-anchor="end">${compacto(v)}</text>`;
    }
    etiquetas.forEach((_, i) => {
      if (i % cadaCuanto === 0 || i === n - 1) {
        svg += `<text class="eje-texto" x="${x(i)}" y="${alto - 8}" text-anchor="middle">${esc(etiquetasCortas[i])}</text>`;
      }
    });
    for (const s of series) {
      let d = '';
      let abierto = false;
      s.valores.forEach((v, i) => {
        if (typeof v !== 'number') { abierto = false; return; }
        d += `${abierto ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        abierto = true;
      });
      svg += `<path class="linea ${s.clase}" d="${d}"/>`;
      s.valores.forEach((v, i) => {
        if (typeof v === 'number') svg += `<circle class="punto ${s.clase}" cx="${x(i)}" cy="${y(v)}" r="4"/>`;
      });
    }
    svg += `<line class="cruz" x1="0" x2="0" y1="${m.arr}" y2="${alto - m.abj}" visibility="hidden"/>`;
    svg += `<rect class="captura" x="${m.izq}" y="0" width="${ancho - m.izq - m.der}" height="${alto}" fill="transparent"/>`;
    svg += '</svg>';
    contenedor.innerHTML = svg;

    const lienzo = contenedor.querySelector('svg');
    const cruz = lienzo.querySelector('.cruz');
    const mostrar = (evento) => {
      const caja = lienzo.getBoundingClientRect();
      const px = evento.clientX - caja.left;
      let i = Math.round(((px - m.izq) / Math.max(1, ancho - m.izq - m.der)) * (n - 1));
      i = Math.min(n - 1, Math.max(0, i));
      cruz.setAttribute('x1', x(i)); cruz.setAttribute('x2', x(i)); cruz.setAttribute('visibility', 'visible');
      const filas = series.map((s) => `<div><i class="muestra ${s.clase}"></i>${esc(s.nombre)}: <b>${typeof s.valores[i] === 'number' ? dinero(s.valores[i]) : 'sin dato'}</b></div>`).join('');
      mostrarTip(`<div class="tip-titulo">${esc(etiquetas[i])}</div>${filas}`, evento.clientX, caja.top + y(Math.max(...series.map((s) => s.valores[i] ?? desde))));
    };
    const ocultar = () => { cruz.setAttribute('visibility', 'hidden'); ocultarTip(); };
    lienzo.addEventListener('pointermove', mostrar);
    lienzo.addEventListener('pointerdown', mostrar);
    lienzo.addEventListener('pointerleave', ocultar);
  };
  dibujar();
  let espera;
  const observador = new ResizeObserver(() => { clearTimeout(espera); espera = setTimeout(dibujar, 120); });
  observador.observe(contenedor);
  return () => observador.disconnect();
}

// ---------- información flotante compartida ----------

let tip = null;
function nodoTip() {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
  }
  return tip;
}

export function mostrarTip(html, cx, cy) {
  const t = nodoTip();
  t.innerHTML = html;
  t.style.display = 'block';
  const { width, height } = t.getBoundingClientRect();
  const left = Math.min(window.innerWidth - width - 8, Math.max(8, cx - width / 2));
  const top = Math.max(8, cy - height - 12);
  t.style.left = `${left}px`;
  t.style.top = `${top}px`;
}

export function ocultarTip() {
  if (tip) tip.style.display = 'none';
}

/** Activa el tooltip de las barras (atributo data-tip) dentro de un contenedor. */
export function activarTips(raiz) {
  raiz.querySelectorAll('[data-tip]').forEach((el) => {
    const ver = () => {
      const c = el.getBoundingClientRect();
      mostrarTip(esc(el.dataset.tip), c.left + c.width / 2, c.top);
    };
    el.addEventListener('pointerenter', ver);
    el.addEventListener('focus', ver);
    el.addEventListener('pointerleave', ocultarTip);
    el.addEventListener('blur', ocultarTip);
  });
}
