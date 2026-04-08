// 会話ページ (index.html) — UI・イベント処理

import {
  KEYS, loadEntries, loadConversation, saveConversation,
  loadProviderConfig, saveProviderConfig,
  applyTheme, currentTheme, todayStr
} from './shared.js';
import { PERSONA_NAME } from './persona.js';
import { initLLM, resetLLM, onStatusChange } from './llm.js';
import { generateResponse, generateGreeting } from './dialogue.js';
import { runPipeline } from './pipeline.js';

// ── DOM 要素 ──
let chatArea, inputArea, sendBtn, diaryBtn, dateInput, timeInput,
    userNameInput, themeToggle, providerSelect, apiKeyInput, apiKeyToggle,
    modelSelect, baseUrlGroup, baseUrlInput, statusEl, navLinks;

let generating = false;
let dateTimeEdited = false;
let dateTimeTimer = null;

// ── 初期化 ──
document.addEventListener('DOMContentLoaded', async () => {
  chatArea       = document.getElementById('chat-area');
  inputArea      = document.getElementById('input-area');
  sendBtn        = document.getElementById('send-btn');
  diaryBtn       = document.getElementById('diary-btn');
  dateInput      = document.getElementById('date-input');
  timeInput      = document.getElementById('time-input');
  userNameInput  = document.getElementById('user-name');
  themeToggle    = document.getElementById('theme-toggle');
  providerSelect = document.getElementById('provider-select');
  apiKeyInput    = document.getElementById('api-key');
  apiKeyToggle   = document.getElementById('api-key-toggle');
  modelSelect    = document.getElementById('model-select');
  baseUrlGroup   = document.getElementById('base-url-group');
  baseUrlInput   = document.getElementById('base-url');
  statusEl       = document.getElementById('status');
  navLinks       = document.querySelectorAll('nav a');

  // テーマ復元
  applyTheme(currentTheme());
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
      updateThemeIcon();
    });
    updateThemeIcon();
  }

  // ユーザー名復元
  const savedName = localStorage.getItem(KEYS.USER_NAME) || '';
  if (userNameInput) {
    userNameInput.value = savedName;
    userNameInput.addEventListener('input', () => {
      localStorage.setItem(KEYS.USER_NAME, userNameInput.value.trim());
    });
  }

  // 日時の自動更新
  updateDateTime();
  dateTimeTimer = setInterval(() => { if (!dateTimeEdited) updateDateTime(); }, 30000);
  if (dateInput) dateInput.addEventListener('input', () => { dateTimeEdited = true; });
  if (timeInput) timeInput.addEventListener('input', () => { dateTimeEdited = true; });

  // プロバイダ設定の復元・イベント
  initProviderUI();

  // 会話履歴の復元
  restoreConversation();

  // チュートリアル
  if (!localStorage.getItem(KEYS.TUTORIAL_DONE)) showTutorial();

  // 送信イベント
  if (sendBtn) sendBtn.addEventListener('click', handleSend);
  if (inputArea) inputArea.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSend(); }
  });

  // 日記生成ボタン
  if (diaryBtn) diaryBtn.addEventListener('click', handleDiaryGeneration);

  // 離脱防止
  window.addEventListener('beforeunload', e => {
    if (generating) { e.preventDefault(); e.returnValue = ''; }
  });

  // 文字数カウンター
  if (inputArea) {
    const counter = document.getElementById('char-count');
    if (counter) {
      inputArea.addEventListener('input', () => {
        counter.textContent = `${inputArea.value.length} / 4000`;
        if (inputArea.value.length > 4000) counter.classList.add('over');
        else counter.classList.remove('over');
      });
    }
  }

  // LLM ステータス監視
  onStatusChange((s, msg) => {
    if (statusEl) statusEl.textContent = msg;
    if (s === 'ready') autoGreet();
  });

  // LLM 初期化
  if (statusEl) statusEl.textContent = '初期化中…';
  try {
    await initLLM();
  } catch (e) {
    if (statusEl) statusEl.textContent = 'エラー: ' + e.message;
  }
});

