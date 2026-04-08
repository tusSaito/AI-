// 共通ユーティリティ・定数・感情バー描画

// ── localStorage キー ──
export const KEYS = {
  ENTRIES:         'quantum_diary_entries_v1',
  CONVERSATION:    'dyle_current_conversation',
  MEMORY:          'quantum_diary_memory_v1',
  USER_NAME:       'quantum_diary_user_name',
  THEME:           'dyle_theme',
  TUTORIAL_DONE:   'quantum_diary_tutorial_done',
  CURRENT_RESULT:  'dyle_current_result',
  PROVIDER_CONFIG: 'dyle_provider_config'
};

// ── JSON 読み書き ──
export function loadJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
export function saveJSON(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ── エントリ操作 ──
export function loadEntries() { return loadJSON(KEYS.ENTRIES, {}); }
export function saveEntries(entries) { saveJSON(KEYS.ENTRIES, entries); }

// ── 会話操作 ──
export function loadConversation() { return loadJSON(KEYS.CONVERSATION, []); }
export function saveConversation(msgs) { saveJSON(KEYS.CONVERSATION, msgs); }

// ── 長期記憶操作 ──
export function loadMemory() {
  return loadJSON(KEYS.MEMORY, {
    context: '', themes: [], strengths: '', challenges: '', growth: '', updated_at: ''
  });
}
export function saveMemory(mem) { saveJSON(KEYS.MEMORY, mem); }

// ── プロバイダ設定 ──
export function loadProviderConfig() {
  return loadJSON(KEYS.PROVIDER_CONFIG, {
    provider: 'local',
    gemini:  { apiKey: '', model: 'gemini-2.5-flash' },
    openai:  { apiKey: '', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
    claude:  { apiKey: '', model: 'claude-sonnet-4-20250514' }
  });
}
export function saveProviderConfig(cfg) { saveJSON(KEYS.PROVIDER_CONFIG, cfg); }

// ── 日付ヘルパー ──
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function nowISO() { return new Date().toISOString().slice(0, 19); }
export function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
}
export function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2,'0')}`;
}

// ── 感情バー描画 ──
const AXIS_LABELS = { confidence: '自信', curiosity: '好奇心', calm: '冷静' };
const AXIS_COLORS = { confidence: '#f59e0b', curiosity: '#3b82f6', calm: '#10b981' };

export function renderEmotionBars(container, before, after) {
  container.innerHTML = '';
  for (const axis of ['confidence', 'curiosity', 'calm']) {
    const bVal = before ? before[axis] ?? 0.5 : 0.5;
    const aVal = after  ? after[axis]  ?? 0.5 : 0.5;
    const delta = aVal - bVal;
    const sign = delta >= 0 ? '+' : '';

    const row = document.createElement('div');
    row.className = 'emotion-row';

    const label = document.createElement('span');
    label.className = 'emotion-label';
    label.textContent = AXIS_LABELS[axis];

    const barWrap = document.createElement('div');
    barWrap.className = 'emotion-bar-wrap';
    const bar = document.createElement('div');
    bar.className = 'emotion-bar';
    bar.style.width = `${(aVal * 100).toFixed(0)}%`;
    bar.style.backgroundColor = AXIS_COLORS[axis];
    barWrap.appendChild(bar);

    const deltaSpan = document.createElement('span');
    deltaSpan.className = 'emotion-delta';
    deltaSpan.textContent = `${(aVal * 100).toFixed(0)}% (${sign}${(delta * 100).toFixed(1)})`;

    row.appendChild(label);
    row.appendChild(barWrap);
    row.appendChild(deltaSpan);
    container.appendChild(row);
  }
}

// ── 古典感情バー描画（valence / arousal）──
const CLASSICAL_LABELS = { valence: '快↔不快', arousal: '活性↔沈静' };
const CLASSICAL_COLORS = { valence: '#ec4899', arousal: '#8b5cf6' };

export function renderClassicalBars(container, sentiment) {
  if (!sentiment) return;
  for (const axis of ['valence', 'arousal']) {
    const val = sentiment[axis] ?? 0;
    const pct = ((val + 1) / 2 * 100).toFixed(0);

    const row = document.createElement('div');
    row.className = 'emotion-row';

    const label = document.createElement('span');
    label.className = 'emotion-label';
    label.textContent = CLASSICAL_LABELS[axis];

    const barWrap = document.createElement('div');
    barWrap.className = 'emotion-bar-wrap';
    const bar = document.createElement('div');
    bar.className = 'emotion-bar';
    bar.style.width = `${pct}%`;
    bar.style.backgroundColor = CLASSICAL_COLORS[axis];
    barWrap.appendChild(bar);

    const valSpan = document.createElement('span');
    valSpan.className = 'emotion-delta';
    valSpan.textContent = `${val >= 0 ? '+' : ''}${val.toFixed(2)}`;

    row.appendChild(label);
    row.appendChild(barWrap);
    row.appendChild(valSpan);
    container.appendChild(row);
  }
}

// ── テーマ切替 ──
export function applyTheme(theme) {
  const link = document.getElementById('dark-css');
  if (theme === 'dark') {
    if (!link) {
      const el = document.createElement('link');
      el.id = 'dark-css';
      el.rel = 'stylesheet';
      el.href = 'dark.css';
      document.head.appendChild(el);
    }
    document.documentElement.classList.add('dark');
  } else {
    if (link) link.remove();
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem(KEYS.THEME, theme);
}
export function currentTheme() {
  return localStorage.getItem(KEYS.THEME) || 'light';
}
