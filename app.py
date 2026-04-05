from __future__ import annotations

import os
import re
from datetime import date

from flask import Flask, jsonify, render_template, request

from core import sentiment
from core.diary_writer import write_diary
from core.quantum_emotion import AXES, QuantumEmotionState

MAX_INPUT_CHARS = 4000
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024


@app.after_request
def _security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "script-src 'self'; "
        "img-src 'self' data:; "
        "base-uri 'none'; "
        "frame-ancestors 'none'"
    )
    return response


@app.route("/")
def index():
    today = date.today().isoformat()
    return render_template("index.html", today=today)


def _parse_previous_state(raw) -> QuantumEmotionState:
    if not isinstance(raw, dict):
        return QuantumEmotionState()
    clean: dict[str, list[float]] = {}
    for axis in AXES:
        v = raw.get(axis)
        if (
            isinstance(v, list)
            and len(v) == 2
            and all(isinstance(x, (int, float)) for x in v)
        ):
            clean[axis] = [float(v[0]), float(v[1])]
        else:
            return QuantumEmotionState()
    return QuantumEmotionState(clean)


@app.post("/api/generate")
def api_generate():
    payload = request.get_json(silent=True) or {}
    entry_date = str(payload.get("date", "")).strip()
    user_text = str(payload.get("diary", "")).strip()
    previous_state = payload.get("previous_state")
    previous_summary = str(payload.get("previous_summary", "")).strip()[:600] or None

    if not DATE_RE.match(entry_date):
        return jsonify({"error": "日付形式が不正です (YYYY-MM-DD)"}), 400
    try:
        date.fromisoformat(entry_date)
    except ValueError:
        return jsonify({"error": "存在しない日付です"}), 400
    if not user_text:
        return jsonify({"error": "日記の本文を入力してください"}), 400
    if len(user_text) > MAX_INPUT_CHARS:
        return jsonify({"error": f"本文は{MAX_INPUT_CHARS}文字以内にしてください"}), 400

    emotion = _parse_previous_state(previous_state)
    probs_before = emotion.probabilities()

    impacts = sentiment.analyze(user_text)
    emotion.update(impacts)
    probs_after = emotion.probabilities()

    ai_diary = write_diary(entry_date, user_text, emotion, previous_summary)

    return jsonify(
        {
            "date": entry_date,
            "ai_diary": ai_diary,
            "impacts": impacts,
            "emotion_before": probs_before,
            "emotion_after": probs_after,
            "state_vec": emotion.to_dict(),
        }
    )


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host=host, port=port, debug=debug)
