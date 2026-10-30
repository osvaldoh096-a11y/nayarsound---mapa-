// Prueba de la interfaz en un navegador real con datos ficticios.
// La API de Supabase se simula en memoria (las reglas de acceso de la base se prueban aparte con SQL).
// Uso: npm run build && npx vite preview --port 4173 & node pruebas/interfaz.mjs <carpeta-capturas>
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = 'http://localhost:4173'
const CAPTURAS = process.argv[2] ?? 'capturas'
mkdirSync(CAPTURAS, { recursive: true })
const CLAVE = 'clave-ficticia-de-prueba' // la API simulada acepta solo esta
const UID = '00000000-0000-4000-8000-000000000001'

// ---- Datos ficticios ----
const db = { personas: [], operaciones: [], pagos: [], ajustes: [] }
const persona = (tipo, nombre, pago_diferido = false) => {
  const p = { id: randomUUID(), owner_id: UID, tipo, nombre, pago_diferido, eliminado: null }
  db.personas.push(p)
  return p.id
}
let orden = 0
const operacion = (o) => {
  const fila = { id: randomUUID(), owner_id: UID, pago_mensual: 'SI', divisa: 'MXN', equivalencia: null, fecha_compromiso: null, dia_final: null, eliminado: null, ...o }
  db.operaciones.push(fila)
  return fila.id
}
const pago = (tipo, operacion_id, fecha, cantidad) => db.pagos.push({ id: randomUUID(), owner_id: UID, tipo, operacion_id, fecha, cantidad, orden: ++orden, eliminado: null })

const ana = persona('prestatario', 'ANA PRUEBA')
const beto = persona('prestatario', 'BETO EJEMPLO', true)
const ciro = persona('prestatario', 'CIRO FICTICIO')
const dora = persona('prestatario', 'DORA DEMO')
const eva = persona('inversor', 'EVA INVERSORA')
const fito = persona('inversor', 'FITO CAPITAL')
let op = 0
const hoy = new Date()
const iso = (d) => d.toISOString().slice(0, 10)
const haceDias = (n) => iso(new Date(hoy.getTime() - n * 86400000))
for (let k = 0; k < 14; k++) {
  const id = operacion({ tipo: 'prestamo', op: ++op, persona_id: [ana, beto, ciro, dora][k % 4], fecha_inicio: haceDias(400 - k * 25), cantidad: 5000 + k * 1500, tasa: 0.1, estado: 'LIQUIDADO', dia_final: haceDias(370 - k * 25) })
  pago('prestamo', id, haceDias(372 - k * 25), (5000 + k * 1500) * 0.1)
}
const a1 = operacion({ tipo: 'prestamo', op: ++op, persona_id: ana, fecha_inicio: haceDias(120), cantidad: 100000, tasa: 0.08, estado: 'ACTIVO', fecha_compromiso: haceDias(-1) })
pago('prestamo', a1, haceDias(90), 8000)
pago('prestamo', a1, haceDias(60), 8000)
operacion({ tipo: 'prestamo', op: ++op, persona_id: beto, fecha_inicio: haceDias(40), cantidad: 20000, tasa: 0.1, estado: 'ACTIVO', fecha_compromiso: haceDias(-3) })
const c1 = operacion({ tipo: 'prestamo', op: ++op, persona_id: ciro, fecha_inicio: haceDias(70), cantidad: 12500, tasa: 0.1, estado: 'ACTIVO', fecha_compromiso: haceDias(-10) })
pago('prestamo', c1, haceDias(40), 1250)
operacion({ tipo: 'prestamo', op: ++op, persona_id: dora, fecha_inicio: haceDias(15), divisa: 'USDT', cantidad: 800, tasa: 0.1, estado: 'ACTIVO' })
let iop = 0
const e1 = operacion({ tipo: 'inversion', op: ++iop, persona_id: eva, fecha_inicio: haceDias(200), cantidad: 150000, tasa: 0.04, estado: 'ACTIVO', fecha_compromiso: haceDias(-20) })
pago('inversion', e1, haceDias(170), 6000)
pago('inversion', e1, haceDias(140), 6000)
operacion({ tipo: 'inversion', op: ++iop, persona_id: fito, fecha_inicio: haceDias(90), divisa: 'USDT', cantidad: 3000, equivalencia: 54000, tasa: 0.035, estado: 'ACTIVO' })
pago('inversion', null, haceDias(500), 1000)

