// マルチプロバイダ API 呼び出し（Gemini / OpenAI / Claude）
// ブラウザから直接 REST API を叩く設計

import { loadProviderConfig } from './shared.js';

// ── Gemini API ──
async function callGemini({ system, user, maxNewTokens = 512, temperature = 0.7 }) {
  const cfg = loadProviderConfig().gemini;
  if (!cfg.apiKey) throw new Error('Gemini API キーが設定されていません');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      maxOutputTokens: maxNewTokens,
      temperature,
      topP: 0.95
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API エラー (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// ── OpenAI 互換 API ──
async function callOpenAI({ system, user, maxNewTokens = 512, temperature = 0.7 }) {
  const cfg = loadProviderConfig().openai;
  if (!cfg.apiKey) throw new Error('OpenAI API キーが設定されていません');

  const baseUrl = cfg.baseUrl || 'https://api.openai.com/v1';
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model: cfg.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user }
    ],
    max_tokens: maxNewTokens,
    temperature,
    top_p: 0.95
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API エラー (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ── Claude API ──
async function callClaude({ system, user, maxNewTokens = 512, temperature = 0.7 }) {
  const cfg = loadProviderConfig().claude;
  if (!cfg.apiKey) throw new Error('Claude API キーが設定されていません');

  const url = 'https://api.anthropic.com/v1/messages';
  const body = {
    model: cfg.model,
    max_tokens: maxNewTokens,
    system,
    messages: [{ role: 'user', content: user }],
    temperature
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API エラー (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

// ── ディスパッチ ──
const PROVIDERS = {
  gemini: callGemini,
  openai: callOpenAI,
  claude: callClaude
};

export async function callProvider(provider, params) {
  const fn = PROVIDERS[provider];
  if (!fn) throw new Error(`未対応のプロバイダ: ${provider}`);
  return fn(params);
}
