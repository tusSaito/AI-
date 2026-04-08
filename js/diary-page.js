// 日記ページ (diary.html)

import {
  KEYS, loadJSON, loadEntries, saveEntries,
  renderEmotionBars, renderClassicalBars,
  initThemeToggle
} from './shared.js';
import { PERSONA_NAME } from './persona.js';
import { saveEntry } from './pipeline.js';

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();

  const container   = document.getElementById('entries-container');
  const emptyState  = document.getElementById('empty-state');
  const diaryList   = document.getElementById('diary-list');
  const saveBtn     = document.getElementById('save-btn');
  const entryCount  = document.getElementById('entry-count');

  renderNewDiary();
  renderList();

  // 新規日記の表示・保存
  function renderNewDiary() {
    const entry = loadJSON(KEYS.CURRENT_RESULT, null);
    if (!entry) { saveBtn.hidden = true; return; }

    saveBtn.hidden = false;
    saveBtn.addEventListener('click', () => {
      saveEntry(entry);
      saveBtn.hidden = true;
      renderList();
    }, { once: true });
  }

  // 蓄積日記一覧
  function renderList() {
    const entries = loadEntries();
    const sorted = Object.values(entries).sort((a, b) => b.date.localeCompare(a.date));
    entryCount.textContent = sorted.length;

    // 新規日記（未保存）
    const pending = loadJSON(KEYS.CURRENT_RESULT, null);

    if (sorted.length === 0 && !pending) {
      diaryList.classList.add('hidden');
      emptyState.classList.remove('hidden');
      emptyState.classList.add('flex');
      return;
    }

    diaryList.classList.remove('hidden');
    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');
    container.innerHTML = '';

    // 未保存エントリ
    if (pending) {
      container.appendChild(buildCard(pending, true));
    }

    // 保存済みエントリ
    for (const entry of sorted) {
      container.appendChild(buildCard(entry, false));
    }
  }

  function buildCard(entry, isNew) {
    const card = document.createElement('article');
    card.className = `bg-white border rounded-xl p-5 mb-4 shadow-sm ${isNew ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`;

    // ヘッダー
    const header = document.createElement('div');
    header.className = 'flex items-center gap-3 mb-4';
    header.innerHTML = `
      <img src="img/dyle.png" alt="" class="w-10 h-10 rounded-full object-cover border-2 border-slate-200" onerror="this.src='img/dyle.svg'">
      <div class="flex-1">
        <h3 class="font-bold text-gray-800 text-sm"></h3>
        <span class="text-xs text-gray-400"></span>
        ${isNew ? '<span class="ml-2 text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold">NEW</span>' : ''}
      </div>`;
    header.querySelector('h3').textContent = `${PERSONA_NAME}の日記`;
    header.querySelector('span.text-gray-400').textContent = entry.date;

    if (!isNew) {
      const delBtn = document.createElement('button');
      delBtn.className = 'text-gray-300 hover:text-red-400 transition text-sm';
      delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      delBtn.addEventListener('click', () => {
        if (confirm(`${entry.date} の日記を削除しますか？`)) {
          const e = loadEntries();
          delete e[entry.date];
          saveEntries(e);
          renderList();
        }
      });
      header.appendChild(delBtn);
    }
    card.appendChild(header);

    // 本文
    const body = document.createElement('div');
    body.className = 'text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-4';
    body.textContent = entry.ai_diary;
    card.appendChild(body);

    // 感情バー
    const bars = document.createElement('div');
    bars.className = 'mb-3';
    renderClassicalBars(bars, entry.sentiment);
    renderEmotionBars(bars, entry.emotion_before, entry.emotion_after);
    card.appendChild(bars);

    // 会話履歴
    if (entry.conversation?.length) {
      const details = document.createElement('details');
      details.className = 'mt-2';
      const summary = document.createElement('summary');
      summary.className = 'text-xs text-gray-400 cursor-pointer hover:text-gray-600 transition';
      summary.textContent = `会話履歴を見る (${entry.conversation.length} メッセージ)`;
      details.appendChild(summary);

      const log = document.createElement('div');
      log.className = 'mt-2 space-y-1';
      for (const m of entry.conversation) {
        const line = document.createElement('p');
        line.className = `text-xs ${m.role === 'user' ? 'text-blue-600' : 'text-gray-500'}`;
        line.textContent = `${m.role === 'user' ? 'あなた' : PERSONA_NAME}: ${m.content}`;
        log.appendChild(line);
      }
      details.appendChild(log);
      card.appendChild(details);
    }

    return card;
  }
});
