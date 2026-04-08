// 記録ページ (archive.html) — カレンダー・グラフ・一覧・エクスポート/インポート

import {
  KEYS, loadEntries, saveEntries, loadJSON,
  applyTheme, currentTheme
} from './shared.js';

let currentMonth = new Date();
let graphRange = '30';  // '7' | '30' | 'all'

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme());
  updateThemeIcon();

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
      updateThemeIcon();
    });
  }

  renderCalendar();
  renderGraphs();
  renderList();
  initExportImport();
  initRangeButtons();
  initSearch();

  document.getElementById('prev-month')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('next-month')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  });
});

function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.innerHTML = currentTheme() === 'dark'
    ? '<i class="fa-solid fa-sun"></i>'
    : '<i class="fa-solid fa-moon"></i>';
}

// ── カレンダー ──
function renderCalendar() {
  const container = document.getElementById('calendar-grid');
  const monthLabel = document.getElementById('month-label');
  if (!container) return;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  if (monthLabel) monthLabel.textContent = `${year}年${month + 1}月`;

  const entries = loadEntries();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  container.innerHTML = '';

  // 曜日ヘッダー
  for (const d of ['日','月','火','水','木','金','土']) {
    const el = document.createElement('div');
    el.className = 'cal-header';
    el.textContent = d;
    container.appendChild(el);
  }

  // 空白セル
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'cal-empty';
    container.appendChild(el);
  }

  // 日付セル
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;

    const entry = entries[dateStr];
    if (entry) {
      el.classList.add('has-entry');
      // confidence に基づく色
      const conf = entry.emotion_after?.confidence ?? 0.5;
      const hue = Math.round(conf * 120); // 0=red, 60=yellow, 120=green
      const dot = document.createElement('span');
      dot.className = 'cal-dot';
      dot.style.backgroundColor = `hsl(${hue}, 70%, 50%)`;
      el.appendChild(dot);
      el.addEventListener('click', () => {
        window.location.href = `diary.html#${dateStr}`;
      });
      el.style.cursor = 'pointer';
    }

    container.appendChild(el);
  }
}

// ── 感情グラフ ──
function renderGraphs() {
  const container = document.getElementById('graphs');
  if (!container) return;

  const entries = loadEntries();
  const sorted = Object.values(entries).sort((a, b) => a.date.localeCompare(b.date));

  // 期間フィルタ
  let filtered = sorted;
  if (graphRange !== 'all') {
    const days = parseInt(graphRange);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    filtered = sorted.filter(e => e.date >= cutoffStr);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-muted">データがありません</p>';
    return;
  }

  const axes = [
    { key: 'valence',    label: '快↔不快 (Valence)',  color: '#ec4899', type: 'classical' },
    { key: 'arousal',    label: '活性↔沈静 (Arousal)', color: '#8b5cf6', type: 'classical' },
    { key: 'confidence', label: '自信 (Confidence)',     color: '#f59e0b', type: 'quantum' },
    { key: 'curiosity',  label: '好奇心 (Curiosity)',    color: '#3b82f6', type: 'quantum' },
    { key: 'calm',       label: '冷静 (Calm)',           color: '#10b981', type: 'quantum' }
  ];

  container.innerHTML = '';
  for (const axis of axes) {
    const chart = document.createElement('div');
    chart.className = 'mini-chart';

    const label = document.createElement('div');
    label.className = 'chart-label';
    label.textContent = axis.label;
    chart.appendChild(label);

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 80;
    chart.appendChild(canvas);
    container.appendChild(chart);

    drawMiniChart(canvas, filtered, axis);
  }
}

