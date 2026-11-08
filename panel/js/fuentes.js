// Qué se lee de cada archivo. Aquí no hay IDs ni datos: los IDs se guardan
// solo en tu navegador (ver config.js).
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
  },
  agenda: {
    nombre: 'AMAL AGENDA',
    rangos: {
      agenda: "'AGENDA'!A9:T",
    },
  },
  prestamos: {
    nombre: '💵REGISTRO DE PRESTAMOS',
    rangos: {
      dashboard: "'DASHBOARD'!A1:E60",
      registro: "'REGISTRO PRESTAMOS'!A8:M",
      inversores: "'REGISTRO DE INVERSORES'!A9:R",
    },
  },
  gastos: {
    nombre: '🚹GASTOS PERSONALES - OSVALDO',
    rangos: {
      balance: "'DASHBOARD BALANCE GENERAL'!A1:N80",
      gastos: "'ANALISIS GASTOS PERSONALES'!A3:H",
    },
  },
};

export const ORDEN_ARCHIVOS = ['nayarsound', 'agenda', 'prestamos', 'gastos'];
