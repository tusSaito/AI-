"""Flask web app for Quantum Diary Agent."""
from __future__ import annotations

import os
import re
from datetime import date

from flask import Flask, jsonify, render_template, request

from core import sentiment, storage
from core.diary_writer import write_diary
from core.quantum_emotion import QuantumEmotionState

MAX_INPUT_CHARS = 4000
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024  # 64KB request cap


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


@app.post("/api/generate")
def api_generate():
    payload = request.get_json(silent=True) or {}
    entry_date = str(payload.get("date", "")).strip()
    user_text = str(payload.get("diary", "")).strip()

    # --- Input validation ---
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

    # --- Load previous state for continuity ---
    previous = storage.get_latest_before(entry_date)
    if previous and previous.get("state_vec"):
        emotion = QuantumEmotionState(previous["state_vec"])
        prev_summary = (
            f"前回（{previous['entry_date']}）の常連客の日記: "
            f"{previous['user_diary'][:200]}"
        )
    else:
        emotion = QuantumEmotionState()
        prev_summary = None

    probs_before = emotion.probabilities()

    # --- Sentiment analysis on user text ---
    impacts = sentiment.analyze(user_text)

    # --- Quantum state update ---
    emotion.update(impacts)
    probs_after = emotion.probabilities()

    # --- Generate AI diary ---
    ai_diary = write_diary(entry_date, user_text, emotion, prev_summary)

    # --- Persist ---
    storage.save_entry(
        entry_date=entry_date,
        user_diary=user_text,
        ai_diary=ai_diary,
        emotion=probs_after,
        state_vec=emotion.to_dict(),
    )

    return jsonify(
        {
            "date": entry_date,
            "ai_diary": ai_diary,
            "impacts": impacts,
            "emotion_before": probs_before,
            "emotion_after": probs_after,
        }
    )


@app.get("/api/entry")
def api_get_entry():
    entry_date = request.args.get("date", "").strip()
    if not DATE_RE.match(entry_date):
        return jsonify({"error": "日付形式が不正です"}), 400
    entry = storage.get_entry(entry_date)
    if entry is None:
        return jsonify({"entry": None})
    entry.pop("state_vec", None)
    return jsonify({"entry": entry})


@app.get("/api/history")
def api_history():
    entries = storage.list_entries(limit=30)
    for e in entries:
        e.pop("state_vec", None)
    return jsonify({"entries": entries})


if __name__ == "__main__":
    storage.init_db()
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host=host, port=port, debug=debug)