function drawMiniChart(canvas, data, axis) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const padding = { top: 5, bottom: 15, left: 5, right: 40 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;

  ctx.clearRect(0, 0, w, h);

  // 値の取得
  const values = data.map(entry => {
    if (axis.type === 'classical') {
      const raw = entry.sentiment?.[axis.key] ?? 0;
      return (raw + 1) / 2; // -1〜1 → 0〜1
    }
    return entry.emotion_after?.[axis.key] ?? 0.5;
  });

  if (values.length === 0) return;

  // 面積塗りつぶし
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + plotH);
  for (let i = 0; i < values.length; i++) {
    const x = padding.left + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW);
    const y = padding.top + (1 - values[i]) * plotH;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(padding.left + plotW, padding.top + plotH);
  ctx.closePath();
  ctx.fillStyle = axis.color + '30';
  ctx.fill();

  // ライン
  ctx.beginPath();
  for (let i = 0; i < values.length; i++) {
    const x = padding.left + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW);
    const y = padding.top + (1 - values[i]) * plotH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = axis.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // ポイントマーカー
  for (let i = 0; i < values.length; i++) {
    const x = padding.left + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW);
    const y = padding.top + (1 - values[i]) * plotH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = axis.color;
    ctx.fill();
  }

  // 最新値ラベル
  const latest = values[values.length - 1];
  const lx = padding.left + plotW + 5;
  const ly = padding.top + (1 - latest) * plotH + 4;
  ctx.fillStyle = axis.color;
  ctx.font = '11px sans-serif';
  ctx.fillText((latest * 100).toFixed(0) + '%', lx, ly);
}

// ── 期間切替 ──
function initRangeButtons() {
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      graphRange = btn.dataset.range;
      renderGraphs();
    });
  });
}

// ── 一覧・検索 ──
function renderList(filter = '') {
  const container = document.getElementById('entry-list');
  if (!container) return;

  const entries = loadEntries();
  let sorted = Object.values(entries).sort((a, b) => b.date.localeCompare(a.date));

  if (filter) {
    const q = filter.toLowerCase();
    sorted = sorted.filter(e =>
      e.ai_diary?.toLowerCase().includes(q) ||
      e.conversation?.some(m => m.content.toLowerCase().includes(q))
    );
  }

  if (sorted.length === 0) {
    container.innerHTML = '<p class="text-muted">該当する日記がありません</p>';
    return;
  }

  container.innerHTML = '';
  for (const entry of sorted) {
    const item = document.createElement('div');
    item.className = 'entry-item';
    item.innerHTML = `
      <span class="entry-date">${entry.date}</span>
      <span class="entry-preview">${escapeHtml((entry.ai_diary || '').slice(0, 60))}…</span>`;
    item.addEventListener('click', () => {
      window.location.href = `diary.html#${entry.date}`;
    });
    container.appendChild(item);
  }
}

function initSearch() {
  const input = document.getElementById('search-input');
  if (input) {
    input.addEventListener('input', () => renderList(input.value));
  }
}

// ── エクスポート / インポート / 全削除 ──
function initExportImport() {
  document.getElementById('export-btn')?.addEventListener('click', handleExport);
  document.getElementById('import-btn')?.addEventListener('click', () => {
    document.getElementById('import-file')?.click();
  });
  document.getElementById('import-file')?.addEventListener('change', handleImport);
  document.getElementById('clear-btn')?.addEventListener('click', handleClear);
}

function handleExport() {
  const data = {
    entries: loadEntries(),
    memory: loadJSON(KEYS.MEMORY, null),
    exported_at: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `penguin-dyle-export-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('ファイルサイズが 5MB を超えています');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.entries && typeof data.entries === 'object') {
        const mode = confirm('既存データとマージしますか？\n「OK」= マージ、「キャンセル」= 上書き');
        if (mode) {
          const current = loadEntries();
          Object.assign(current, data.entries);
          saveEntries(current);
        } else {
          saveEntries(data.entries);
        }
      }
      if (data.memory) {
        localStorage.setItem(KEYS.MEMORY, JSON.stringify(data.memory));
      }
      renderCalendar();
      renderGraphs();
      renderList();
      alert('インポートが完了しました');
    } catch {
      alert('ファイルの読み込みに失敗しました');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function handleClear() {
  if (!confirm('すべてのデータを削除しますか？\nこの操作は取り消せません。')) return;
  if (!confirm('本当に削除してよろしいですか？')) return;
  for (const key of Object.values(KEYS)) {
    localStorage.removeItem(key);
  }
  renderCalendar();
  renderGraphs();
  renderList();
  alert('すべてのデータを削除しました');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