// ── 日時 ──
function updateDateTime() {
  const now = new Date();
  if (dateInput) dateInput.value = todayStr();
  if (timeInput) timeInput.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

// ── テーマアイコン ──
function updateThemeIcon() {
  if (!themeToggle) return;
  themeToggle.innerHTML = currentTheme() === 'dark'
    ? '<i class="fa-solid fa-sun"></i>'
    : '<i class="fa-solid fa-moon"></i>';
}

// ── プロバイダ UI ──
const MODEL_OPTIONS = {
  local:  [],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini'],
  claude: ['claude-sonnet-4-20250514', 'claude-haiku-3.5-20241022']
};

function initProviderUI() {
  const cfg = loadProviderConfig();
  if (providerSelect) {
    providerSelect.value = cfg.provider;
    providerSelect.addEventListener('change', onProviderChange);
  }
  updateProviderFields(cfg);
}

function onProviderChange() {
  const cfg = loadProviderConfig();
  cfg.provider = providerSelect.value;
  saveProviderConfig(cfg);
  updateProviderFields(cfg);
  resetLLM();
  initLLM();
}

function updateProviderFields(cfg) {
  const p = cfg.provider;
  const isAPI = p !== 'local';
  const keyGroup = document.getElementById('api-key-group');
  const modelGroup = document.getElementById('model-group');

  if (keyGroup)  keyGroup.style.display = isAPI ? '' : 'none';
  if (modelGroup) modelGroup.style.display = isAPI ? '' : 'none';
  if (baseUrlGroup) baseUrlGroup.style.display = p === 'openai' ? '' : 'none';

  if (isAPI && modelSelect) {
    modelSelect.innerHTML = '';
    for (const m of MODEL_OPTIONS[p] || []) {
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = m;
      modelSelect.appendChild(opt);
    }
    modelSelect.value = cfg[p]?.model || '';
    modelSelect.onchange = () => {
      const c = loadProviderConfig();
      c[p].model = modelSelect.value;
      saveProviderConfig(c);
    };
  }

  if (apiKeyInput) {
    apiKeyInput.value = isAPI ? (cfg[p]?.apiKey || '') : '';
    apiKeyInput.oninput = () => {
      const c = loadProviderConfig();
      c[p].apiKey = apiKeyInput.value;
      saveProviderConfig(c);
    };
  }
  if (apiKeyToggle) {
    apiKeyToggle.onclick = () => {
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    };
  }

  if (baseUrlInput && p === 'openai') {
    baseUrlInput.value = cfg.openai?.baseUrl || 'https://api.openai.com/v1';
    baseUrlInput.oninput = () => {
      const c = loadProviderConfig();
      c.openai.baseUrl = baseUrlInput.value;
      saveProviderConfig(c);
    };
  }
}

// ── 会話 ──
function restoreConversation() {
  const msgs = loadConversation();
  for (const m of msgs) appendBubble(m.role, m.content);
}

function appendBubble(role, text) {
  if (!chatArea) return;
  const wrap = document.createElement('div');
  wrap.className = `bubble bubble-${role}`;

  if (role === 'assistant') {
    const avatar = document.createElement('img');
    avatar.src = 'img/dyle.png';
    avatar.alt = PERSONA_NAME;
    avatar.className = 'avatar';
    avatar.onerror = function() { this.style.display = 'none'; };
    wrap.appendChild(avatar);
  }

  const content = document.createElement('div');
  content.className = 'bubble-content';
  content.textContent = text;
  wrap.appendChild(content);
  chatArea.appendChild(wrap);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function appendSystem(text) {
  if (!chatArea) return;
  const el = document.createElement('div');
  el.className = 'bubble bubble-system';
  el.textContent = text;
  chatArea.appendChild(el);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// ── 送信 ──
async function handleSend() {
  if (generating) return;
  const text = inputArea?.value?.trim();
  if (!text || text.length > 4000) return;

  inputArea.value = '';
  const msgs = loadConversation();
  msgs.push({ role: 'user', content: text });
  saveConversation(msgs);
  appendBubble('user', text);

  // AI 応答
  generating = true;
  setUIBusy(true);
  appendSystem(`${PERSONA_NAME}が考えています…`);

  try {
    const userName = localStorage.getItem(KEYS.USER_NAME) || '';
    const reply = await generateResponse(text, userName);
    // thinking 表示を除去
    removeLastSystem();
    appendBubble('assistant', reply);
    msgs.push({ role: 'assistant', content: reply });
    saveConversation(msgs);
  } catch (e) {
    removeLastSystem();
    appendSystem('エラー: ' + e.message);
  } finally {
    generating = false;
    setUIBusy(false);
  }
}

// ── 日記生成 ──
async function handleDiaryGeneration() {
  if (generating) return;
  const msgs = loadConversation();
  if (msgs.length === 0) {
    appendSystem('まだ会話がありません。先に会話してください。');
    return;
  }

  generating = true;
  setUIBusy(true);
  setNavDisabled(true);
  appendSystem('日記を生成しています…');

  try {
    const dateStr = dateInput?.value || todayStr();
    const userName = localStorage.getItem(KEYS.USER_NAME) || '';

    // 前回の state_vec を取得
    const entries = loadEntries();
    const sorted = Object.values(entries).sort((a, b) => b.date.localeCompare(a.date));
    const prevState = sorted.length > 0 ? sorted[0].state_vec : null;

    const entry = await runPipeline(dateStr, userName, msgs, prevState);
    removeLastSystem();
    appendSystem('日記が生成されました！日記ページで確認・保存できます。');

    // diary.html へ遷移
    setTimeout(() => { window.location.href = 'diary.html'; }, 1500);
  } catch (e) {
    removeLastSystem();
    appendSystem('日記生成エラー: ' + e.message);
  } finally {
    generating = false;
    setUIBusy(false);
    setNavDisabled(false);
  }
}

// ── 自動挨拶 ──
let greeted = false;
async function autoGreet() {
  if (greeted) return;
  greeted = true;
  const msgs = loadConversation();
  if (msgs.length > 0) return; // 復帰時はスキップ
  try {
    const userName = localStorage.getItem(KEYS.USER_NAME) || '';
    const greeting = await generateGreeting(userName);
    appendBubble('assistant', greeting);
    const conv = loadConversation();
    conv.push({ role: 'assistant', content: greeting });
    saveConversation(conv);
  } catch { /* ignore */ }
}

// ── UI ヘルパー ──
function setUIBusy(busy) {
  if (sendBtn)  sendBtn.disabled = busy;
  if (diaryBtn) diaryBtn.disabled = busy;
  if (inputArea) inputArea.disabled = busy;
}

function setNavDisabled(disabled) {
  for (const a of navLinks) {
    if (disabled) {
      a.dataset.href = a.href;
      a.removeAttribute('href');
      a.style.opacity = '0.5';
      a.style.pointerEvents = 'none';
    } else {
      if (a.dataset.href) a.href = a.dataset.href;
      a.style.opacity = '';
      a.style.pointerEvents = '';
    }
  }
}

function removeLastSystem() {
  if (!chatArea) return;
  const systems = chatArea.querySelectorAll('.bubble-system');
  if (systems.length) systems[systems.length - 1].remove();
}

// ── チュートリアル ──
function showTutorial() {
  const steps = [
    { title: 'ようこそ！', text: `${PERSONA_NAME}と会話して、日々の振り返りをしましょう。` },
    { title: 'メッセージを送る', text: '下のテキストエリアに気持ちや出来事を書いて、送信ボタンまたは Ctrl+Enter で送信。' },
    { title: '日記を生成', text: `会話が終わったら「日記を書いてもらう」ボタンで、${PERSONA_NAME}が日記を書きます。` },
    { title: '記録を振り返る', text: '日記ページで保存した日記を読み返し、記録ページでグラフやカレンダーを確認できます。' }
  ];

  const overlay = document.createElement('div');
  overlay.className = 'tutorial-overlay';
  let step = 0;

  function render() {
    const s = steps[step];
    overlay.innerHTML = `
      <div class="tutorial-card">
        <h3>${s.title}</h3>
        <p>${s.text}</p>
        <div class="tutorial-nav">
          <span>${step + 1} / ${steps.length}</span>
          ${step < steps.length - 1
            ? '<button class="btn" id="tutorial-next">次へ</button>'
            : '<button class="btn" id="tutorial-done">始める</button>'
          }
          <button class="btn btn-ghost" id="tutorial-skip">スキップ</button>
        </div>
      </div>`;
    const next = overlay.querySelector('#tutorial-next');
    const done = overlay.querySelector('#tutorial-done');
    const skip = overlay.querySelector('#tutorial-skip');
    if (next) next.onclick = () => { step++; render(); };
    if (done) done.onclick = closeTutorial;
    if (skip) skip.onclick = closeTutorial;
  }

  function closeTutorial() {
    overlay.remove();
    localStorage.setItem(KEYS.TUTORIAL_DONE, '1');
  }

  render();
  document.body.appendChild(overlay);
}

