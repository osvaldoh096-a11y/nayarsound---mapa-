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

## Pensado para crecer

`db.py` centraliza el esquema de la base de datos para poder agregar tablas
nuevas sin tocar las rutas existentes. Próximas iteraciones previstas:

- Tabla `ads` vinculada a `competitors` (creativos, textos, precios/ofertas).
- Tabla de historial para detectar anuncios nuevos/inactivos.
- Módulo de automatización con navegador para leer Meta Ads Library.

No se ha construido nada de scraping/automatización todavía: esta versión es
únicamente la base de datos de competidores y la interfaz para gestionarla.
