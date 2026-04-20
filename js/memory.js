// 長期記憶 — 会話からユーザーの特徴と具体的エピソードを抽出・蓄積

import { generate } from './llm.js';
import { loadMemory, saveMemory, nowISO } from './shared.js';

const EXTRACT_PROMPT = `\
以下の会話からユーザーに関する情報を抽出し、JSON で返して。
既存の記憶と統合して更新すること。変化がなければ既存のまま返してよい。
episodes には今回の会話で語られた具体的なエピソードを1〜2文で追加して（最大10件、古いものから削除）。
説明不要。JSON 一つだけ。

{
  "context": "ユーザーの状況（学生、社会人、etc）",
  "themes": ["最近の話題1", "話題2"],
  "strengths": "ユーザーの強み・得意なこと",
  "challenges": "ユーザーの課題・悩み",
  "growth": "前回と比べた変化・成長",
  "episodes": ["2026-04-05: 転職の面接を受けた", "2026-04-07: 猫が体調を崩して心配していた"]
}`;

function extractJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export async function updateMemory(conversation, dateStr = '') {
  const current = loadMemory();
  const recentMsgs = conversation.slice(-12)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const system = `${EXTRACT_PROMPT}

今日の日付: ${dateStr || '不明'}

【現在の記憶】
${JSON.stringify(current, null, 2)}`;

  try {
    const raw = await generate({
      system,
      user: recentMsgs,
      maxNewTokens: 400,
      temperature: 0.3
    });
    const j = extractJSON(raw);
    if (j) {
      const updated = {
        context:    typeof j.context === 'string' ? j.context : current.context,
        themes:     Array.isArray(j.themes) ? j.themes.slice(0, 5) : current.themes,
        strengths:  typeof j.strengths === 'string' ? j.strengths : current.strengths,
        challenges: typeof j.challenges === 'string' ? j.challenges : current.challenges,
        growth:     typeof j.growth === 'string' ? j.growth : current.growth,
        episodes:   Array.isArray(j.episodes) ? j.episodes.slice(-10) : (current.episodes || []),
        updated_at: nowISO()
      };
      saveMemory(updated);
      return updated;
    }
  } catch (e) {
    console.warn('Memory update failed:', e);
  }
  return current;
}
