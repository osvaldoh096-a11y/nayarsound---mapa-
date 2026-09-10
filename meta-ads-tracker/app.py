from flask import Flask, render_template, request, redirect, url_for

from db import get_connection, init_db

app = Flask(__name__)


def _competitor_form_data(form):
    return {
        "name": form.get("name", "").strip(),
        "city": form.get("city", "").strip(),
        "category": form.get("category", "").strip(),
        "facebook_page": form.get("facebook_page", "").strip(),
        "ads_library_url": form.get("ads_library_url", "").strip(),
    }


@app.route("/")
def index():
    conn = get_connection()
    competitors = conn.execute(
        "SELECT * FROM competitors ORDER BY name COLLATE NOCASE"
    ).fetchall()
    conn.close()
    return render_template("index.html", competitors=competitors)


@app.route("/competitors/new", methods=["GET", "POST"])
def new_competitor():
    if request.method == "POST":
        data = _competitor_form_data(request.form)
        if not data["name"]:
            return render_template(
                "form.html", competitor=None, error="El nombre es obligatorio.", values=data
            )
        conn = get_connection()
        conn.execute(
            """INSERT INTO competitors (name, city, category, facebook_page, ads_library_url)
               VALUES (?, ?, ?, ?, ?)""",
            (data["name"], data["city"], data["category"], data["facebook_page"], data["ads_library_url"]),
        )
        conn.commit()
        conn.close()
        return redirect(url_for("index"))
    return render_template("form.html", competitor=None, error=None, values=None)


@app.route("/competitors/<int:competitor_id>/edit", methods=["GET", "POST"])
def edit_competitor(competitor_id):
    conn = get_connection()
    competitor = conn.execute(
        "SELECT * FROM competitors WHERE id = ?", (competitor_id,)
    ).fetchone()
    if competitor is None:
        conn.close()
        return redirect(url_for("index"))

    if request.method == "POST":
        data = _competitor_form_data(request.form)
        if not data["name"]:
            conn.close()
            return render_template(
                "form.html", competitor=competitor, error="El nombre es obligatorio.", values=data
            )
        conn.execute(
            """UPDATE competitors
               SET name = ?, city = ?, category = ?, facebook_page = ?, ads_library_url = ?
               WHERE id = ?""",
            (data["name"], data["city"], data["category"], data["facebook_page"], data["ads_library_url"], competitor_id),
        )
        conn.commit()
        conn.close()
        return redirect(url_for("index"))

    conn.close()
    return render_template("form.html", competitor=competitor, error=None, values=None)


@app.route("/competitors/<int:competitor_id>/delete", methods=["POST"])
def delete_competitor(competitor_id):
    conn = get_connection()
    conn.execute("DELETE FROM competitors WHERE id = ?", (competitor_id,))
    conn.commit()
    conn.close()
    return redirect(url_for("index"))


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
