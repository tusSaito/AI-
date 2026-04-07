from __future__ import annotations

from .llm import generate

COMPRESS_PROMPT = (
    "以下は1週間分の日記の断片。"
    "これを200文字以内の要約にまとめて。箇条書き禁止。地の文で。"
    "要約だけ返して。"
)


def compress_week(entries: list[dict]) -> str:
    if not entries:
        return ""
    fragments = []
    for e in entries[:7]:
        date = e.get("date", "")
        user = e.get("user_diary", "")[:150]
        ai = e.get("ai_diary", "")[:150]
        fragments.append(f"{date}: 客「{user}」 カイ「{ai}」")

    text = "\n".join(fragments)
    return generate(
        system=COMPRESS_PROMPT,
        user=text,
        max_new_tokens=300,
        temperature=0.3,
    )