// ---- API simulada ----
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 3600
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', aud: 'authenticated', exp, iat: exp - 3600, email: 'acceso@example.com', session_id: randomUUID(), aal: 'aal1' })}.firma`
const usuario = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'acceso@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
const peticiones = []

function filtrar(tabla, params) {
  let filas = db[tabla]
  for (const [k, v] of params) {
    if (['select', 'order', 'offset', 'limit', 'columns', 'on_conflict'].includes(k)) continue
    const val = v.replace(/^eq\./, '')
    filas = filas.filter((f) => String(f[k]) === val)
  }
  return filas
}

async function api(route) {
  const req = route.request()
  const url = new URL(req.url())
  const metodo = req.method()
  peticiones.push(`${metodo} ${url.pathname}`)
  const json = (status, cuerpo, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...headers }, body: cuerpo === undefined ? '' : JSON.stringify(cuerpo) })
  if (metodo === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
  if (url.pathname === '/auth/v1/token') {
    const cuerpo = JSON.parse(req.postData() ?? '{}')
    if (cuerpo.password !== CLAVE) return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
    return json(200, { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresco', user: usuario })
  }
  if (url.pathname === '/auth/v1/user') return json(200, usuario)
  if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
  if (!req.headers()['authorization']?.includes(token)) return json(401, { message: 'permission denied' })
  if (url.pathname === '/rest/v1/rpc/restaurar_respaldo') {
    const { datos } = JSON.parse(req.postData())
    db.personas = datos.personas.map((x) => ({ ...x, owner_id: UID }))
    db.operaciones = datos.operaciones.map((x) => ({ ...x, owner_id: UID }))
    db.pagos = datos.pagos.map((x) => ({ ...x, owner_id: UID }))
    return json(200, { personas: db.personas.length, operaciones: db.operaciones.length, pagos: db.pagos.length })
  }
  const tabla = url.pathname.replace('/rest/v1/', '')
  if (!db[tabla]) return json(404, { message: 'no existe' })
  const unico = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
  if (metodo === 'GET') return json(200, filtrar(tabla, url.searchParams))
  if (metodo === 'POST') {
    const fila = { id: randomUUID(), owner_id: UID, eliminado: null, ...JSON.parse(req.postData()) }
    if (tabla === 'operaciones' && !fila.op) fila.op = Math.max(0, ...db.operaciones.filter((o) => o.tipo === fila.tipo).map((o) => o.op)) + 1
    if (tabla === 'pagos') fila.orden = ++orden
    if (tabla === 'ajustes') db.ajustes = []
    db[tabla].push(fila)
    return json(201, unico ? fila : [fila])
  }
  if (metodo === 'PATCH') {
    const filas = filtrar(tabla, url.searchParams)
    const cambios = JSON.parse(req.postData())
    filas.forEach((f) => Object.assign(f, cambios))
    return json(200, unico ? filas[0] : filas)
  }
  if (metodo === 'DELETE') {
    const quitar = new Set(filtrar(tabla, url.searchParams))
    db[tabla] = db[tabla].filter((f) => !quitar.has(f))
    return json(204)
  }
  return json(405, {})
}

// ---- Recorrido ----
const navegador = await chromium.launch()
const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true })
await contexto.route('https://fccitogjxruqxuhprnia.supabase.co/**', api)
const pagina = await contexto.newPage()
const erroresConsola = []
pagina.on('pageerror', (e) => erroresConsola.push(e.message))
pagina.on('console', (m) => m.type() === 'error' && erroresConsola.push(m.text()))
pagina.on('dialog', (d) => d.dismiss())
const ok = (cond, msg) => {
  if (!cond) throw new Error('FALLÓ: ' + msg)
  console.log('✓', msg)
}
const foto = (nombre) => pagina.screenshot({ path: `${CAPTURAS}/${nombre}.png`, fullPage: true })

await pagina.goto(BASE)
ok((await pagina.title()) === 'Panel', 'título discreto "Panel"')
await pagina.getByLabel('Contraseña').waitFor()
const textoAcceso = await pagina.locator('body').innerText()
ok(!/\$|ANA|OP /.test(textoAcceso), 'la pantalla de acceso no muestra nombres ni cantidades')
await foto('01-acceso')

