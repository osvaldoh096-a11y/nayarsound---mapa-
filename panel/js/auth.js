// Inicio de sesión con Google (Google Identity Services, modelo de token).
// Permiso pedido: solo lectura de hojas de cálculo. El token dura ~1 hora y
// vive únicamente en la memoria de esta pestaña: no se guarda en el
// navegador ni se envía a otro servidor que no sea Google.

export const PERMISO = 'https://www.googleapis.com/auth/spreadsheets.readonly';

let cliente = null;
let token = null;
let expira = 0;
let pendiente = null;

function esperarGIS(limiteMs = 15000) {
  return new Promise((resolve, reject) => {
    const inicio = Date.now();
    (function revisar() {
      if (window.google?.accounts?.oauth2) return resolve(window.google.accounts.oauth2);
      if (Date.now() - inicio > limiteMs) return reject(new Error('No cargó el inicio de sesión de Google. Revisa tu conexión.'));
      setTimeout(revisar, 100);
    }());
  });
}

export async function prepararSesion(clienteId) {
  const oauth2 = await esperarGIS();
  cliente = oauth2.initTokenClient({
    client_id: clienteId,
    scope: PERMISO,
    callback: (respuesta) => {
      const p = pendiente; pendiente = null;
      if (!p) return;
      if (respuesta.error) return p.reject(new Error(mensajeError(respuesta.error)));
      if (!oauth2.hasGrantedAllScopes(respuesta, PERMISO)) {
        return p.reject(new Error('Necesito el permiso de lectura de tus hojas para mostrar los datos.'));
      }
      token = respuesta.access_token;
      expira = Date.now() + (Number(respuesta.expires_in || 3600) - 60) * 1000;
      p.resolve(token);
    },
    error_callback: (error) => {
      const p = pendiente; pendiente = null;
      if (p) p.reject(new Error(mensajeError(error?.type)));
    },
  });
}

function mensajeError(tipo) {
  if (tipo === 'popup_closed' || tipo === 'access_denied') return 'Se canceló el inicio de sesión.';
  if (tipo === 'popup_failed_to_open') return 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes para esta página.';
  return `No se pudo iniciar sesión con Google (${tipo || 'error desconocido'}).`;
}

/** Pide un token. Debe llamarse desde un toque/clic del usuario. */
export function iniciarSesion() {
  if (!cliente) return Promise.reject(new Error('El inicio de sesión aún no está listo.'));
  if (pendiente) return new Promise((resolve, reject) => { pendiente = { resolve, reject }; });
  return new Promise((resolve, reject) => {
    pendiente = { resolve, reject };
    cliente.requestAccessToken({ prompt: '' });
  });
}

export function tokenVigente() {
  return token && Date.now() < expira ? token : null;
}

export function olvidarToken() {
  token = null;
  expira = 0;
}

export function cerrarSesion() {
  const t = token;
  olvidarToken();
  if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t, () => {});
}
