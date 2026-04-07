from __future__ import annotations

from .llm import generate
from .persona import PERSONA
from .quantum_emotion import QuantumEmotionState


def write_diary(
    date_str: str,
    user_text: str,
    emotion: QuantumEmotionState,
    week_summary: str | None = None,
    recent_days: list[dict] | None = None,
) -> str:
    safe_text = user_text.strip()[:4000]
    probs = emotion.probabilities()

    context = ""
    if week_summary:
        context += f"先週のこと:\n{week_summary[:400]}\n\n"
    if recent_days:
        for d in recent_days[-3:]:
            context += f"{d['date']}: {d['ai_diary'][:100]}\n"
        context += "\n"

    conf = probs["confidence"]
    tone = "落ち着いた筆致で" if conf >= 0.5 else "少し揺れた筆致で"

    user_prompt = f"""{date_str}の日記を書いて。

感情: 自信{probs['confidence']:.0%} 好奇心{probs['curiosity']:.0%} 冷静{probs['calm']:.0%}
{tone}

{context}常連客の話:
{safe_text}

300文字以内。本文だけ書いて。"""

    return generate(
        system=PERSONA,
        user=user_prompt,
        max_new_tokens=500,
        temperature=0.85,
    )
