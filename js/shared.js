// 共通ユーティリティ・定数

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

export function loadJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
export function saveJSON(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadEntries() { return loadJSON(KEYS.ENTRIES, {}); }
export function saveEntries(entries) { saveJSON(KEYS.ENTRIES, entries); }
export function loadConversation() { return loadJSON(KEYS.CONVERSATION, []); }
export function saveConversation(msgs) { saveJSON(KEYS.CONVERSATION, msgs); }

export function loadMemory() {
  return loadJSON(KEYS.MEMORY, {
    context: '', themes: [], strengths: '', challenges: '', growth: '', updated_at: ''
  });
}
export function saveMemory(mem) { saveJSON(KEYS.MEMORY, mem); }

export function loadProviderConfig() {
  return loadJSON(KEYS.PROVIDER_CONFIG, {
    provider: 'local',
    gemini:  { apiKey: '', model: 'gemini-2.5-flash' },
    openai:  { apiKey: '', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
    claude:  { apiKey: '', model: 'claude-sonnet-4-20250514' }
  });
}
export function saveProviderConfig(cfg) { saveJSON(KEYS.PROVIDER_CONFIG, cfg); }

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function nowISO() { return new Date().toISOString().slice(0, 19); }

// ── テーマ切替 (data-theme 属性) ──
export function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem(KEYS.THEME, theme);
}
export function currentTheme() {
  return localStorage.getItem(KEYS.THEME) || 'light';
}
export function initThemeToggle() {
  applyTheme(currentTheme());
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      updateThemeIcon(btn);
    });
    updateThemeIcon(btn);
  }
}
function updateThemeIcon(btn) {
  const icon = btn.querySelector('i');
  if (!icon) return;
  icon.className = currentTheme() === 'dark' ? 'fa-solid fa-sun text-lg mb-1' : 'fa-solid fa-moon text-lg mb-1';
}

// ── 感情バー描画 (bar-row 形式) ──
const Q_LABELS = { confidence: '自信', curiosity: '好奇心', calm: '冷静' };
const Q_COLORS = { confidence: '#f59e0b', curiosity: '#3b82f6', calm: '#10b981' };

export function renderEmotionBars(container, before, after) {
  for (const axis of ['confidence', 'curiosity', 'calm']) {
    const bVal = before?.[axis] ?? 0.5;
    const aVal = after?.[axis] ?? 0.5;
    const delta = aVal - bVal;
    const sign = delta >= 0 ? '+' : '';
    const deltaClass = delta > 0 ? 'up' : delta < 0 ? 'down' : '';

    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <span class="bar-label">${Q_LABELS[axis]}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(aVal*100).toFixed(0)}%;background:${Q_COLORS[axis]}"></div></div>
      <span class="bar-value">${(aVal*100).toFixed(0)}%</span>
      <span class="bar-delta ${deltaClass}">${sign}${(delta*100).toFixed(1)}</span>`;
    container.appendChild(row);
  }
}

const C_LABELS = { valence: '快↔不快', arousal: '活性↔沈静' };
const C_COLORS = { valence: '#ec4899', arousal: '#8b5cf6' };

export function renderClassicalBars(container, sentiment) {
  if (!sentiment) return;
  for (const axis of ['valence', 'arousal']) {
    const val = sentiment[axis] ?? 0;
    const pct = ((val + 1) / 2 * 100).toFixed(0);
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <span class="bar-label">${C_LABELS[axis]}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${C_COLORS[axis]}"></div></div>
      <span class="bar-value">${val >= 0 ? '+' : ''}${val.toFixed(2)}</span>
      <span class="bar-delta"></span>`;
    container.appendChild(row);
  }
}
