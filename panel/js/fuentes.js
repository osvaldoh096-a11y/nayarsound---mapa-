// Qué se lee de cada archivo. Los IDs no dan acceso: las hojas están
// restringidas y Google solo entrega datos a cuentas autorizadas.

// ID de cliente de Google (proyecto «dashboard personal»). No es secreto:
// solo funciona desde los sitios autorizados en Google Cloud.
export const CLIENTE_GOOGLE = '3490475474-q4pacirai8eifh03o7ulisha461tb1ku.apps.googleusercontent.com';
//
// Para conectar otro negocio: agrega su archivo aquí (nombre y rangos) y un
// lector en modelo.js que convierta esos rangos en pendientes o cifras.

// Conversión que usan las fórmulas de 💵REGISTRO DE PRESTAMOS
// (DASHBOARD!B18, HOJA DATA!I:J, DASHBOARD!C12): 1 USDT = 18 MXN.
export const TIPO_CAMBIO_USDT = 18;

export const ARCHIVOS = {
  nayarsound: {
    nombre: '🐯NAYARSOUND - PERSONAL',
    id: '1wMaqW1iCiL8Lv4u-6Txd_m662xSmjzqzcXB_NzYK0qg',
    pestanas: { DASHBOARD: 1764740539, 'AGENDA Y VENTAS': 399951478 },
    zona: 'America/Los_Angeles',
    rangos: {
      dashboard: "'DASHBOARD'!A1:E200",
      ventas: "'AGENDA Y VENTAS'!A11:U",
    },
  },
  agenda: {
    nombre: 'AMAL AGENDA',
    id: '1FKaobilQ1HNHXntMxnFgoPld5In4dwSNsQgt-78yk4o',
    pestanas: { AGENDA: 0, DATA: 1286754118 },
    zona: 'America/Mexico_City',
    rangos: {
      agenda: "'AGENDA'!A9:T",
      // DJs de planta (CIUDAD, NOMBRE, COORDENADAS, SONIDO, TELEFONO): de aquí sale el WhatsApp.
      djs: "'DATA'!A2:Z200",
    },
  },
  prestamos: {
    nombre: '💵REGISTRO DE PRESTAMOS',
    id: '1JKqaM9sI3tVXeEccvbtQuiTQvhUSbpbUprq3Qcv9DqA',
    pestanas: { DASHBOARD: 873980962, 'REGISTRO PRESTAMOS': 2091243089, 'REGISTRO DE INVERSORES': 523120444 },
    zona: 'America/Los_Angeles',
    rangos: {
      dashboard: "'DASHBOARD'!A1:R150",
      registro: "'REGISTRO PRESTAMOS'!A8:M",
      // A:R inversiones; U:AA registro de pagos de intereses (OP, FECHA, CANTIDAD, INVERTIDO, DIVISA, NOMBRE, AUXILIAR).
      inversores: "'REGISTRO DE INVERSORES'!A9:AA",
    },
  },
  gastos: {
    nombre: '🚹GASTOS PERSONALES - OSVALDO',
    id: '1NoUH0e52iilpAKEzt6LAYMe9yEGm_Pd5zfEDXf3AkK4',
    pestanas: { 'DASHBOARD BALANCE GENERAL': 522944238, 'ANALISIS GASTOS PERSONALES': 0, 'ANALISIS BALANCE GENERAL': 1266587410 },
    zona: 'America/Mexico_City',
    rangos: {
      balance: "'DASHBOARD BALANCE GENERAL'!A1:N80",
      gastos: "'ANALISIS GASTOS PERSONALES'!A3:H",
      // Ganancia de cada negocio por mes, desde 2025 (para ver el año completo).
      analisis: "'ANALISIS BALANCE GENERAL'!A1:Z2000",
    },
  },
  st: {
    nombre: '🖥️ST- SISTEMAS Y TECNOLOGIA - PERSONAL',
    id: '1fL0oow1VQZLS9sVqjdXSHQlwvQuBR5z5TW_UDd245BA',
    pestanas: { DASHBOARD: 393168975, 'HOJA DE VENTAS': 1293603055, 'STOCK, OPERACION': 1527462282 },
    zona: 'America/Los_Angeles',
    rangos: {
      dashboard: "'DASHBOARD'!A1:F120",
      ventas: "'HOJA DE VENTAS'!A8:Z",
      stock: "'STOCK, OPERACION'!K1:R80",
    },
  },
};

export const ORDEN_ARCHIVOS = ['nayarsound', 'agenda', 'prestamos', 'gastos', 'st'];

// Lista de tareas del Inicio: un archivo propio, aparte de tus hojas de
// negocio. Columnas: TAREA, HECHA (SI), CREADA, COMPLETADA.
export const TAREAS = {
  nombre: 'TO DO · Dashboard personal',
  id: '1A49h6L76bZUVkUaIzf_lYCwG2Hh-biPjbwGbYXpJrz4',
  pestana: 'TAREAS',
  gid: 1899581123,
};

// Categorías de gasto que son lo mismo con distinto nombre: el panel las
// junta bajo el nombre de la derecha. Mayúsculas, acentos y espacios ya se
// ignoran solos («hormiga» = «HORMIGA»). Tu hoja no se modifica.
export const CATEGORIAS_IGUALES = {
  CASETAS: 'AUTOPISTA',
  'STREAM Y CINE': 'STREAMING',
  WIFI: 'INTERNET CASA',
  SUPERMERCADO: 'DESPENSA',
};
