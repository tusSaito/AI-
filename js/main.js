// 会話ページ (index.html)

import {
  KEYS, loadEntries, loadConversation, saveConversation,
  loadProviderConfig, saveProviderConfig,
  initThemeToggle, todayStr
} from './shared.js';
import { PERSONA_NAME } from './persona.js';
import { initLLM, resetLLM, onStatusChange } from './llm.js';
import { generateResponse, generateGreeting } from './dialogue.js';
import { runPipeline } from './pipeline.js';

let generating = false;
let greeted = false;
let dateEdited = false;

document.addEventListener('DOMContentLoaded', async () => {
  initThemeToggle();

  const chatArea   = document.getElementById('conversation');
  const form       = document.getElementById('dialogue-form');
  const textArea   = document.getElementById('entry-text');
  const sendBtn    = document.getElementById('send-btn');
  const finalizeBtn = document.getElementById('finalize-btn');
  const resetBtn   = document.getElementById('reset-btn');
  const dateInput  = document.getElementById('entry-date');
  const nameInput  = document.getElementById('user-name');
  const charCount  = document.getElementById('char-count');
  const statusText = document.getElementById('model-status-text');
  const providerSelect = document.getElementById('provider-select');
  const apiKeyInput    = document.getElementById('api-key');
  const modelSelect    = document.getElementById('model-select');
  const baseUrlGroup   = document.getElementById('base-url-group');
  const baseUrlInput   = document.getElementById('base-url');

  // 名前復元
  nameInput.value = localStorage.getItem(KEYS.USER_NAME) || '';
  nameInput.addEventListener('input', () => localStorage.setItem(KEYS.USER_NAME, nameInput.value.trim()));

  // 日時
  function setNow() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    dateInput.value = now.toISOString().slice(0, 16);
  }
  setNow();
  setInterval(() => { if (!dateEdited) setNow(); }, 30000);
  dateInput.addEventListener('input', () => { dateEdited = true; });

  // 文字数
  textArea.addEventListener('input', () => {
    charCount.textContent = textArea.value.length;
    sendBtn.disabled = !textArea.value.trim();
    sendBtn.classList.toggle('bg-blue-600', !!textArea.value.trim());
    sendBtn.classList.toggle('bg-gray-300', !textArea.value.trim());
  });

  // プロバイダUI
  initProviderUI(providerSelect, apiKeyInput, modelSelect, baseUrlGroup, baseUrlInput);

  // 会話復元
  const saved = loadConversation();
  for (const m of saved) appendBubble(chatArea, m.role, m.content);
  if (saved.length > 0) {
    finalizeBtn.hidden = false;
    resetBtn.hidden = false;
  }

  // チュートリアル
  if (!localStorage.getItem(KEYS.TUTORIAL_DONE)) showTutorial();
  document.getElementById('show-tutorial')?.addEventListener('click', showTutorial);

  // 送信
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (generating) return;
    const text = textArea.value.trim();
    if (!text || text.length > 4000) return;

    textArea.value = '';
    charCount.textContent = '0';
    sendBtn.disabled = true;
    sendBtn.classList.remove('bg-blue-600');
    sendBtn.classList.add('bg-gray-300');

    const msgs = loadConversation();
    msgs.push({ role: 'user', content: text });
    saveConversation(msgs);
    appendBubble(chatArea, 'user', text);

    finalizeBtn.hidden = false;
    resetBtn.hidden = false;

    generating = true;
    setBusy(true);
    const thinkingEl = appendSystem(chatArea, `${PERSONA_NAME}が考えています…`);

    try {
      const userName = localStorage.getItem(KEYS.USER_NAME) || '';
      const reply = await generateResponse(text, userName);
      thinkingEl.remove();
      appendBubble(chatArea, 'assistant', reply);
      msgs.push({ role: 'assistant', content: reply });
      saveConversation(msgs);
    } catch (err) {
      thinkingEl.remove();
      appendSystem(chatArea, 'エラー: ' + err.message);
    } finally {
      generating = false;
      setBusy(false);
    }
  });

  // 日記生成
  finalizeBtn.addEventListener('click', async () => {
    if (generating) return;
    const msgs = loadConversation();
    if (msgs.length === 0) return;

    generating = true;
    setBusy(true);
    finalizeBtn.disabled = true;
    const thinkingEl = appendSystem(chatArea, '日記を生成しています…');

    try {
      const raw = dateInput.value;
      const dateStr = raw ? raw.slice(0, 10) : todayStr();
      const userName = localStorage.getItem(KEYS.USER_NAME) || '';
      const entries = loadEntries();
      const sorted = Object.values(entries).sort((a, b) => b.date.localeCompare(a.date));
      const prevState = sorted.length > 0 ? sorted[0].state_vec : null;

      await runPipeline(dateStr, userName, msgs, prevState);
      thinkingEl.remove();
      appendSystem(chatArea, '日記が生成されました！日記ページで確認・保存できます。');
      setTimeout(() => { window.location.href = 'diary.html'; }, 1200);
    } catch (err) {
      thinkingEl.remove();
      appendSystem(chatArea, '日記生成エラー: ' + err.message);
      finalizeBtn.disabled = false;
    } finally {
      generating = false;
      setBusy(false);
    }
  });

  // リセット
  resetBtn.addEventListener('click', () => {
    if (!confirm('会話をリセットしますか？')) return;
    saveConversation([]);
    chatArea.innerHTML = '';
    finalizeBtn.hidden = true;
    resetBtn.hidden = true;
    greeted = false;
  });

  // 離脱防止
  window.addEventListener('beforeunload', (e) => {
    if (generating) { e.preventDefault(); e.returnValue = ''; }
  });

  // LLM ステータス
  onStatusChange((s, msg) => {
    if (statusText) statusText.textContent = msg;
    if (s === 'ready') autoGreet(chatArea);
  });

  if (statusText) statusText.textContent = '初期化中…';
  try { await initLLM(); } catch (e) {
    if (statusText) statusText.textContent = 'エラー: ' + e.message;
  }

  // ──────────────────────────────────────
  function setBusy(busy) {
    sendBtn.disabled = busy;
    textArea.disabled = busy;
  }

  async function autoGreet(container) {
    if (greeted) return;
    const msgs = loadConversation();
    if (msgs.length > 0) { greeted = true; return; }
    const cfg = loadProviderConfig();
    if (cfg.provider !== 'local' && !cfg[cfg.provider]?.apiKey) return;
    greeted = true;
    try {
      const userName = localStorage.getItem(KEYS.USER_NAME) || '';
      const greeting = await generateGreeting(userName);
      appendBubble(container, 'assistant', greeting);
      const conv = loadConversation();
      conv.push({ role: 'assistant', content: greeting });
      saveConversation(conv);
    } catch { /* ignore */ }
  }
});

