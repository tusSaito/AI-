// 日記ページ (diary.html) — 日記表示・保存・蓄積一覧

import {
  KEYS, loadJSON, loadEntries, saveEntries,
  renderEmotionBars, renderClassicalBars,
  applyTheme, currentTheme, formatDate
} from './shared.js';
import { PERSONA_NAME } from './persona.js';
import { saveEntry } from './pipeline.js';
import { AXES } from './quantum.js';

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

  renderNewDiary();
  renderDiaryList();
});

function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.innerHTML = currentTheme() === 'dark'
    ? '<i class="fa-solid fa-sun"></i>'
    : '<i class="fa-solid fa-moon"></i>';
}

// ── 新規日記の表示 ──
function renderNewDiary() {
  const container = document.getElementById('new-diary');
  if (!container) return;

  const entry = loadJSON(KEYS.CURRENT_RESULT, null);
  if (!entry) {
    container.style.display = 'none';
    return;
  }

  container.style.display = '';
  container.innerHTML = `
    <div class="diary-new-card">
      <div class="diary-header">
        <img src="img/dyle.png" alt="${PERSONA_NAME}" class="avatar"
             onerror="this.style.display='none'">
        <div>
          <strong>${PERSONA_NAME}の日記</strong>
          <span class="diary-date">${entry.date}</span>
        </div>
      </div>
      <div class="diary-body">${escapeHtml(entry.ai_diary)}</div>
      <div class="diary-emotions" id="new-diary-emotions"></div>
      <div class="diary-actions">
        <button class="btn" id="save-diary-btn">
          <i class="fa-solid fa-floppy-disk"></i> 保存する
        </button>
        <button class="btn btn-ghost" id="discard-diary-btn">
          <i class="fa-solid fa-trash"></i> 破棄する
        </button>
      </div>
    </div>`;

  // 感情バー
  const emotionContainer = document.getElementById('new-diary-emotions');
  if (emotionContainer) {
    renderClassicalBars(emotionContainer, entry.sentiment);
    renderEmotionBars(emotionContainer, entry.emotion_before, entry.emotion_after);
  }

  // 保存ボタン
  document.getElementById('save-diary-btn').addEventListener('click', () => {
    saveEntry(entry);
    container.style.display = 'none';
    renderDiaryList();
  });

  // 破棄ボタン
  document.getElementById('discard-diary-btn').addEventListener('click', () => {
    if (confirm('生成された日記を破棄しますか？')) {
      localStorage.removeItem(KEYS.CURRENT_RESULT);
      container.style.display = 'none';
    }
  });
}

// ── 蓄積日記一覧 ──
function renderDiaryList() {
  const container = document.getElementById('diary-list');
  if (!container) return;

  const entries = loadEntries();
  const sorted = Object.values(entries).sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-book-open"></i>
        <p>まだ日記がありません。<br>
        <a href="index.html">${PERSONA_NAME}と会話して</a>、日記を生成してみましょう。</p>
      </div>`;
    return;
  }

  container.innerHTML = '';
  for (const entry of sorted) {
    const card = document.createElement('div');
    card.className = 'diary-card';
    card.innerHTML = `
      <div class="diary-header">
        <img src="img/dyle.png" alt="${PERSONA_NAME}" class="avatar"
             onerror="this.style.display='none'">
        <div>
          <strong>${PERSONA_NAME}の日記</strong>
          <span class="diary-date">${entry.date}</span>
        </div>
        <button class="btn-icon delete-entry" data-date="${entry.date}" title="削除">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="diary-body">${escapeHtml(entry.ai_diary)}</div>
      <div class="diary-emotions" id="emotions-${entry.date}"></div>
      <details class="diary-conversation">
        <summary>会話履歴を見る</summary>
        <div class="conversation-log" id="conv-${entry.date}"></div>
      </details>`;

    container.appendChild(card);

    // 感情バー
    const emotionEl = document.getElementById(`emotions-${entry.date}`);
    if (emotionEl) {
      renderClassicalBars(emotionEl, entry.sentiment);
      renderEmotionBars(emotionEl, entry.emotion_before, entry.emotion_after);
      // 個別パラメータ削除ボタン
      addParamDeleteButtons(emotionEl, entry);
    }

    // 会話履歴
    const convEl = document.getElementById(`conv-${entry.date}`);
    if (convEl && entry.conversation) {
      for (const m of entry.conversation) {
        const line = document.createElement('div');
        line.className = `conv-line conv-${m.role}`;
        line.textContent = `${m.role === 'user' ? 'あなた' : PERSONA_NAME}: ${m.content}`;
        convEl.appendChild(line);
      }
    }
  }

  // 削除イベント
  container.querySelectorAll('.delete-entry').forEach(btn => {
    btn.addEventListener('click', () => {
      const date = btn.dataset.date;
      if (confirm(`${date} の日記を削除しますか？`)) {
        const e = loadEntries();
        delete e[date];
        saveEntries(e);
        renderDiaryList();
      }
    });
  });
}

// ── パラメータ個別削除ボタン ──
function addParamDeleteButtons(container, entry) {
  const rows = container.querySelectorAll('.emotion-row');
  rows.forEach((row, i) => {
    const btn = document.createElement('button');
    btn.className = 'btn-icon param-delete';
    btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    btn.title = 'このパラメータを削除';
    btn.addEventListener('click', () => {
      const label = row.querySelector('.emotion-label')?.textContent;
      if (confirm(`「${label}」のパラメータを削除しますか？`)) {
        // 該当軸のデータを削除
        const axisMap = { '快↔不快': 'valence', '活性↔沈静': 'arousal', '自信': 'confidence', '好奇心': 'curiosity', '冷静': 'calm' };
        const axis = axisMap[label];
        if (axis) {
          const entries = loadEntries();
          const e = entries[entry.date];
          if (e) {
            if (axis === 'valence' || axis === 'arousal') {
              if (e.sentiment) delete e.sentiment[axis];
            } else {
              if (e.emotion_before) delete e.emotion_before[axis];
              if (e.emotion_after) delete e.emotion_after[axis];
              if (e.state_vec) delete e.state_vec[axis];
            }
            saveEntries(entries);
            renderDiaryList();
          }
        }
      }
    });
    row.appendChild(btn);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
