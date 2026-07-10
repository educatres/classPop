import { OPTION_KEYS, SYNC_INTERVAL_MS, buildConfigFromParams, generateId } from './config.js';
import { submitEvent } from './google-form.js';
import { fetchSheetEvents } from './google-sheet.js';
import { buildQuizSnapshot } from './quiz-store.js';
import { escapeHtml, formatStatus, setText } from './utils.js';

const configResult = buildConfigFromParams();
const app = document.querySelector('#play-app');
const errorPanel = document.querySelector('#config-error');
const syncStatus = document.querySelector('#sync-status');

let config = null;
let snapshot = null;
let studentId = '';
let syncTimer = null;

init();

function init() {
  if (!configResult.ok) {
    errorPanel.classList.remove('hidden');
    errorPanel.textContent = `系統設定不完整，請回到老師設定頁重新產生連結。缺少：${configResult.missing.join('、')}`;
    return;
  }

  config = configResult.config;
  studentId = getStudentId();
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
  const localAnswers = readLocalAnswers();
  const myAnswer = localAnswers[question.question_id] || findSyncedAnswer(question.question_id);
  const isAnswered = Boolean(myAnswer);

  setText('#question-status', formatStatus(question.status));

  if (question.status === 'waiting') {
    renderMessage('等待老師開放題目', '目前尚未有題目，請看投影畫面或稍候。');
    return;
  }

  if (question.status === 'created') {
    renderQuestion(question, '');
    renderMessage('等待老師開放題目', '請看投影畫面或稍候。', true);
    return;
  }

  if (question.status === 'open' && !isAnswered) {
    renderQuestion(question, renderAnswerButtons(question));
    return;
  }

  if (question.status === 'closed' && !isAnswered) {
    renderQuestion(question, '');
    renderMessage('作答已截止', '請等待老師公布答案。', true);
    return;
  }

  if (question.status === 'revealed') {
    renderQuestion(question, '');
    renderResult(myAnswer, question.correct_answer);
    return;
  }

  renderQuestion(question, '');
  renderMessage('已送出答案', `你的答案：${myAnswer}<br>等待老師公布答案。`, true);
}

function renderQuestion(question, actionsHtml) {
  document.querySelector('#play-content').innerHTML = `
    <section class="student-question">
      <h1>${escapeHtml(question.question_text)}</h1>
      <div class="answer-grid">
        ${OPTION_KEYS.map((key) => `
          <div class="option-card option-${key.toLowerCase()}">
            <span class="option-symbol">${symbolFor(key)}</span>
            <strong>${key}</strong>
            <p>${escapeHtml(question.options[key])}</p>
          </div>
        `).join('')}
      </div>
      ${actionsHtml}
    </section>
  `;
}

function renderAnswerButtons(question) {
  return `
    <div class="choice-buttons">
      ${OPTION_KEYS.map((key) => `
        <button class="choice-btn option-${key.toLowerCase()}" data-answer="${key}">
          <span>${symbolFor(key)}</span>
          <strong>${key}</strong>
          ${escapeHtml(question.options[key])}
        </button>
      `).join('')}
    </div>
  `;
}

function renderMessage(title, body, append = false) {
  const html = `
    <section class="message-panel">
      <h1>${title}</h1>
      <p>${body}</p>
    </section>
  `;

  if (append) {
    document.querySelector('#play-content').insertAdjacentHTML('beforeend', html);
  } else {
    document.querySelector('#play-content').innerHTML = html;
  }
}

function renderResult(myAnswer, correctAnswer) {
  const isCorrect = myAnswer && myAnswer === correctAnswer;
  const title = isCorrect ? '答對了！' : '答錯了';
  const body = myAnswer
    ? `你的答案：${myAnswer}<br>正確答案：${correctAnswer}`
    : `你沒有送出答案<br>正確答案：${correctAnswer}`;

  renderMessage(title, body, true);
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-answer]');
  if (!button || !snapshot) return;

  const question = snapshot.question;
  const answer = button.dataset.answer;
  const localAnswers = readLocalAnswers();

  if (question.status !== 'open' || localAnswers[question.question_id]) return;

  button.disabled = true;
  await submitAnswer(question, answer);
});

async function submitAnswer(question, answer) {
  writeLocalAnswer(question.question_id, answer);
  renderSnapshot();

  try {
    await submitEvent(config, {
      event_type: 'answer_submit',
      question_id: question.question_id,
      question_text: question.question_text,
      option_a: question.options.A,
      option_b: question.options.B,
      option_c: question.options.C,
      option_d: question.options.D,
      correct_answer: question.correct_answer,
      answer,
      student_session_id: studentId,
      extra_json: '{}',
    });
    syncStatus.textContent = '已嘗試送出，資料同步可能需要幾秒鐘。';
  } catch (error) {
    syncStatus.textContent = `送出失敗：${error.message}`;
  }
}

function findSyncedAnswer(questionId) {
  return snapshot.answers.find((item) => item.question_id === questionId && item.student_session_id === studentId)?.answer || '';
}

function getStudentId() {
  const key = 'classquiz:student_session_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = generateId('stu');
  localStorage.setItem(key, next);
  return next;
}

function readLocalAnswers() {
  return JSON.parse(localStorage.getItem(`classquiz:${config.classId}:answers`) || '{}');
}

function writeLocalAnswer(questionId, answer) {
  const answers = readLocalAnswers();
  answers[questionId] = answer;
  localStorage.setItem(`classquiz:${config.classId}:answers`, JSON.stringify(answers));
}

function symbolFor(choice) {
  return { A: '▲', B: '◆', C: '●', D: '■' }[choice];
}
