// 日記生成パイプライン — 感情分析 → 量子更新 → 日記生成

import { generate } from './llm.js';
import { SYSTEM_PROMPT, PERSONA_NAME } from './persona.js';
import { analyzeClassical, analyzeQuantum } from './sentiment.js';
import { updateState, probabilities, validateOrReset } from './quantum.js';
import { updateMemory } from './memory.js';
import {
  loadEntries, saveEntries, loadConversation, saveConversation,
  loadMemory, nowISO, KEYS, saveJSON
} from './shared.js';

/**
 * 日記生成パイプラインを実行
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} userName
 * @param {Array} conversation - 今回の会話ログ
 * @param {object|null} previousStateVec - 前回の量子状態ベクトル
 * @returns {object} Entry オブジェクト
 */
export async function runPipeline(dateStr, userName, conversation, previousStateVec) {
  // 1. 全会話テキストを結合
  const userTexts = conversation
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n');

  // 2. 感情分析（古典 + 量子を並列実行）
  const [classical, quantum] = await Promise.all([
    analyzeClassical(userTexts),
    analyzeQuantum(userTexts)
  ]);

  // 3. 量子状態更新
  const stateVec = validateOrReset(previousStateVec);
  const emotionBefore = probabilities(stateVec);
  const newStateVec = updateState(stateVec, quantum);
  const emotionAfter = probabilities(newStateVec);

  // 4. 長期記憶を更新
  await updateMemory(conversation);
  const memory = loadMemory();

  // 5. 日記生成
  const conversationSummary = conversation.slice(-10)
    .map(m => `${m.role === 'user' ? (userName || 'ユーザー') : PERSONA_NAME}: ${m.content}`)
    .join('\n');

  let memCtx = '';
  if (memory.context || memory.themes?.length) {
    const parts = [];
    if (memory.context) parts.push(`背景: ${memory.context}`);
    if (memory.themes?.length) parts.push(`テーマ: ${memory.themes.join('、')}`);
    if (memory.growth) parts.push(`変化: ${memory.growth}`);
    memCtx = `\n\n【相手について】\n${parts.join('\n')}`;
  }

  const diaryPrompt = `${SYSTEM_PROMPT}${memCtx}

今日の感情状態:
- 自信: ${(emotionAfter.confidence * 100).toFixed(0)}%
- 好奇心: ${(emotionAfter.curiosity * 100).toFixed(0)}%
- 冷静: ${(emotionAfter.calm * 100).toFixed(0)}%

今日の会話:
${conversationSummary}

上記をふまえ、${PERSONA_NAME}の視点で今日の日記を書いて。
${userName ? `相手は「${userName}」。` : ''}
300〜500文字。一人称「僕」。である調。内省的に。`;

  const aiDiary = await generate({
    system: diaryPrompt,
    user: '日記を書いて。',
    maxNewTokens: 600,
    temperature: 0.85
  });

  // 6. Entry を構築
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

  // 一時保存（diary.html で表示用）
  saveJSON(KEYS.CURRENT_RESULT, entry);

  return entry;
}

/** 生成済みエントリを永続保存 */
export function saveEntry(entry) {
  const entries = loadEntries();
  entries[entry.date] = entry;
  saveEntries(entries);
  // 会話をクリア
  saveConversation([]);
  localStorage.removeItem(KEYS.CURRENT_RESULT);
}
