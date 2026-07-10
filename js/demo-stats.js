import { OPTION_KEYS } from './config.js';
import { buildQuizSnapshot } from './quiz-store.js';
import { escapeHtml, formatStatus, setText } from './utils.js';
import { DEMO_CLASS_ID, readDemoEvents } from './demo-store.js';

const questionSelect = document.querySelector('#question-select');
const syncStatus = document.querySelector('#sync-status');

let snapshot = buildQuizSnapshot(readDemoEvents(), DEMO_CLASS_ID);
let selectedQuestionId = '';

init();

function init() {
  document.querySelector('#manual-sync').addEventListener('click', sync);
  questionSelect.addEventListener('change', () => {
    selectedQuestionId = questionSelect.value;
    snapshot = buildQuizSnapshot(snapshot.events, DEMO_CLASS_ID, selectedQuestionId);
    renderSnapshot();
  });
  window.addEventListener('storage', sync);
  setInterval(sync, 1000);
  sync();
}

function sync() {
  const events = readDemoEvents();
  snapshot = buildQuizSnapshot(events, DEMO_CLASS_ID, selectedQuestionId);
  if (selectedQuestionId && !snapshot.questions.some((item) => item.question.question_id === selectedQuestionId)) {
    selectedQuestionId = '';
    snapshot = buildQuizSnapshot(events, DEMO_CLASS_ID);
  }
  renderSnapshot();
  syncStatus.textContent = `已同步：${new Date().toLocaleTimeString()}`;
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
  const options = snapshot.questions.map((item, index) => {
    const question = item.question;
    const label = question.question_text || `第 ${index + 1} 題`;
    return `<option value="${escapeHtml(question.question_id)}">第 ${index + 1} 題：${escapeHtml(label)}</option>`;
  });

  questionSelect.innerHTML = [
    '<option value="">最後一題</option>',
    ...options,
  ].join('');
  questionSelect.value = selectedQuestionId;
}

function symbolFor(choice) {
  return { A: '▲', B: '◆', C: '●', D: '■' }[choice];
}
