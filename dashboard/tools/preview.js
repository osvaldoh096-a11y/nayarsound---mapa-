#!/usr/bin/env node
// Arma una página HTML local del dashboard (sin Apps Script) para revisarla en
// el navegador. Simula google.script.run con datos sintéticos o con un snapshot.
//
// Uso:
//   node dashboard/tools/preview.js --salida <archivo.html>
//   node dashboard/tools/preview.js --salida <archivo.html> --snapshot <snapshot.json> [--hoy AAAA-MM-DD]
//
// Al abrir la página, el final de la URL elige la simulación:
//   #fallo          la hoja no responde (estado de error, sin números)
//   #lento          la respuesta tarda 3 segundos (estado de carga)
//   #fallo-despues  carga bien y falla al pulsar «Actualizar» (datos marcados como no actuales)
//
// Si usas un snapshot real, guarda la salida FUERA del repositorio.
const fs = require('fs');
const path = require('path');
const { loadServer, DIR } = require('../test/load');
const fx = require('../test/fixtures');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const out = opt('--salida');
if (!out) {
  console.error('Uso: node dashboard/tools/preview.js --salida <archivo.html> [--snapshot <snapshot.json>] [--hoy AAAA-MM-DD]');
  process.exit(2);
}
const server = loadServer();
let payload;
if (opt('--snapshot')) {
  const today = opt('--hoy') || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  payload = require('./snapshot').payloadFromSnapshot(server, opt('--snapshot'), today).payload;
} else {
  payload = fx.payload(server, opt('--hoy') || '2026-03-25');
}

const mock = `<script>
(function () {
  var payload = ${JSON.stringify(JSON.stringify(payload)).replace(/</g, '\\u003c')};
  var calls = 0;
  function Runner(ok, ko) { this.ok = ok; this.ko = ko; }
  Runner.prototype.withSuccessHandler = function (fn) { return new Runner(fn, this.ko); };
  Runner.prototype.withFailureHandler = function (fn) { return new Runner(this.ok, fn); };
  Runner.prototype.getDashboardData = function () {
    var self = this;
    calls++;
    var mode = location.hash.slice(1);
    var fail = mode === 'fallo' || (mode === 'fallo-despues' && calls > 1);
    setTimeout(function () {
      if (fail) { self.ko(new Error('Simulación local: no se pudo leer la hoja.')); return; }
      var p = JSON.parse(payload);
      p.generatedAt = new Date().toISOString();
      self.ok(JSON.stringify(p));
    }, mode === 'lento' ? 3000 : 120);
  };
  window.google = { script: { run: new Runner() } };
})();
</script>`;

let html = fs.readFileSync(path.join(DIR, 'Index.html'), 'utf8');
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">');
html = html.replace(/<\?= mapUrl \?>/g, opt('--mapa') || '../index.html');
html = html.replace("<?!= include('Core'); ?>", mock + "\n<?!= include('Core'); ?>");
html = html.replace(/<\?!= include\('(\w+)'\); \?>/g, (m, name) => fs.readFileSync(path.join(DIR, name + '.html'), 'utf8'));
if (/<\?/.test(html)) throw new Error('Quedó una etiqueta de plantilla sin resolver.');
fs.writeFileSync(out, html);
console.log('Vista previa escrita en ' + out);
