import { OPTION_KEYS, buildConfigFromParams } from './config.js';
import { deleteExpiredClass, fetchClassEvents, subscribeToClassEvents } from './firebase-store.js';
import { buildQuizSnapshot } from './quiz-store.js';
import { escapeHtml, formatStatus, setText } from './utils.js';

const configResult = buildConfigFromParams();
const app = document.querySelector('#stats-app');
const errorPanel = document.querySelector('#config-error');
const syncStatus = document.querySelector('#sync-status');
const questionSelect = document.querySelector('#question-select');

let config = null;
let snapshot = null;
let selectedQuestionId = '';
let unsubscribe = null;

init();

async function init() {
  if (!configResult.ok) {
    errorPanel.classList.remove('hidden');
    errorPanel.textContent = `系統設定不完整，請回到老師設定頁重新產生連結。缺少：${configResult.missing.join('、')}`;
    return;
  }

  config = configResult.config;
  snapshot = buildQuizSnapshot([], config.classId);
  app.classList.remove('hidden');
  setText('#class-id', config.classId);
  document.querySelector('#manual-sync').addEventListener('click', manualSync);
  questionSelect.addEventListener('change', () => {
    if (!snapshot) return;
    selectedQuestionId = questionSelect.value;
    snapshot = buildQuizSnapshot(snapshot.events, config.classId, selectedQuestionId);
    renderSnapshot();
  });
  renderSnapshot();

  try {
    unsubscribe = await subscribeToClassEvents(config, handleEvents, handleFirebaseError);
    syncStatus.textContent = '即時同步已連線。';
  } catch (error) {
    handleFirebaseError(error);
  }

  window.addEventListener('pagehide', () => unsubscribe?.());
}

function handleEvents(events) {
  snapshot = buildQuizSnapshot(events, config.classId, selectedQuestionId);
  if (selectedQuestionId && !snapshot.questions.some((item) => item.question.question_id === selectedQuestionId)) {
    selectedQuestionId = '';
    snapshot = buildQuizSnapshot(events, config.classId);
  }
  renderSnapshot();
  syncStatus.textContent = `已同步：${new Date().toLocaleTimeString()}`;
}

async function manualSync() {
  try {
    const events = await fetchClassEvents(config);
    handleEvents(events);
  } catch (error) {
    handleFirebaseError(error);
  }
}

function handleFirebaseError(error) {
  console.error(error);
  const message = String(error?.message || error || '');
  const permissionDenied = /permission_denied|permission denied/i.test(message);
  if (permissionDenied) deleteExpiredClass(config?.classId).catch(() => {});
  syncStatus.textContent = permissionDenied
    ? '課程可能已超過 3 天到期，或目前沒有存取權限。'
    : (message || '連線失敗，請稍後再試。');
}

function renderSnapshot() {
  renderQuestionSelect();
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

function renderQuestionSelect() {
  const currentValue = selectedQuestionId;
  const options = snapshot.questions.map((item, index) => {
    const question = item.question;
    const label = question.question_text || `第 ${index + 1} 題`;
    return `<option value="${escapeHtml(question.question_id)}">第 ${index + 1} 題：${escapeHtml(label)}</option>`;
  });

  questionSelect.innerHTML = [
    '<option value="">最後一題</option>',
    ...options,
  ].join('');
  questionSelect.value = currentValue;
}

function symbolFor(choice) {
  return { A: '▲', B: '◆', C: '●', D: '■' }[choice];
}
