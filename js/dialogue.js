// 対話生成 — ダイルの会話応答を生成

import { generate } from './llm.js';
import { PERSONA_NAME, SYSTEM_PROMPT } from './persona.js';
import { loadMemory, loadConversation } from './shared.js';

/** 会話コンテキストを組み立てて応答を生成 */
export async function generateResponse(userMessage, userName = '') {
  const memory = loadMemory();
  const history = loadConversation();

  // 直近 8 ターン分のコンテキスト
  const recent = history.slice(-8)
    .map(m => `${m.role === 'user' ? (userName || 'ユーザー') : PERSONA_NAME}: ${m.content}`)
    .join('\n');

  // 長期記憶のコンテキスト
  let memCtx = '';
  if (memory.context || memory.themes?.length) {
    const parts = [];
    if (memory.context) parts.push(`背景: ${memory.context}`);
    if (memory.themes?.length) parts.push(`テーマ: ${memory.themes.join('、')}`);
    if (memory.strengths) parts.push(`強み: ${memory.strengths}`);
    if (memory.challenges) parts.push(`課題: ${memory.challenges}`);
    if (memory.growth) parts.push(`成長: ${memory.growth}`);
    memCtx = `\n\n【${userName || 'ユーザー'}について知っていること】\n${parts.join('\n')}`;
  }

  const system = `${SYSTEM_PROMPT}${memCtx}

${userName ? `相手の名前は「${userName}」。` : ''}
以下はこれまでの会話の流れ:
${recent || '（まだ会話していない）'}

相手の最新メッセージに対して、${PERSONA_NAME}として自然に応答して。300文字以内。`;

  return generate({
    system,
    user: userMessage,
    maxNewTokens: 400,
    temperature: 0.85
  });
}

/** 自動挨拶メッセージ */
export async function generateGreeting(userName = '') {
  const system = `${SYSTEM_PROMPT}

${userName ? `相手の名前は「${userName}」。` : ''}
喫茶店のカウンターで、今日初めて来た客（または常連）に声をかける一言を生成して。自然に、短く（100文字以内）。`;

  return generate({
    system,
    user: '（入店）',
    maxNewTokens: 150,
    temperature: 0.9
  });
}
