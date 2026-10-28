/*
 * NayarSound · Dashboard — lectura de la hoja (sin dependencias del navegador).
 *
 * Convierte los valores de «AGENDA Y VENTAS», «STOCK OPERACION» y «ANALISIS»
 * (tal como los entrega la API de Google Sheets) en filas normalizadas.
 * Las columnas se localizan por su encabezado, no por letra o posición.
 * Solo lee: nunca escribe en la hoja.
 */
var NSSheet = (function () {
  'use strict';

  var CONFIG = {
    sheets: {
      agenda: 'AGENDA Y VENTAS',
      expenses: 'STOCK OPERACION',
      analysis: 'ANALISIS'
    },
    // Filas que se revisan para encontrar la fila de encabezados de cada hoja.
    headerScanRows: 40
  };

  // Encabezados esperados. Se comparan sin acentos, sin distinguir mayúsculas
  // y sin espacios sobrantes. «before/after» resuelven encabezados repetidos:
  // en AGENDA Y VENTAS hay dos columnas «DJ» (el nombre del DJ, antes de
  // TOTAL EVENTO, y el pago al DJ, después).
  var AGENDA_COLUMNS = [
    { key: 'op', header: 'OP' },
    { key: 'sonido', header: 'SONIDO DE' },
    { key: 'city', header: 'CIUDAD', required: true },
    { key: 'dj', header: 'DJ', before: 'TOTAL EVENTO' },
    { key: 'date', header: 'FECHA', required: true },
    { key: 'type', header: 'TIPO EVENTO' },
    { key: 'client', header: 'CLIENTE' },
    { key: 'total', header: 'TOTAL EVENTO', required: true },
    { key: 'anticipo', header: 'ANTICIPO', required: true },
    { key: 'gas', header: 'GAS A COBRAR', required: true },
    { key: 'djPay', header: 'DJ', after: 'TOTAL EVENTO', required: true },
    { key: 'ganancia', header: 'GANANCIA' },
    { key: 'ganancia2', header: 'GANANCIA 2', required: true },
    { key: 'entregar', header: 'ENTREGAR A OSVALDO' },
    { key: 'realizado', header: 'REALIZADO', required: true },
    { key: 'pagado', header: 'PAGADO' },
    { key: 'pago', header: 'PAGO' }
  ];

  var EXPENSE_COLUMNS = [
    { key: 'op', header: 'OP' },
    { key: 'date', header: 'FECHA DE COMPRA', required: true },
    { key: 'owner', header: 'DUEÑO' },
    { key: 'city', header: 'CIUDAD', required: true },
    { key: 'category', header: 'STOCK/OPERACION', required: true },
    { key: 'product', header: 'PRODUCTO' },
    { key: 'total', header: 'TOTAL', required: true },
    { key: 'status', header: 'STATUS' },
    { key: 'salePrice', header: 'PRECIO VENTA' }
  ];

  // Hoja auxiliar del archivo; se usa solo para verificar los cálculos.
  var ANALYSIS_COLUMNS = [
    { key: 'city', header: 'CIUDAD', required: true },
    { key: 'monthLabel', header: 'MES', required: true },
    { key: 'monthDate', header: 'MES CON FECHA' },
    { key: 'realizados', header: 'EVENTOS REALIZADOS', required: true },
    { key: 'generado', header: 'GENERADO', required: true },
    { key: 'dj', header: 'DJ', required: true },
    { key: 'ads', header: 'ADS', required: true },
    { key: 'operacion', header: 'OPERACION', required: true },
    { key: 'atCliente', header: 'AT CLIENTE', required: true },
    { key: 'operativa', header: 'GANANCIA OPERATIVA', required: true },
    { key: 'personal', header: 'GAN. OPERATIVA PERSONAL', required: true }
  ];

  var MONTH_NAMES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
    'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  /**
   * tables: { agenda, expenses, analysis|null }, cada una {name, values, firstRow}.
   *   firstRow = número de fila en la hoja de values[0] (1 si values empieza en la fila 1).
   * formatDate: convierte un objeto Date a 'YYYY-MM-DD' en la zona horaria de la hoja.
   */
  function buildPayload(tables, formatDate) {
    var issues = [];
    var agenda = extractTable(tables.agenda.values, AGENDA_COLUMNS, tables.agenda.name, tables.agenda.firstRow);
    var expenses = extractTable(tables.expenses.values, EXPENSE_COLUMNS, tables.expenses.name, tables.expenses.firstRow);

    var payload = {
      events: normalizeEvents_(agenda, formatDate, issues),
      expenses: normalizeExpenses_(expenses, formatDate, issues),
      analysis: null,
      analysisError: null,
      sources: {
        agenda: describeSource_(agenda),
        expenses: describeSource_(expenses),
        analysis: null
      },
      issues: issues
    };

    if (tables.analysis) {
      try {
        var analysis = extractTable(tables.analysis.values, ANALYSIS_COLUMNS, tables.analysis.name, tables.analysis.firstRow);
        payload.analysis = normalizeAnalysis_(analysis, formatDate);
        payload.sources.analysis = describeSource_(analysis);
      } catch (err) {
        payload.analysisError = err.message;
      }
    } else {
      payload.analysisError = 'No se encontró la hoja «' + CONFIG.sheets.analysis + '».';
    }
    return payload;
  }

  function normalizeHeader(text) {
    return String(text == null ? '' : text)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\.$/, '');
  }

  function columnLetter(index) {
    var n = index + 1;
    var s = '';
    while (n > 0) {
      var m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  /** Encuentra la fila de encabezados y la columna de cada campo. */
  function extractTable(values, columns, sheetName, firstRow) {
    var required = columns.filter(function (c) { return c.required; });
    var limit = Math.min(values.length, CONFIG.headerScanRows);
    for (var r = 0; r < limit; r++) {
      var normalized = (values[r] || []).map(normalizeHeader);
      var map = resolveColumns_(normalized, columns);
      var complete = required.every(function (c) { return map[c.key] != null; });
      if (complete) {
        return { sheetName: sheetName, headerRow: r, firstRow: firstRow || 1, columns: map, values: values, spec: columns };
      }
    }
    var names = required.map(function (c) { return c.header; }).join(', ');
    throw new Error('No se encontraron los encabezados (' + names + ') en la hoja «' + sheetName +
      '». Revisa que la hoja tenga datos y que sus IMPORTRANGE estén funcionando.');
  }

  function resolveColumns_(normalizedRow, columns) {
    var map = {};
    columns.forEach(function (col) {
      var target = normalizeHeader(col.header);
      var lo = -1;
      var hi = normalizedRow.length;
      if (col.after) {
        lo = normalizedRow.indexOf(normalizeHeader(col.after));
        if (lo === -1) return;
      }
      if (col.before) {
        var b = normalizedRow.indexOf(normalizeHeader(col.before));
        if (b !== -1) hi = b;
      }
      for (var i = lo + 1; i < hi; i++) {
        if (normalizedRow[i] === target) { map[col.key] = i; return; }
      }
    });
    return map;
  }

  function describeSource_(table) {
    var cols = {};
    table.spec.forEach(function (c) {
      if (table.columns[c.key] != null) {
        cols[c.key] = { header: c.header, column: columnLetter(table.columns[c.key]) };
      }
    });
    return { sheet: table.sheetName, headerRow: table.headerRow + table.firstRow, columns: cols };
  }

  function cell_(table, row, key) {
    var idx = table.columns[key];
    return idx == null ? null : row[idx];
  }

  function isBlank_(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  }

  function isDate_(v) {
    return Object.prototype.toString.call(v) === '[object Date]';
  }

  function cleanText_(v) {
    return isBlank_(v) ? '' : String(v).replace(/\s+/g, ' ').trim();
  }

  function cityKey(v) {
    return cleanText_(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  }

  /** Monto: número, texto con $ y comas, o vacío. Devuelve {value, error}. */
  function parseAmount(v) {
    if (isBlank_(v)) return { value: null, error: null };
    if (typeof v === 'number') return isFinite(v) ? { value: v, error: null } : { value: null, error: 'número inválido' };
    var s = String(v).trim();
    if (/^#/.test(s)) return { value: null, error: 'error de fórmula ' + s };
    var negative = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/[\s$]/g, ''));
    s = s.replace(/[()\s$]/g, '').replace(/,/g, '').replace(/^-/, '');
    if (s === '-' || s === '') return { value: 0, error: null };
    if (!/^\d+(\.\d+)?$/.test(s)) return { value: null, error: 'no es un monto: «' + String(v) + '»' };
    var n = parseFloat(s);
    return { value: negative ? -n : n, error: null };
  }

  /** Fecha: objeto Date, número de serie de Sheets o texto. Devuelve {value:'YYYY-MM-DD', error}. */
  function parseDate(v, formatDate) {
    if (isBlank_(v)) return { value: null, error: null };
    if (isDate_(v)) {
      return isNaN(v.getTime()) ? { value: null, error: 'fecha inválida' } : { value: formatDate(v), error: null };
    }
    if (typeof v === 'number') {
      if (v > 20000 && v < 80000) {
        var d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
        return { value: d.toISOString().slice(0, 10), error: null };
      }
      return { value: null, error: 'número que no es fecha: ' + v };
    }
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { value: m[1] + '-' + m[2] + '-' + m[3], error: null };
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      return { value: m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2), error: null };
    }
    return { value: null, error: 'fecha no reconocida: «' + s + '»' };
  }

  function parseYesNo_(v) {
    var s = cityKey(v);
    if (s === 'SI') return true;
    if (s === 'NO') return false;
    return null;
  }

  function parseMonthLabel_(v) {
    var parts = cityKey(v).split(' ');
    if (parts.length !== 2) return null;
    var idx = MONTH_NAMES.indexOf(parts[0]);
    if (idx === -1 || !/^\d{4}$/.test(parts[1])) return null;
    return parts[1] + '-' + ('0' + (idx + 1)).slice(-2);
  }

  function forEachDataRow_(table, fn) {
    for (var r = table.headerRow + 1; r < table.values.length; r++) {
      fn(table.values[r] || [], r + table.firstRow);
    }
  }

  function amountField_(table, row, key, rowNumber, issues, label) {
    var parsed = parseAmount(cell_(table, row, key));
    if (parsed.error) {
      issues.push({ sheet: table.sheetName, row: rowNumber, field: label, message: parsed.error });
    }
    return parsed.value;
  }

  function normalizeEvents_(table, formatDate, issues) {
    var events = [];
    forEachDataRow_(table, function (row, rowNumber) {
      var city = cityKey(cell_(table, row, 'city'));
      var rawDate = cell_(table, row, 'date');
      var rawTotal = cell_(table, row, 'total');
      if (!city && isBlank_(rawDate) && isBlank_(rawTotal)) return; // fila vacía

      var issue = function (field, message) {
        issues.push({ sheet: table.sheetName, row: rowNumber, field: field, message: message });
      };
      var date = parseDate(rawDate, formatDate);
      if (date.error) issue('FECHA', date.error);
      if (!date.value) { if (!date.error) issue('FECHA', 'sin fecha; la fila no se incluye'); return; }
      if (!city) { issue('CIUDAD', 'sin ciudad; la fila no se incluye (el archivo tampoco la suma)'); return; }

      var realizado = parseYesNo_(cell_(table, row, 'realizado'));
      if (realizado === null) issue('REALIZADO', 'valor distinto de SI/NO; el evento no cuenta como realizado ni como próximo');

      events.push({
        row: rowNumber,
        op: cleanText_(cell_(table, row, 'op')),
        sonido: cityKey(cell_(table, row, 'sonido')),
        city: city,
        dj: cleanText_(cell_(table, row, 'dj')),
        date: date.value,
        type: cleanText_(cell_(table, row, 'type')),
        client: cleanText_(cell_(table, row, 'client')),
        total: amountField_(table, row, 'total', rowNumber, issues, 'TOTAL EVENTO'),
        anticipo: amountField_(table, row, 'anticipo', rowNumber, issues, 'ANTICIPO'),
        gas: amountField_(table, row, 'gas', rowNumber, issues, 'GAS A COBRAR'),
        djPay: amountField_(table, row, 'djPay', rowNumber, issues, 'DJ (pago)'),
        ganancia: amountField_(table, row, 'ganancia', rowNumber, issues, 'GANANCIA'),
        ganancia2: amountField_(table, row, 'ganancia2', rowNumber, issues, 'GANANCIA 2'),
        entregar: amountField_(table, row, 'entregar', rowNumber, issues, 'ENTREGAR A OSVALDO'),
        realizado: realizado,
        pagado: cityKey(cell_(table, row, 'pagado')),
        pago: cleanText_(cell_(table, row, 'pago'))
      });
    });
    return events;
  }

  function normalizeExpenses_(table, formatDate, issues) {
    var expenses = [];
    forEachDataRow_(table, function (row, rowNumber) {
      var rawCategory = cell_(table, row, 'category');
      var rawDate = cell_(table, row, 'date');
      var rawTotal = cell_(table, row, 'total');
      if (isBlank_(rawCategory) && isBlank_(rawDate) && isBlank_(rawTotal)) return; // fila vacía

      var issue = function (field, message) {
        issues.push({ sheet: table.sheetName, row: rowNumber, field: field, message: message });
      };
      var date = parseDate(rawDate, formatDate);
      if (date.error) issue('FECHA DE COMPRA', date.error);
      if (!date.value) { if (!date.error) issue('FECHA DE COMPRA', 'sin fecha; la fila no se incluye'); return; }

      expenses.push({
        row: rowNumber,
        op: cleanText_(cell_(table, row, 'op')),
        date: date.value,
        owner: cityKey(cell_(table, row, 'owner')),
        city: cityKey(cell_(table, row, 'city')),
        // Se conserva tal cual (con espacios): el archivo compara la categoría de forma exacta.
        category: isBlank_(rawCategory) ? '' : String(rawCategory),
        product: cleanText_(cell_(table, row, 'product')),
        total: amountField_(table, row, 'total', rowNumber, issues, 'TOTAL'),
        status: cityKey(cell_(table, row, 'status')),
        salePrice: amountField_(table, row, 'salePrice', rowNumber, issues, 'PRECIO VENTA')
      });
    });
    return expenses;
  }

  function normalizeAnalysis_(table, formatDate) {
    var rows = [];
    var num = function (row, key) { return parseAmount(cell_(table, row, key)).value; };
    forEachDataRow_(table, function (row, rowNumber) {
      var city = cityKey(cell_(table, row, 'city'));
      if (!city) return;
      var month = null;
      var d = parseDate(cell_(table, row, 'monthDate'), formatDate);
      if (d.value) month = d.value.slice(0, 7);
      if (!month) month = parseMonthLabel_(cell_(table, row, 'monthLabel'));
      if (!month) return;
      rows.push({
        row: rowNumber,
        city: city,
        month: month,
        realizados: num(row, 'realizados'),
        generado: num(row, 'generado'),
        dj: num(row, 'dj'),
        ads: num(row, 'ads'),
        operacion: num(row, 'operacion'),
        atCliente: num(row, 'atCliente'),
        operativa: num(row, 'operativa'),
        personal: num(row, 'personal')
      });
    });
    return rows;
  }

  return {
    CONFIG: CONFIG,
    AGENDA_COLUMNS: AGENDA_COLUMNS,
    EXPENSE_COLUMNS: EXPENSE_COLUMNS,
    ANALYSIS_COLUMNS: ANALYSIS_COLUMNS,
    buildPayload: buildPayload,
    extractTable: extractTable,
    normalizeHeader: normalizeHeader,
    parseAmount: parseAmount,
    parseDate: parseDate,
    columnLetter: columnLetter,
    cityKey: cityKey
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NSSheet;
