// 記録ページ (archive.html) — タブ切替・カレンダー・グラフ・一覧

import {
  KEYS, loadEntries, saveEntries, loadJSON,
  initThemeToggle, loadMemory, todayStr
} from './shared.js';

let currentMonth = new Date();
let graphRange = 7;

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();

  // タブ切替
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });

  renderCalendar();
  renderGraphs();
  renderList();
  initExportImport();

  // カレンダーナビ
  document.getElementById('cal-prev')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('cal-next')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  });

  // グラフ期間
  document.querySelectorAll('.graph-range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.graph-range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      graphRange = parseInt(btn.dataset.range);
      renderGraphs();
    });
  });

  // 検索
  document.getElementById('search-input')?.addEventListener('input', (e) => renderList(e.target.value));
});

// ── カレンダー ──
function renderCalendar() {
  const container = document.getElementById('calendar-grid');
  const label = document.getElementById('cal-month');
  if (!container) return;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  if (label) label.textContent = `${year}年${month + 1}月`;

  const entries = loadEntries();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayStr();

  container.innerHTML = '';
  for (const d of ['日','月','火','水','木','金','土']) {
    const el = document.createElement('div');
    el.className = 'cal-header';
    el.textContent = d;
    container.appendChild(el);
  }

  for (let i = 0; i < firstDay; i++) {
    container.appendChild(document.createElement('div'));
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;

    if (dateStr === today) el.classList.add('today');

    const entry = entries[dateStr];
    if (entry) {
      el.classList.add('has-entry');
      const conf = entry.emotion_after?.confidence ?? 0.5;
      const hue = Math.round(conf * 120);
      const dot = document.createElement('span');
      dot.className = 'cal-dot';
      dot.style.backgroundColor = `hsl(${hue}, 70%, 50%)`;
      el.appendChild(dot);
      el.addEventListener('click', () => { window.location.href = `diary.html#${dateStr}`; });
    }
    container.appendChild(el);
  }
}

// ── 感情グラフ ──
function renderGraphs() {
  const container = document.getElementById('graphs-container');
  if (!container) return;

  const entries = loadEntries();
  const sorted = Object.values(entries).sort((a, b) => a.date.localeCompare(b.date));

  let filtered = sorted;
  if (graphRange > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - graphRange);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    filtered = sorted.filter(e => e.date >= cutoffStr);
  }

  container.innerHTML = '';
  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">データがありません</p>';
    return;
  }

  const axes = [
    { key: 'valence', label: '快↔不快 (Valence)', color: '#ec4899', type: 'classical' },
    { key: 'arousal', label: '活性↔沈静 (Arousal)', color: '#8b5cf6', type: 'classical' },
    { key: 'confidence', label: '自信 (Confidence)', color: '#f59e0b', type: 'quantum' },
    { key: 'curiosity', label: '好奇心 (Curiosity)', color: '#3b82f6', type: 'quantum' },
    { key: 'calm', label: '冷静 (Calm)', color: '#10b981', type: 'quantum' }
  ];

  for (const axis of axes) {
    const card = document.createElement('div');
    card.className = 'bg-white border border-gray-200 rounded-xl p-4 shadow-sm';
    card.innerHTML = `<p class="text-xs font-semibold text-gray-500 mb-2">${axis.label}</p>`;
    const wrap = document.createElement('div');
    wrap.className = 'mini-graph';
    const canvas = document.createElement('canvas');
    canvas.width = 600; canvas.height = 160;
    wrap.appendChild(canvas);
    card.appendChild(wrap);
    container.appendChild(card);
    drawChart(canvas, filtered, axis);
  }
}

function drawChart(canvas, data, axis) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const pad = { top: 8, bottom: 18, left: 8, right: 50 };
  const pw = w - pad.left - pad.right, ph = h - pad.top - pad.bottom;
  ctx.clearRect(0, 0, w, h);

  const values = data.map(e => {
    if (axis.type === 'classical') return ((e.sentiment?.[axis.key] ?? 0) + 1) / 2;
    return e.emotion_after?.[axis.key] ?? 0.5;
  });

  // 面積
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + ph);
  for (let i = 0; i < values.length; i++) {
    const x = pad.left + (values.length === 1 ? pw / 2 : (i / (values.length - 1)) * pw);
    ctx.lineTo(x, pad.top + (1 - values[i]) * ph);
  }
  ctx.lineTo(pad.left + pw, pad.top + ph);
  ctx.closePath();
  ctx.fillStyle = axis.color + '25';
  ctx.fill();

  // ライン
  ctx.beginPath();
  for (let i = 0; i < values.length; i++) {
    const x = pad.left + (values.length === 1 ? pw / 2 : (i / (values.length - 1)) * pw);
    const y = pad.top + (1 - values[i]) * ph;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = axis.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // ポイント
  for (let i = 0; i < values.length; i++) {
    const x = pad.left + (values.length === 1 ? pw / 2 : (i / (values.length - 1)) * pw);
    const y = pad.top + (1 - values[i]) * ph;
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = axis.color; ctx.fill();
  }

  // 最新値
  const last = values[values.length - 1];
  ctx.fillStyle = axis.color;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText((last * 100).toFixed(0) + '%', pad.left + pw + 8, pad.top + (1 - last) * ph + 4);
}

