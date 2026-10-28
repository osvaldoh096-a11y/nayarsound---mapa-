/*
 * NayarSound · Dashboard — lectura de Google Sheets.
 *
 * Usa la misma conexión que el mapa: la consulta «gviz» de Google Sheets con
 * JSONP, que funciona mientras la hoja esté compartida con «cualquier persona
 * con el enlace». No escribe nada en la hoja.
 *
 * Detalle importante de gviz: cada columna toma un solo tipo de dato (el más
 * frecuente) y los valores de otro tipo llegan vacíos. Por eso los
 * encabezados se leen como etiquetas (headers=1), que siempre llegan completos.
 */
var NSSource = (function () {
  'use strict';
  var cfg = window.NS_CONFIG || {};
  var KEY_SHEET = 'nayarsound-dashboard-hoja';
  var SCAN_ROWS = 40;
  var MAX_ROWS = 5000;
  var MAX_COLUMN = 'AZ';
  var TIMEOUT_MS = 25000;
  var memory = '';

  // ---------- Enlace de la hoja ----------
  function parseSheetId(text) {
    var s = String(text || '').trim();
    var m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/) || s.match(/^([a-zA-Z0-9_-]{20,})$/);
    return m ? m[1] : null;
  }
  function store(id) {
    memory = id;
    try {
      if (id) localStorage.setItem(KEY_SHEET, id);
      else localStorage.removeItem(KEY_SHEET);
    } catch (e) { /* solo en memoria */ }
  }
  function sheetId() {
    if (cfg.spreadsheetId) return cfg.spreadsheetId;
    try { return localStorage.getItem(KEY_SHEET) || memory; } catch (e) { return memory; }
  }
  /** Toma la hoja de la dirección (#hoja=ID), la guarda y la quita de la barra. */
  function captureFromUrl() {
    var m = location.hash.match(/hoja=([^&]+)/);
    if (!m) return;
    var id = parseSheetId(decodeURIComponent(m[1]));
    if (id) store(id);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sin cambios */ }
  }
  function setSheet(text) {
    var id = parseSheetId(text);
    if (!id) throw new Error('Pega el enlace completo de la hoja (https://docs.google.com/spreadsheets/d/…).');
    store(id);
  }
  function clearSheet() { store(''); }

  // ---------- Consulta gviz (JSONP, como el mapa) ----------
  var seq = 0;
  /** q: {range: 'A1:B2'} o {tq: 'select …'}, más headers (0 o 1). */
  function gviz(sheetName, q) {
    return new Promise(function (resolve, reject) {
      var callback = '__nsGviz_' + Date.now() + '_' + (++seq);
      var url = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(sheetId()) +
        '/gviz/tq?sheet=' + encodeURIComponent(sheetName) +
        (q.range ? '&range=' + q.range : '') + (q.tq ? '&tq=' + encodeURIComponent(q.tq) : '') +
        '&headers=' + q.headers + '&tqx=out:json;responseHandler:' + callback;
      var script = document.createElement('script');
      var done = false;
      var timer = setTimeout(function () {
        finish(new Error('Google Sheets no respondió al leer «' + sheetName + '». Revisa que la hoja siga compartida con el enlace.'));
      }, TIMEOUT_MS);
      function finish(err, json) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (e) { window[callback] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
        if (err) reject(err); else resolve(json);
      }
      window[callback] = function (json) {
        if (json && json.status === 'error') {
          var e = (json.errors && json.errors[0]) || {};
          finish(new Error('Google Sheets no pudo leer «' + sheetName + '»: ' + (e.detailed_message || e.message || e.reason || 'error desconocido') + '.'));
          return;
        }
        finish(null, json);
      };
      script.onerror = function () {
        finish(new Error('No hay conexión con Google Sheets. Revisa tu internet.'));
      };
      script.src = url;
      document.body.appendChild(script);
    });
  }

  /** Convierte un valor de gviz a lo que espera la lectura: Date(…) → 'AAAA-MM-DD'. */
  function cellValue(c) {
    if (!c || c.v === null || c.v === undefined) return '';
    var v = c.v;
    if (typeof v === 'string') {
      var m = v.match(/^Date\((\d+),(\d+),(\d+)/);
      if (m) {
        var mm = +m[2] + 1;
        return m[1] + '-' + (mm < 10 ? '0' : '') + mm + '-' + (+m[3] < 10 ? '0' : '') + +m[3];
      }
    }
    return v;
  }
  function rowsOf(json) {
    return ((json.table && json.table.rows) || []).map(function (r) { return (r.c || []).map(cellValue); });
  }
  function columnLetter(index) {
    var n = index + 1, s = '';
    while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  /**
   * Primeras filas de la hoja. Pide hasta la columna AZ; si Google rechaza un
   * rango más ancho que la hoja, las pide sin rango y usa el ancho real.
   */
  function scanTop(sheetName) {
    return gviz(sheetName, { range: 'A1:' + MAX_COLUMN + SCAN_ROWS, headers: 0 }).then(function (json) {
      return { json: json, lastColumn: MAX_COLUMN };
    }, function () {
      return gviz(sheetName, { tq: 'select * limit ' + SCAN_ROWS, headers: 0 }).then(function (json) {
        var n = ((json.table && json.table.cols) || []).length;
        return { json: json, lastColumn: columnLetter(Math.max(0, n - 1)) };
      });
    });
  }

  /**
   * Lee una hoja completa: ubica la fila de encabezados en las primeras filas y
   * vuelve a pedir desde ahí con headers=1, para recibir todos los encabezados.
   */
  function readSheet(sheetName, columns) {
    var expected = {};
    columns.forEach(function (c) { expected[NSSheet.normalizeHeader(c.header)] = true; });
    return scanTop(sheetName).then(function (scan) {
      var rows = rowsOf(scan.json);
      var candidates = rows.map(function (row, i) {
        var seen = {};
        row.forEach(function (v) { var k = NSSheet.normalizeHeader(v); if (expected[k]) seen[k] = true; });
        return { row: i, score: Object.keys(seen).length };
      }).filter(function (c) { return c.score > 0; })
        .sort(function (a, b) { return b.score - a.score || a.row - b.row; })
        .slice(0, 3);
      if (!candidates.length) {
        return Promise.reject(new Error('No se encontraron los encabezados en la hoja «' + sheetName + '».'));
      }
      var tryCandidate = function (k) {
        var start = candidates[k].row + 1;
        return gviz(sheetName, { range: 'A' + start + ':' + scan.lastColumn + MAX_ROWS, headers: 1 }).then(function (json) {
          var cols = (json.table && json.table.cols) || [];
          var last = 0;
          cols.forEach(function (c, i) { if (c && c.label) last = i; });
          var labels = cols.slice(0, last + 1).map(function (c) { return c ? c.label : ''; });
          var values = [labels].concat(rowsOf(json));
          try {
            NSSheet.extractTable(values, columns, sheetName);
            return { name: sheetName, values: values, firstRow: start, lastColumn: columnLetter(last) };
          } catch (err) {
            if (k + 1 < candidates.length) return tryCandidate(k + 1);
            throw err;
          }
        });
      };
      return tryCandidate(0);
    });
  }

  function fetchTables() {
    var S = NSSheet.CONFIG.sheets;
    return Promise.all([
      readSheet(S.agenda, NSSheet.AGENDA_COLUMNS),
      readSheet(S.expenses, NSSheet.EXPENSE_COLUMNS),
      // ANALISIS solo sirve para verificar: si falla, el dashboard sigue.
      readSheet(S.analysis, NSSheet.ANALYSIS_COLUMNS).catch(function () { return null; })
    ]).then(function (r) {
      return { spreadsheetName: '', agenda: r[0], expenses: r[1], analysis: r[2] };
    });
  }

  return {
    sheetId: sheetId,
    setSheet: setSheet,
    clearSheet: clearSheet,
    captureFromUrl: captureFromUrl,
    fetchTables: fetchTables
  };
})();
