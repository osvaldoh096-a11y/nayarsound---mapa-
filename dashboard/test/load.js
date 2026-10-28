// Carga el código de Apps Script (Code.gs y los <script> de los .html) en Node
// para probar la lógica pura sin depender de Google.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = path.join(__dirname, '..', 'apps-script');

function run(code, filename, extra) {
  const module = { exports: {} };
  vm.runInNewContext(code, Object.assign({ module, console, Intl }, extra || {}), { filename });
  return module.exports;
}

function loadServer() {
  return run(fs.readFileSync(path.join(DIR, 'Code.gs'), 'utf8'), 'Code.gs');
}

function scriptFromHtml(name) {
  const html = fs.readFileSync(path.join(DIR, name + '.html'), 'utf8');
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  if (!match) throw new Error(name + '.html no contiene <script>');
  return match[1];
}

function loadCore() {
  return run(scriptFromHtml('Core'), 'Core.html');
}

module.exports = { loadServer, loadCore, scriptFromHtml, DIR };
