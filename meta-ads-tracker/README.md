# Meta Ads Competitor Tracker (MVP)

Herramienta local y gratuita para organizar competidores que luego se vigilarán
en Meta Ads Library. Esta primera versión solo gestiona el listado de
competidores (CRUD); todavía no hace scraping ni automatización.

## Requisitos

- Python 3.9+
- Sin servicios ni APIs de pago. Todo corre en local con SQLite.

## Instalación y ejecución (Windows)

```
cd meta-ads-tracker
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Abre el navegador en: http://127.0.0.1:5000

Los datos se guardan en `meta-ads-tracker/data.db` (SQLite) y persisten aunque
cierres el programa. Ese archivo no se sube al repositorio (ver `.gitignore`).

## Funcionalidad de esta versión

- Crear, editar y eliminar competidores.
- Guardar por competidor: nombre, ciudad, categoría, página de Facebook y URL
  de Meta Ads Library.
- Dashboard con la lista de todos los competidores.
- Botón para abrir directamente la URL de Meta Ads Library del competidor en
  una pestaña nueva.

## Estructura del proyecto

```
meta-ads-tracker/
  app.py            Rutas Flask (CRUD de competidores)
  db.py             Conexión SQLite e inicialización del esquema
  templates/        Vistas Jinja (dashboard y formulario)
  static/style.css  Estilos
  data.db           Base de datos SQLite (se crea al ejecutar, no versionada)
```

## Prueba de viabilidad: Playwright sobre Meta Ads Library

`scripts/probe_ads_library.py` es una prueba MÍNIMA, aislada de la app, para
validar qué datos se pueden extraer de la Ads Library de un competidor ya
registrado ANTES de diseñar el modelo de datos de anuncios. No guarda nada en
la base de datos ni implementa historial.

```
pip install -r requirements.txt
playwright install chromium
python scripts/probe_ads_library.py [id_competidor]
```

Sin argumento usa el primer competidor con `ads_library_url` guardada. Imprime
un JSON con los anuncios detectados (`library_id`, `status`, fecha de inicio,
texto, links y URLs de creativos) o, si algo falla, una lista `limitations`
explicando exactamente qué no se pudo obtener y por qué.

**Nota:** esta prueba no se pudo ejecutar contra facebook.com desde este
entorno en la nube porque la política de red del sandbox bloquea toda salida
HTTP saliente (incluso a `example.com`, con 403 del proxy de la organización).
No es un bloqueo de Meta ni requiere login — es una restricción del entorno de
desarrollo remoto. Debe correrse en tu máquina Windows, donde sí hay salida a
internet normal, y reportar el JSON resultante para diseñar el modelo de datos
sobre resultados reales.

## Pensado para crecer

`db.py` centraliza el esquema de la base de datos para poder agregar tablas
nuevas sin tocar las rutas existentes. Próximas iteraciones previstas:

- Tabla `ads` vinculada a `competitors` (creativos, textos, precios/ofertas).
- Tabla de historial para detectar anuncios nuevos/inactivos.
- Módulo de automatización con navegador para leer Meta Ads Library.

No se ha construido nada de scraping/automatización todavía: esta versión es
únicamente la base de datos de competidores y la interfaz para gestionarla.
