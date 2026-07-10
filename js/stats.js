import { OPTION_KEYS, SYNC_INTERVAL_MS, buildConfigFromParams } from './config.js';
import { fetchSheetEvents } from './google-sheet.js';
import { buildQuizSnapshot } from './quiz-store.js';
import { escapeHtml, formatStatus, setText } from './utils.js';

const configResult = buildConfigFromParams();
const app = document.querySelector('#stats-app');
const errorPanel = document.querySelector('#config-error');
const syncStatus = document.querySelector('#sync-status');

let config = null;
let snapshot = null;
let syncTimer = null;

init();

function init() {
  if (!configResult.ok) {
    errorPanel.classList.remove('hidden');
    errorPanel.textContent = `系統設定不完整，請回到老師設定頁重新產生連結。缺少：${configResult.missing.join('、')}`;
    return;
  }

  config = configResult.config;
  app.classList.remove('hidden');
  setText('#class-id', config.classId);
  document.querySelector('#manual-sync').addEventListener('click', sync);

  sync();
  syncTimer = setInterval(sync, SYNC_INTERVAL_MS);
  window.addEventListener('pagehide', () => clearInterval(syncTimer));
}

async function sync() {
  try {
    const events = await fetchSheetEvents(config);
    snapshot = buildQuizSnapshot(events, config.classId);
    renderSnapshot();
    syncStatus.textContent = `已同步：${new Date().toLocaleTimeString()}`;
  } catch {
    syncStatus.textContent = '無法讀取 Google Sheet，請確認試算表已設定為「知道連結的人可以檢視」。';
  }
}

function renderSnapshot() {
  const question = snapshot.question;
  const stats = snapshot.stats;
  const hasQuestion = question.status !== 'waiting';

  setText('#question-status', formatStatus(question.status));
  setText('#answer-count', String(stats.total_answers));
  setText('#stats-question', hasQuestion ? question.question_text : '目前尚未建立題目');
  setText('#total-answers', String(stats.total_answers));
  setText('#correct-count', String(stats.correct_count));
  setText('#wrong-count', String(stats.wrong_count));
  setText('#correct-rate', `${Math.round(stats.correct_rate)}%`);

  document.querySelector('#stats-bars').innerHTML = OPTION_KEYS.map((key) => {
    const count = stats.counts[key];
    const percent = stats.total_answers ? (count / stats.total_answers) * 100 : 0;
    return `
      <div class="bar-row stats-bar-row">
        <strong>${key}</strong>
        <div class="bar-track"><span class="bar-fill option-${key.toLowerCase()}" style="width:${percent}%"></span></div>
        <span>${count}</span>
      </div>
    `;
  }).join('');

  document.querySelector('#option-list').innerHTML = OPTION_KEYS.map((key) => {
    const isCorrect = question.status === 'revealed' && question.correct_answer === key;
    return `
      <div class="option-card option-${key.toLowerCase()} ${isCorrect ? 'is-correct' : ''}">
        <span class="option-symbol">${symbolFor(key)}</span>
        <strong>${key}</strong>
        <p>${escapeHtml(question.options[key] || '尚未設定')}</p>
      </div>
    `;
  }).join('');
}

function symbolFor(choice) {
  return { A: '▲', B: '◆', C: '●', D: '■' }[choice];
}
