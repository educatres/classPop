import { OPTION_KEYS, SYNC_INTERVAL_MS, buildConfigFromParams, buildPageUrl, buildUrlValuesFromConfig, generateId } from './config.js';
import { submitEvent } from './google-form.js';
import { fetchSheetEvents } from './google-sheet.js';
import { buildQuizSnapshot } from './quiz-store.js';
import { renderQr } from './qr.js';
import { copyText, escapeHtml, formatStatus, setText } from './utils.js';

const configResult = buildConfigFromParams();
const app = document.querySelector('#host-app');
const errorPanel = document.querySelector('#config-error');
const questionForm = document.querySelector('#question-form');
const syncStatus = document.querySelector('#sync-status');

let config = null;
let snapshot = null;
let currentQuestionId = generateId('q');
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

  const playUrl = buildPageUrl('play.html', buildUrlValuesFromConfig(config));
  const statsUrl = buildPageUrl('stats.html', buildUrlValuesFromConfig(config));
  setText('#class-id', config.classId);
  document.querySelector('#play-link').value = playUrl;
  document.querySelector('#open-stats').href = statsUrl;
  renderQr(document.querySelector('#qr-code'), playUrl, '學生作答 QR Code');

  document.querySelector('#copy-play').addEventListener('click', async () => {
    await copyText(playUrl);
    syncStatus.textContent = '已複製學生作答連結。';
  });
  document.querySelector('#manual-sync').addEventListener('click', sync);
  document.querySelector('#open-question').addEventListener('click', () => submitTeacherEvent('question_open'));
  document.querySelector('#close-question').addEventListener('click', () => submitTeacherEvent('question_close'));
  document.querySelector('#reveal-answer').addEventListener('click', () => submitTeacherEvent('answer_reveal'));
  document.querySelector('#reset-question').addEventListener('click', () => submitTeacherEvent('question_reset'));
  document.querySelector('#next-question').addEventListener('click', nextQuestion);
  questionForm.addEventListener('submit', createQuestion);

  sync();
  syncTimer = setInterval(sync, SYNC_INTERVAL_MS);
  window.addEventListener('pagehide', () => clearInterval(syncTimer));
}

async function createQuestion(event) {
  event.preventDefault();
  await submitTeacherEvent('question_create', readQuestionForm());
}

async function submitTeacherEvent(eventType, data = readCurrentQuestionData()) {
  if (!data.question_id) {
    syncStatus.textContent = '請先建立題目。';
    return;
  }

  try {
    await submitEvent(config, {
      ...data,
      event_type: eventType,
      student_session_id: '',
      answer: '',
      extra_json: '{}',
    });
    syncStatus.textContent = '已嘗試送出，資料同步可能需要幾秒鐘。';
    await sync();
  } catch (error) {
    syncStatus.textContent = `送出失敗：${error.message}`;
  }
}

function readQuestionForm() {
  const formData = new FormData(questionForm);
  return {
    question_id: currentQuestionId,
    question_text: String(formData.get('question_text') || '').trim(),
    option_a: String(formData.get('option_a') || '').trim(),
    option_b: String(formData.get('option_b') || '').trim(),
    option_c: String(formData.get('option_c') || '').trim(),
    option_d: String(formData.get('option_d') || '').trim(),
    correct_answer: String(formData.get('correct_answer') || 'A').trim(),
  };
}

function readCurrentQuestionData() {
  const question = snapshot?.question;
  if (!question?.question_id) return readQuestionForm();
  return {
    question_id: question.question_id,
    question_text: question.question_text,
    option_a: question.options.A,
    option_b: question.options.B,
    option_c: question.options.C,
    option_d: question.options.D,
    correct_answer: question.correct_answer,
  };
}

async function sync() {
  try {
    const events = await fetchSheetEvents(config);
    snapshot = buildQuizSnapshot(events, config.classId);
    renderSnapshot();
    syncStatus.textContent = `已同步：${new Date().toLocaleTimeString()}`;
  } catch (error) {
    syncStatus.textContent = '無法讀取 Google Sheet，請確認試算表已設定為「知道連結的人可以檢視」。';
  }
}

function renderSnapshot() {
  const question = snapshot.question;
  const stats = snapshot.stats;
  const hasQuestion = question.status !== 'waiting';

  setText('#question-status', formatStatus(question.status));
  setText('#answer-count', String(stats.total_answers));
  setText('#project-question', hasQuestion ? question.question_text : '目前尚未建立題目');
  setText('#total-answers', String(stats.total_answers));
  setText('#correct-count', String(stats.correct_count));
  setText('#wrong-count', String(stats.wrong_count));
  setText('#correct-rate', `${Math.round(stats.correct_rate)}%`);

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

  document.querySelector('#stats-bars').innerHTML = OPTION_KEYS.map((key) => {
    const count = stats.counts[key];
    const percent = stats.total_answers ? (count / stats.total_answers) * 100 : 0;
    return `
      <div class="bar-row">
        <strong>${key}</strong>
        <div class="bar-track"><span class="bar-fill option-${key.toLowerCase()}" style="width:${percent}%"></span></div>
        <span>${count}</span>
      </div>
    `;
  }).join('');
}

function nextQuestion() {
  currentQuestionId = generateId('q');
  questionForm.reset();
  questionForm.elements.namedItem('correct_answer').value = 'A';
  syncStatus.textContent = '已準備下一題，請輸入題目後按「建立題目」。';
}

function symbolFor(choice) {
  return { A: '▲', B: '◆', C: '●', D: '■' }[choice];
}
