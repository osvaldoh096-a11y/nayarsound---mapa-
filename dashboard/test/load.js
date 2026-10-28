// Carga los módulos del dashboard (js/sheet.js y js/core.js) en Node para
// probar la lógica sin navegador y sin Google.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = path.join(__dirname, '..');

function run(file) {
  const module = { exports: {} };
  const code = fs.readFileSync(path.join(DIR, file), 'utf8');
  vm.runInNewContext(code, { module, console, Intl }, { filename: file });
  return module.exports;
}

const loadSheet = () => run('js/sheet.js');
const loadCore = () => run('js/core.js');

module.exports = { loadSheet, loadCore, DIR };
