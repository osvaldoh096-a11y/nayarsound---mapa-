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
      dashboard: "'DASHBOARD'!A1:E60",
      registro: "'REGISTRO PRESTAMOS'!A8:M",
      inversores: "'REGISTRO DE INVERSORES'!A9:R",
    },
  },
  gastos: {
    nombre: '🚹GASTOS PERSONALES - OSVALDO',
    id: '1NoUH0e52iilpAKEzt6LAYMe9yEGm_Pd5zfEDXf3AkK4',
    pestanas: { 'DASHBOARD BALANCE GENERAL': 522944238, 'ANALISIS GASTOS PERSONALES': 0 },
    zona: 'America/Mexico_City',
    rangos: {
      balance: "'DASHBOARD BALANCE GENERAL'!A7:N80",
      gastos: "'ANALISIS GASTOS PERSONALES'!A3:H",
    },
  },
};

export const ORDEN_ARCHIVOS = ['nayarsound', 'agenda', 'prestamos', 'gastos'];

// Lista de tareas del Inicio: un archivo propio, aparte de tus hojas de
// negocio. Columnas: TAREA, HECHA (SI), CREADA, COMPLETADA.
export const TAREAS = {
  nombre: 'TO DO · Dashboard personal',
  id: '1A49h6L76bZUVkUaIzf_lYCwG2Hh-biPjbwGbYXpJrz4',
  pestana: 'TAREAS',
  gid: 1899581123,
};
