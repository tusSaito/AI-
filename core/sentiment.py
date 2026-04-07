from __future__ import annotations

import json
import re

from .llm import generate

SYSTEM_PROMPT = (
    "文章の感情的な影響をJSON一つで返して。説明不要。\n"
    "confidence: 自信↔不安, curiosity: 好奇心↔倦怠, calm: 冷静↔焦燥\n"
    "各値は -1.0〜+1.0\n"
    '例: {"confidence": 0.3, "curiosity": -0.1, "calm": 0.5}'
)


def analyze(text: str) -> dict[str, float]:
    safe_text = text.strip()[:4000]
    response = generate(
        system=SYSTEM_PROMPT,
        user=safe_text,
        max_new_tokens=128,
        temperature=0.2,
    )
    impacts = {"confidence": 0.0, "curiosity": 0.0, "calm": 0.0}
    match = re.search(r"\{[^{}]*\}", response, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group())
            for key in impacts:
                if key in parsed:
                    v = float(parsed[key])
                    impacts[key] = max(-1.0, min(1.0, v))
        except (json.JSONDecodeError, ValueError, TypeError):
            pass
    return impacts
