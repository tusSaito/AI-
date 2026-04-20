// 日記生成パイプライン — 感情分析 → 状態更新 → 日記生成

import { generate } from './llm.js';
import { SYSTEM_PROMPT, PERSONA_NAME } from './persona.js';
import { analyzeClassical, analyzeQuantum } from './sentiment.js';
import { updateState, probabilities, validateOrReset } from './quantum.js';
import { updateMemory } from './memory.js';
import {
  loadEntries, saveEntries, saveConversation,
  loadMemory, nowISO, KEYS, saveJSON
} from './shared.js';

export async function runPipeline(dateStr, userName, conversation, previousStateVec) {
  const userTexts = conversation
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n');

  // 感情分析（並列）
  const [classical, quantum] = await Promise.all([
    analyzeClassical(userTexts),
    analyzeQuantum(userTexts)
  ]);

  // 状態更新
  const stateVec = validateOrReset(previousStateVec);
  const emotionBefore = probabilities(stateVec);
  const newStateVec = updateState(stateVec, quantum);
  const emotionAfter = probabilities(newStateVec);

  // 長期記憶を更新（日付付き）
  await updateMemory(conversation, dateStr);
  const memory = loadMemory();

  // 過去の日記を取得（直近3件）
  const entries = loadEntries();
  const pastDiaries = Object.values(entries)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map(e => `[${e.date}] ${(e.ai_diary || '').slice(0, 150)}`)
    .join('\n');

  // 今回の会話要約
  const conversationSummary = conversation.slice(-10)
    .map(m => `${m.role === 'user' ? (userName || 'ユーザー') : PERSONA_NAME}: ${m.content}`)
    .join('\n');

  // コンテキスト構築
  let memCtx = '';
  const parts = [];
  if (memory.context) parts.push(`背景: ${memory.context}`);
  if (memory.themes?.length) parts.push(`テーマ: ${memory.themes.join('、')}`);
  if (memory.growth) parts.push(`変化: ${memory.growth}`);
  if (memory.episodes?.length) parts.push(`最近のエピソード:\n${memory.episodes.slice(-5).join('\n')}`);
  if (parts.length) memCtx = `\n\n【相手について】\n${parts.join('\n')}`;

  let pastCtx = '';
  if (pastDiaries) pastCtx = `\n\n【最近の日記】\n${pastDiaries}`;

  const diaryPrompt = `${SYSTEM_PROMPT}${memCtx}${pastCtx}

今日の感情状態:
- 自信: ${(emotionAfter.confidence * 100).toFixed(0)}%
- 好奇心: ${(emotionAfter.curiosity * 100).toFixed(0)}%
- 冷静: ${(emotionAfter.calm * 100).toFixed(0)}%

今日の会話:
${conversationSummary}

上記をふまえ、${PERSONA_NAME}の視点で今日の日記を書いて。
過去の日記やエピソードの流れを意識し、相手の変化や成長に触れてもよい。
${userName ? `相手は「${userName}」。` : ''}
300〜500文字。一人称「僕」。である調。内省的に。`;

  const aiDiary = await generate({
    system: diaryPrompt,
    user: '日記を書いて。',
    maxNewTokens: 600,
    temperature: 0.85
  });

  const entry = {
    date: dateStr,
    created_at: nowISO(),
    ai_diary: aiDiary,
    conversation: conversation,
    sentiment: classical,
    emotion_before: emotionBefore,
    emotion_after: emotionAfter,
    state_vec: newStateVec
  };

  saveJSON(KEYS.CURRENT_RESULT, entry);
  return entry;
}

export function saveEntry(entry) {
  const entries = loadEntries();
  entries[entry.date] = entry;
  saveEntries(entries);
  saveConversation([]);
  localStorage.removeItem(KEYS.CURRENT_RESULT);
}
