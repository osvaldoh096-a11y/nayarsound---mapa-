"""
Prueba minima de viabilidad: abre la URL de Meta Ads Library de UN competidor
ya registrado y extrae lo que la pagina exponga de forma fiable en el HTML
renderizado (sin login, sin API de pago).

No diseña historial ni modelo de datos de anuncios todavia. Es solo para
inspeccionar en consola/JSON que datos son extraibles de verdad.

Uso:
    python scripts/probe_ads_library.py [competitor_id]

Si no se pasa id, usa el primer competidor de la base de datos que tenga
ads_library_url.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db import get_connection  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402


def get_competitor(competitor_id=None):
    conn = get_connection()
    if competitor_id:
        row = conn.execute(
            "SELECT * FROM competitors WHERE id = ?", (competitor_id,)
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT * FROM competitors WHERE ads_library_url IS NOT NULL AND ads_library_url != '' LIMIT 1"
        ).fetchone()
    conn.close()
    return row


def extract_ad_cards(page):
    """
    Meta no expone data-testid ni IDs estables para las tarjetas de anuncio;
    el unico ancla fiable en el HTML es el texto "Library ID:" que Meta
    siempre imprime junto al ID real del anuncio. Se usa eso como raiz de
    cada tarjeta en lugar de clases CSS (que son hashes generados y cambian
    entre despliegues de Facebook).
    """
    return page.evaluate(
        """
        () => {
            const results = [];
            const all = Array.from(document.querySelectorAll('div'));
            const anchors = all.filter(el =>
                el.children.length === 0 && /Library ID:\\s*\\d+/.test(el.textContent || '')
            );
            for (const anchor of anchors) {
                let card = anchor;
                for (let i = 0; i < 8 && card.parentElement; i++) {
                    card = card.parentElement;
                    if (card.querySelectorAll('a').length > 0 && card.innerText.length > 200) break;
                }
                const text = card.innerText || '';
                const idMatch = text.match(/Library ID:\\s*(\\d+)/);
                const startedMatch = text.match(/Started running on\\s*([A-Za-z0-9 ,]+)/);
                const statusMatch = text.match(/\\b(Active|Inactive)\\b/);
                const links = Array.from(card.querySelectorAll('a[href]')).map(a => a.href);
                const images = Array.from(card.querySelectorAll('img[src]')).map(i => i.src);

                results.push({
                    library_id: idMatch ? idMatch[1] : null,
                    status: statusMatch ? statusMatch[1] : null,
                    started_running_on: startedMatch ? startedMatch[1].trim() : null,
                    raw_text: text.slice(0, 800),
                    links: [...new Set(links)].slice(0, 5),
                    creative_image_urls: [...new Set(images)].slice(0, 3),
                });
            }
            return results;
        }
        """
    )


def main():
    competitor_id = int(sys.argv[1]) if len(sys.argv) > 1 else None
    competitor = get_competitor(competitor_id)

    if competitor is None:
        print(json.dumps({"error": "No hay ningun competidor con ads_library_url guardada."}))
        return

    url = competitor["ads_library_url"]
    result = {
        "competitor": competitor["name"],
        "ads_library_url": url,
        "limitations": [],
        "ads": [],
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(locale="es-MX")

        try:
            response = page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            if response is None:
                result["limitations"].append("La navegacion no devolvio respuesta (posible bloqueo de red).")
            elif response.status >= 400:
                result["limitations"].append(f"HTTP {response.status} al cargar la Ads Library.")

            body_text = page.inner_text("body")

            if "log in" in body_text.lower() or "iniciar sesion" in body_text.lower():
                if "You must log in" in body_text or "log in to see" in body_text.lower():
                    result["limitations"].append(
                        "Meta pidio inicio de sesion para ver el contenido completo."
                    )

            for _ in range(3):
                page.mouse.wheel(0, 2000)
                page.wait_for_timeout(1500)

            ads = extract_ad_cards(page)
            result["ads"] = ads

            if not ads:
                result["limitations"].append(
                    "No se detectaron tarjetas de anuncio con el ancla 'Library ID:' "
                    "en el HTML renderizado. Posibles causas: la pagina no tiene anuncios "
                    "activos, el layout cambio, o el contenido requiere mas scroll/tiempo."
                )
        except Exception as exc:  # noqa: BLE001
            result["limitations"].append(f"Excepcion durante el scraping: {exc}")
        finally:
            browser.close()

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
