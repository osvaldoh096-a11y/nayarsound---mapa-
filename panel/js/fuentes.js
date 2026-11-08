// Qué se lee de cada archivo. Aquí no hay IDs ni datos: los IDs van cifrados
// en acceso.json (ver acceso.js).
//
// «tramos»: filas donde empieza cada parte de un rango (controles,
// encabezados, datos). gviz da un solo tipo por columna y así no se pierden
// textos dentro de columnas numéricas.
//
// Para conectar otro negocio: agrega su archivo aquí (nombre y rangos) y un
// lector en modelo.js que convierta esos rangos en pendientes o cifras.

// Conversión que usan las fórmulas de 💵REGISTRO DE PRESTAMOS
// (DASHBOARD!B18, HOJA DATA!I:J, DASHBOARD!C12): 1 USDT = 18 MXN.
export const TIPO_CAMBIO_USDT = 18;

export const ARCHIVOS = {
  nayarsound: {
    nombre: '🐯NAYARSOUND - PERSONAL',
    rangos: {
      dashboard: "'DASHBOARD'!A1:E200",
      ventas: "'AGENDA Y VENTAS'!A11:U",
    },
    tramos: { ventas: [11, 12, 13] },
  },
  agenda: {
    nombre: 'AMAL AGENDA',
    rangos: {
      agenda: "'AGENDA'!A9:T",
    },
    tramos: { agenda: [9, 12, 13] },
  },
  prestamos: {
    nombre: '💵REGISTRO DE PRESTAMOS',
    rangos: {
      dashboard: "'DASHBOARD'!A1:E60",
      registro: "'REGISTRO PRESTAMOS'!A8:M",
      inversores: "'REGISTRO DE INVERSORES'!A9:R",
    },
    tramos: { registro: [8, 9], inversores: [9, 10] },
  },
  gastos: {
    nombre: '🚹GASTOS PERSONALES - OSVALDO',
    rangos: {
      balance: "'DASHBOARD BALANCE GENERAL'!A7:N80",
      gastos: "'ANALISIS GASTOS PERSONALES'!A3:H",
    },
    tramos: { balance: [7, 8], gastos: [3, 4] },
  },
};

export const ORDEN_ARCHIVOS = ['nayarsound', 'agenda', 'prestamos', 'gastos'];
