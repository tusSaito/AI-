// 感情分析 — 古典 (valence/arousal) + 量子 (confidence/curiosity/calm)

import { generate } from './llm.js';

const CLASSICAL_PROMPT = `\
ユーザーの発話から感情を分析し、以下の JSON だけを返して。説明不要。

{
  "valence": <-1.0〜+1.0 快↔不快>,
  "arousal": <-1.0〜+1.0 活性↔沈静>
}

例:
- 「今日は楽しかった！」→ {"valence": 0.8, "arousal": 0.6}
- 「疲れた…何もしたくない」→ {"valence": -0.4, "arousal": -0.7}`;

const QUANTUM_PROMPT = `\
あなたはコーチング AI の感情エンジンである。
ユーザーの発話を読み、AI キャラクター（ダイル）が感じる反応として、以下 3 軸の影響度を JSON で返して。説明不要。JSON 一つだけ。

{
  "confidence": <-1.0〜+1.0  自信を持たせる→不安にさせる>,
  "curiosity":  <-1.0〜+1.0  好奇心を刺激→退屈>,
  "calm":       <-1.0〜+1.0  冷静さを促す→焦らせる>
}`;

function extractJSON(text) {
  const m = text.match(/\{[^{}]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function clamp(v, lo = -1, hi = 1) {
  return Math.max(lo, Math.min(hi, typeof v === 'number' && isFinite(v) ? v : 0));
}

/** 古典感情分析: valence + arousal */
export async function analyzeClassical(userText) {
  try {
    const raw = await generate({
      system: CLASSICAL_PROMPT,
      user: userText,
      maxNewTokens: 80,
      temperature: 0.1
    });
    const j = extractJSON(raw);
    return {
      valence: clamp(j?.valence),
      arousal: clamp(j?.arousal)
    };
  } catch {
    return { valence: 0, arousal: 0 };
  }
}

/** 量子感情分析: confidence / curiosity / calm の impact 値 */
export async function analyzeQuantum(userText) {
  try {
    const raw = await generate({
      system: QUANTUM_PROMPT,
      user: userText,
      maxNewTokens: 80,
      temperature: 0.2
    });
    const j = extractJSON(raw);
    return {
      confidence: clamp(j?.confidence),
      curiosity:  clamp(j?.curiosity),
      calm:       clamp(j?.calm)
    };
  } catch {
    return { confidence: 0, curiosity: 0, calm: 0 };
  }
}
