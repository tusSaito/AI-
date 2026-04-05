from __future__ import annotations

import json
import re

from .llm import generate

SYSTEM_PROMPT = (
    "あなたは感情分析の専門家です。"
    "与えられた文章を読んだ人物の感情に、その文章がどのような影響を与えるかを"
    "分析してください。出力はJSONのみとし、前後に説明文を一切含めないでください。\n"
    "各値は -1.0（ネガティブ方向）〜 +1.0（ポジティブ方向）の float:\n"
    '{"confidence": 0.0, "curiosity": 0.0, "calm": 0.0}\n'
    "- confidence: 自信↔不安\n"
    "- curiosity: 好奇心↔倦怠\n"
    "- calm: 冷静↔焦燥\n"
)


def analyze(text: str) -> dict[str, float]:
    safe_text = text.strip()[:4000]
    response = generate(
        system=SYSTEM_PROMPT,
        user=f"文章:\n{safe_text}",
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