await pagina.getByLabel('Contraseña').fill('equivocada')
await pagina.getByRole('button', { name: 'Entrar' }).click()
await pagina.getByText('Contraseña incorrecta.').waitFor()
ok(true, 'contraseña incorrecta rechazada')
erroresConsola.length = 0 // el 400 de la contraseña equivocada es esperado

await pagina.getByLabel('Contraseña').fill(CLAVE)
await pagina.getByRole('button', { name: 'Entrar' }).click()
await pagina.getByRole('heading', { name: 'Resumen financiero' }).waitFor()
ok(true, 'acceso con la contraseña correcta')
await foto('02-inicio-resumen')

await pagina.getByRole('button', { name: 'Historial' }).click()
await pagina.getByRole('heading', { name: 'Ganancias históricas' }).waitFor()
await foto('03-inicio-historial')
await pagina.getByRole('button', { name: 'Mensajes' }).click()
await pagina.getByRole('heading', { name: 'Recordatorio 5 días' }).waitFor()
await foto('04-inicio-mensajes')

// Préstamos: lista, ficha y pago parcial
await pagina.getByRole('link', { name: /Préstamos/ }).click()
await pagina.getByText('OP 15 · ANA PRUEBA').waitFor()
await foto('05-prestamos')
await pagina.getByText('OP 15 · ANA PRUEBA').click()
await pagina.getByRole('heading', { name: 'OP 15 · ANA PRUEBA' }).waitFor()
const restanteAntes = await pagina.locator('.kpi').first().innerText()
await foto('06-ficha')
await pagina.getByRole('button', { name: '+ Pago' }).click()
await pagina.getByLabel(/Cantidad/).fill('1500')
await pagina.getByRole('button', { name: 'Guardar pago' }).click()
await pagina.getByText('Pagos (3)').waitFor()
const restanteDespues = await pagina.locator('.kpi').first().innerText()
ok(restanteAntes !== restanteDespues, `pago parcial recalcula el interés restante (${restanteAntes.replace(/\n/g, ' ')} → ${restanteDespues.replace(/\n/g, ' ')})`)

// Mensaje de reestructuración
await pagina.getByRole('button', { name: 'Reestructuración' }).click()
await pagina.getByLabel('Abonado').fill('9000')
ok((await pagina.locator('pre.mensaje').innerText()).includes('RENOVACION DE PRESTAMO'), 'mensaje de renovación generado')

// Eliminar un pago (con confirmación) y recuperarlo desde la papelera
await pagina.getByRole('button', { name: 'Eliminar pago' }).first().click()
await pagina.getByRole('dialog', { name: 'Eliminar pago' }).waitFor()
await foto('07-confirmar-eliminar')
await pagina.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click()
await pagina.getByText('Pagos (2)').waitFor()
ok(true, 'pago eliminado tras confirmar')
await pagina.goto(BASE + '/#/papelera')
await pagina.getByRole('button', { name: 'Recuperar' }).first().click()
await pagina.getByText('La papelera está vacía.').waitFor()
ok(true, 'pago recuperado desde la papelera')

// Liquidar
await pagina.goto(BASE + '/#/prestamos')
await pagina.getByText('OP 16 · BETO EJEMPLO').click()
await pagina.getByRole('button', { name: 'Liquidar' }).click()
await pagina.getByRole('dialog').getByRole('button', { name: 'Liquidar' }).click()
await pagina.locator('.cabecera .insignia', { hasText: 'LIQUIDADO' }).waitFor()
ok(true, 'operación liquidada con día final fijo')

// Nuevo préstamo con persona nueva
await pagina.goto(BASE + '/#/prestamos')
await pagina.getByRole('button', { name: '+ Préstamo' }).click()
await pagina.getByPlaceholder('Nombre de la nueva persona').fill('GINA NUEVA')
await pagina.getByLabel('Cantidad').fill('7,500')
await pagina.getByLabel('Interés mensual (%)').fill('10')
await foto('08-nuevo-prestamo')
await pagina.getByRole('button', { name: 'Guardar' }).click()
await pagina.getByRole('heading', { name: /OP 19 · GINA NUEVA/ }).waitFor()
ok(true, 'préstamo nuevo creado con OP consecutiva 19')