// ── 吹き出し ──
function appendBubble(container, role, text) {
  const div = document.createElement('div');
  div.className = 'chat-enter';
  if (role === 'user') {
    div.innerHTML = `
      <div class="flex justify-end">
        <div class="bg-blue-600 text-white rounded-2xl rounded-tr-none px-4 py-3 max-w-[80%] text-sm leading-relaxed shadow-sm"></div>
      </div>`;
    div.querySelector('div > div').textContent = text;
  } else {
    div.innerHTML = `
      <div class="flex gap-3 items-start">
        <img src="img/dyle.png" alt="${PERSONA_NAME}" class="w-9 h-9 rounded-full object-cover border-2 border-slate-200 shrink-0 mt-1" onerror="this.src='img/dyle.svg'">
        <div class="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3 max-w-[80%] text-sm leading-relaxed shadow-sm relative bubble-arrow"></div>
      </div>`;
    div.querySelector('.bubble-arrow').textContent = text;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function appendSystem(container, text) {
  const div = document.createElement('div');
  div.className = 'text-center text-xs text-gray-400 py-2 chat-enter';
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

// ── チュートリアル ──
function showTutorial() {
  const overlay = document.getElementById('tutorial-overlay');
  if (!overlay) return;
  overlay.style.display = '';
  const steps = overlay.querySelectorAll('.tutorial-step');
  const dots = document.getElementById('tutorial-dots');
  let current = 0;

  dots.innerHTML = steps.length > 0
    ? Array.from(steps).map((_, i) => `<span class="w-2 h-2 rounded-full ${i === 0 ? 'bg-slate-800' : 'bg-gray-300'}" data-dot="${i}"></span>`).join('')
    : '';

  function show(idx) {
    steps.forEach((s, i) => { s.hidden = i !== idx; s.classList.toggle('hidden', i !== idx); });
    dots.querySelectorAll('span').forEach((d, i) => {
      d.className = `w-2 h-2 rounded-full ${i === idx ? 'bg-slate-800' : 'bg-gray-300'}`;
    });
    const nextBtn = document.getElementById('tutorial-next');
    nextBtn.textContent = idx >= steps.length - 1 ? '始める' : '次へ';
  }

  document.getElementById('tutorial-next').onclick = () => {
    if (current >= steps.length - 1) close();
    else { current++; show(current); }
  };
  document.getElementById('tutorial-skip').onclick = close;

  function close() {
    overlay.style.display = 'none';
    localStorage.setItem(KEYS.TUTORIAL_DONE, '1');
  }
  show(0);
}

// ── プロバイダ UI ──
const MODEL_OPTIONS = {
  local: [], gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini'],
  claude: ['claude-sonnet-4-6-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-6-20250514']
};

function initProviderUI(sel, keyEl, modelEl, urlGroup, urlEl) {
  const cfg = loadProviderConfig();
  sel.value = cfg.provider;
  update(cfg);

  sel.addEventListener('change', () => {
    const c = loadProviderConfig();
    c.provider = sel.value;
    saveProviderConfig(c);
    update(c);
    resetLLM();
    initLLM();
  });

  function update(c) {
    const p = c.provider;
    const isAPI = p !== 'local';
    document.getElementById('api-key-group').hidden = !isAPI;
    document.getElementById('model-group').hidden = !isAPI;
    urlGroup.hidden = p !== 'openai';

    if (isAPI) {
      modelEl.innerHTML = '';
      for (const m of MODEL_OPTIONS[p] || []) {
        const o = document.createElement('option');
        o.value = m; o.textContent = m;
        modelEl.appendChild(o);
      }
      modelEl.value = c[p]?.model || '';
      keyEl.value = c[p]?.apiKey || '';
      if (p === 'openai') urlEl.value = c.openai?.baseUrl || 'https://api.openai.com/v1';
    }

    modelEl.onchange = () => { const x = loadProviderConfig(); x[p].model = modelEl.value; saveProviderConfig(x); };
    keyEl.oninput = () => { const x = loadProviderConfig(); x[p].apiKey = keyEl.value; saveProviderConfig(x); };
    if (urlEl) urlEl.oninput = () => { const x = loadProviderConfig(); x.openai.baseUrl = urlEl.value; saveProviderConfig(x); };
  }
}
