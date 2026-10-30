import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
export const CUENTA_ACCESO = import.meta.env.VITE_CUENTA_ACCESO as string

export const supabase = createClient(url, clave, {
  auth: {
    // La sesión vive solo en esta pestaña; al cerrarla hay que volver a entrar.
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    // Ninguna respuesta con datos se guarda en la caché del navegador.
    fetch: (entrada, opciones) => fetch(entrada, { ...opciones, cache: 'no-store' }),
  },
})