// Inversores y pagos
await pagina.goto(BASE + '/#/inversores')
await pagina.getByText('OP 2 · FITO CAPITAL').waitFor()
await foto('09-inversores')
await pagina.goto(BASE + '/#/pagos')
await pagina.getByText(/registros/).waitFor()
await foto('10-pagos')
await pagina.goto(BASE + '/#/personas')
await pagina.getByText('BETO EJEMPLO').waitFor()
await foto('11-personas')

// Respaldo cifrado y restauración
await pagina.goto(BASE + '/#/respaldo')
await pagina.locator('#r-c1').fill('respaldo-2026')
await pagina.getByLabel('Repite la contraseña').fill('respaldo-2026')
const [descarga] = await Promise.all([pagina.waitForEvent('download'), pagina.getByRole('button', { name: 'Descargar respaldo' }).click()])
const ruta = `${CAPTURAS}/respaldo.panel`
await descarga.saveAs(ruta)
const contenido = readFileSync(ruta, 'utf8')
ok(!contenido.includes('ANA PRUEBA') && JSON.parse(contenido).formato === 'panel-cifrado-v1', 'el respaldo descargado está cifrado (no contiene nombres legibles)')
const operacionesAntes = db.operaciones.length
db.operaciones = db.operaciones.slice(0, 3) // simula pérdida de datos
await pagina.locator('#r-archivo').setInputFiles(ruta)
await pagina.locator('#r-clave').fill('mala')
await pagina.getByRole('button', { name: 'Abrir respaldo' }).click()
await pagina.getByText('Contraseña incorrecta o archivo dañado.').waitFor()
ok(true, 'respaldo rechaza contraseña incorrecta')
await pagina.locator('#r-clave').fill('respaldo-2026')
await pagina.getByRole('button', { name: 'Abrir respaldo' }).click()
await pagina.getByRole('button', { name: 'Restaurar este respaldo' }).click()
await pagina.getByLabel('Escribe RESTAURAR para confirmar').fill('restaurar')
const [previo] = await Promise.all([pagina.waitForEvent('download'), pagina.getByRole('dialog').getByRole('button', { name: 'Restaurar' }).click()])
ok(previo.suggestedFilename().startsWith('respaldo-antes-de-restaurar'), 'antes de restaurar se descarga copia de lo actual')
await pagina.getByText(/Restaurado:/).waitFor()
ok(db.operaciones.length === operacionesAntes, `restauración recupera las ${operacionesAntes} operaciones`)

const [csv] = await Promise.all([pagina.waitForEvent('download'), pagina.getByRole('button', { name: 'Exportar CSV' }).click()])
ok(csv.suggestedFilename().endsWith('.zip'), 'exportación CSV en .zip')

// Almacenamiento del navegador
const almacen = await pagina.evaluate(() => ({ local: Object.keys(localStorage), sesion: Object.keys(sessionStorage) }))
ok(almacen.local.length === 0, 'localStorage vacío (no se guardan datos financieros)')
ok(almacen.sesion.every((k) => k.includes('auth-token')), 'sessionStorage solo guarda el token de sesión')

// Escritorio
await pagina.setViewportSize({ width: 1280, height: 900 })
await pagina.goto(BASE + '/#/inicio')
await pagina.getByRole('heading', { name: 'Resumen financiero' }).waitFor()
await foto('12-escritorio')

// Cerrar sesión
await pagina.setViewportSize({ width: 390, height: 844 })
await pagina.goto(BASE + '/#/mas')
await pagina.getByRole('button', { name: 'Cerrar sesión' }).click()
await pagina.getByLabel('Contraseña').waitFor()
const tras = await pagina.evaluate(() => Object.keys(sessionStorage).length + Object.keys(localStorage).length)
ok(tras === 0 && !(await pagina.locator('body').innerText()).includes('ANA'), 'al cerrar sesión no queda información en pantalla ni en el navegador')

ok(erroresConsola.length === 0, 'sin errores en la consola' + (erroresConsola.length ? ': ' + erroresConsola.join(' | ') : ''))
await navegador.close()
