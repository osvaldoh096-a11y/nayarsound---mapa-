/*
 * NayarSound · Dashboard — lectura de Google Sheets.
 *
 * Usa la misma conexión que el mapa: la consulta «gviz» de Google Sheets con
 * JSONP, que funciona mientras la hoja esté compartida con «cualquier persona
 * con el enlace». No escribe nada en la hoja.
 *
 * Detalle importante de gviz: cada columna toma un solo tipo de dato (el más
 * frecuente) y los valores de otro tipo llegan vacíos. Por eso la fila de
 * encabezados se pide sola (una fila no mezcla tipos) y aparte de los datos.
 */
var NSSource = (function () {
  'use strict';
  var cfg = window.NS_CONFIG || {};
  var KEY_SHEET = 'nayarsound-dashboard-hoja';
  var SCAN_ROWS = 40;
  var MAX_ROWS = 5000;
  var MAX_COLUMN = 'AZ';
  var SEARCH_ROWS = 12;
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
    var saved = memory;
    try { saved = localStorage.getItem(KEY_SHEET) || memory; } catch (e) { /* solo en memoria */ }
    return saved || cfg.spreadsheetId || '';
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
    var width = function (json) { return ((json.table && json.table.cols) || []).length; };
    return gviz(sheetName, { range: 'A1:' + MAX_COLUMN + SCAN_ROWS, headers: 0 }).then(function (json) {
      return { json: json, mode: 'rango A1:' + MAX_COLUMN + SCAN_ROWS, lastColumn: columnLetter(Math.max(0, width(json) - 1)) };
    }, function () {
      return gviz(sheetName, { tq: 'select * limit ' + SCAN_ROWS, headers: 0 }).then(function (json) {
        return { json: json, mode: 'consulta sin rango', lastColumn: columnLetter(Math.max(0, width(json) - 1)) };
      });
    });
  }

  function isHeaderRow(row, columns, sheetName) {
    try { NSSheet.extractTable([row], columns, sheetName); return true; } catch (e) { return false; }
  }
  function preview(row) {
    return row.filter(function (v) { return v !== ''; }).slice(0, 8).map(String).join(', ') || '(vacía)';
  }

  /**
   * Lee una hoja completa sin depender de la posición exacta de las filas:
   * 1) en las primeras filas busca la que más se parece a los encabezados;
   * 2) lee esa fila sola (una fila = un tipo por celda, nada se pierde) y, si no
   *    coincide, las siguientes (por si Google omitió filas vacías arriba);
   * 3) pide los datos desde la fila siguiente a los encabezados.
   */
  function readSheet(sheetName, columns) {
    var expected = {};
    columns.forEach(function (c) { expected[NSSheet.normalizeHeader(c.header)] = true; });
    return scanTop(sheetName).then(function (scan) {
      var rows = rowsOf(scan.json);
      var last = scan.lastColumn;
      var candidates = rows.map(function (row, i) {
        var seen = {};
        row.forEach(function (v) { var k = NSSheet.normalizeHeader(v); if (expected[k]) seen[k] = true; });
        return { index: i, score: Object.keys(seen).length };
      }).filter(function (c) { return c.score > 0; })
        .sort(function (a, b) { return b.score - a.score || a.index - b.index; })
        .slice(0, 2);
      var diag = 'Detalle técnico: «' + sheetName + '», ' + scan.mode + ', ' + rows.length + ' filas leídas, última columna ' + last;
      if (!candidates.length) {
        return Promise.reject(new Error('No se encontraron los encabezados en la hoja «' + sheetName + '». ' + diag + '.'));
      }
      var readRow = function (r) {
        return gviz(sheetName, { range: 'A' + r + ':' + last + r, headers: 0 })
          .then(function (json) { return { r: r, row: rowsOf(json)[0] || [] }; }, function () { return { r: r, row: [] }; });
      };
      var locate = function (k) {
        var base = candidates[k].index + 1;
        return readRow(base).then(function (first) {
          if (isHeaderRow(first.row, columns, sheetName)) return first;
          var tries = [];
          for (var r = base + 1; r <= base + SEARCH_ROWS; r++) tries.push(readRow(r));
          return Promise.all(tries).then(function (found) {
            for (var i = 0; i < found.length; i++) if (isHeaderRow(found[i].row, columns, sheetName)) return found[i];
            if (k + 1 < candidates.length) return locate(k + 1);
            throw new Error('No se encontraron los encabezados en la hoja «' + sheetName + '». ' + diag +
              ', fila probable ' + base + ' (' + candidates[k].score + ' coincidencias), probadas ' + base + '–' + (base + SEARCH_ROWS) +
              ', fila ' + base + ': ' + preview(first.row) + '.');
          });
        });
      };
      return locate(0).then(function (header) {
        return gviz(sheetName, { range: 'A' + (header.r + 1) + ':' + last + MAX_ROWS, headers: 0 }).then(function (json) {
          return { name: sheetName, values: [header.row].concat(rowsOf(json)), firstRow: header.r };
        });
      });
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
