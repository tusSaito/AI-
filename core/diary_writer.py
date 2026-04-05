"""AI character diary generation based on user's diary + quantum emotion."""
from __future__ import annotations

from .llm import generate
from .persona import PERSONA
from .quantum_emotion import QuantumEmotionState


def _style_hint(conf: float) -> str:
    if conf >= 0.7:
        return "力強い断定。「〜であると確信している」「迷いはない」"
    if conf >= 0.5:
        return "バランスの取れた自省。「〜だと考える」「〜であろう」"
    if conf >= 0.3:
        return "問いかけが増える。「本当にこれでいいのだろうか」"
    return "深い内省・自己対話。「私は何を恐れているのだ」"


def write_diary(
    date_str: str,
    user_text: str,
    emotion: QuantumEmotionState,
    previous_summary: str | None = None,
) -> str:
    """Generate Kai's diary entry reflecting on the user's diary."""
    safe_text = user_text.strip()[:4000]
    probs = emotion.probabilities()
    style = _style_hint(probs["confidence"])

    memory_block = ""
    if previous_summary:
        memory_block = f"\n## これまでの記憶（要約）\n{previous_summary[:600]}\n"

    user_prompt = f"""以下の条件で、今日（{date_str}）の日記を書いてください。

{emotion.describe()}

→ 文体: {style}
{memory_block}
## 今日、常連客が書き残した日記
「{safe_text}」

## 条件
- 約400文字
- NSFW禁止
- 常連客の日記を再解釈し、私（カイ）自身の気づきとして書く
- 物理学の比喩を適度に織り込む
- 感情状態に応じた文体にする
- タイトルなし、本文から始める
"""

    return generate(
        system=PERSONA,
        user=user_prompt,
        max_new_tokens=700,
        temperature=0.75,
    )