// ── 一覧 ──
function renderList(filter = '') {
  const list = document.getElementById('history-list');
  if (!list) return;

  const entries = loadEntries();
  let sorted = Object.values(entries).sort((a, b) => b.date.localeCompare(a.date));

  if (filter) {
    const q = filter.toLowerCase();
    sorted = sorted.filter(e =>
      e.ai_diary?.toLowerCase().includes(q) ||
      e.conversation?.some(m => m.content.toLowerCase().includes(q))
    );
  }

  list.innerHTML = '';
  if (sorted.length === 0) {
    list.innerHTML = '<li class="p-6 text-center text-sm text-gray-400">該当する日記がありません</li>';
    return;
  }

  for (const entry of sorted) {
    const li = document.createElement('li');
    li.className = 'history-item p-3 flex items-center gap-3';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'text-xs font-bold text-blue-600 min-w-[80px]';
    dateSpan.textContent = entry.date;

    const previewSpan = document.createElement('span');
    previewSpan.className = 'text-xs text-gray-500 truncate flex-1';
    previewSpan.textContent = (entry.ai_diary || '').slice(0, 80) + '…';

    li.appendChild(dateSpan);
    li.appendChild(previewSpan);
    li.addEventListener('click', () => { window.location.href = `diary.html#${encodeURIComponent(entry.date)}`; });
    list.appendChild(li);
  }
}

// ── エクスポート/インポート/全削除 ──
function initExportImport() {
  document.getElementById('export-btn')?.addEventListener('click', () => {
    const data = { entries: loadEntries(), memory: loadJSON(KEYS.MEMORY, null), exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `penguin-dyle-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('import-btn')?.addEventListener('click', () => {
    document.getElementById('import-file')?.click();
  });

  document.getElementById('import-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('ファイルサイズが 5MB を超えています'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.entries && typeof data.entries === 'object') {
          // エントリのバリデーション: 日付キーとデータ構造を検証
          const validated = {};
          for (const [key, entry] of Object.entries(data.entries)) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
            if (!entry || typeof entry !== 'object') continue;
            if (typeof entry.ai_diary !== 'string') continue;
            validated[key] = {
              date: key,
              created_at: typeof entry.created_at === 'string' ? entry.created_at : '',
              ai_diary: entry.ai_diary,
              conversation: Array.isArray(entry.conversation) ? entry.conversation : [],
              sentiment: entry.sentiment && typeof entry.sentiment === 'object' ? entry.sentiment : {},
              emotion_before: entry.emotion_before && typeof entry.emotion_before === 'object' ? entry.emotion_before : {},
              emotion_after: entry.emotion_after && typeof entry.emotion_after === 'object' ? entry.emotion_after : {},
              state_vec: entry.state_vec && typeof entry.state_vec === 'object' ? entry.state_vec : {}
            };
          }
          if (Object.keys(validated).length === 0) { alert('有効な日記エントリがありません'); return; }
          const merge = confirm('既存データとマージしますか？\n「OK」= マージ、「キャンセル」= 上書き');
          if (merge) { const cur = loadEntries(); Object.assign(cur, validated); saveEntries(cur); }
          else saveEntries(validated);
        }
        if (data.memory && typeof data.memory === 'object') {
          localStorage.setItem(KEYS.MEMORY, JSON.stringify(data.memory));
        }
        renderCalendar(); renderGraphs(); renderList();
        alert('インポート完了');
      } catch { alert('ファイルの読み込みに失敗しました'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('clear-btn')?.addEventListener('click', () => {
    if (!confirm('すべてのデータを削除しますか？')) return;
    if (!confirm('本当に削除してよろしいですか？')) return;
    for (const key of Object.values(KEYS)) localStorage.removeItem(key);
    renderCalendar(); renderGraphs(); renderList();
    alert('すべてのデータを削除しました');
  });
}
