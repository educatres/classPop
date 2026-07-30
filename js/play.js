import { OPTION_KEYS, buildConfigFromParams, generateId } from './config.js';
import { deleteExpiredClass, fetchClassEvents, submitEvent, subscribeToClassEvents, subscribeToServerTimeOffset } from './firebase-store.js';
import { CountdownAudio, getCountdownState, updateCountdownElement } from './countdown-audio.js';
import { buildQuizSnapshot } from './quiz-store.js';
import { escapeHtml, formatStatus, setText } from './utils.js';

const configResult = buildConfigFromParams();
const app = document.querySelector('#play-app');
const errorPanel = document.querySelector('#config-error');
const syncStatus = document.querySelector('#sync-status');
const soundToggle = document.querySelector('#sound-toggle');

let config = null;
let snapshot = null;
let studentId = '';
let unsubscribe = null;
let unsubscribeTimeOffset = null;
let serverTimeOffset = 0;
let countdownInterval = null;
let soundEnabled = false;
let playedResultKey = '';
const pendingAnswers = new Map();
const countdownAudio = new CountdownAudio(false);

init();

async function init() {
  if (!configResult.ok) {
    errorPanel.classList.remove('hidden');
    errorPanel.textContent = `系統設定不完整，請重新掃描老師提供的 QR Code。缺少：${configResult.missing.join('、')}`;
    return;
  }

  config = configResult.config;
  snapshot = buildQuizSnapshot([], config.classId);
  studentId = getStudentId();
  app.classList.remove('hidden');
  setText('#class-id', config.classId);
  document.querySelector('#manual-sync').addEventListener('click', manualSync);
  soundToggle.addEventListener('click', toggleSound);
  renderSnapshot();
  countdownInterval = window.setInterval(updateStudentCountdown, 100);

  try {
    unsubscribeTimeOffset = await subscribeToServerTimeOffset((offset) => {
      serverTimeOffset = offset;
      updateStudentCountdown();
    }, () => {});
  } catch (error) {
    console.warn('無法取得 Firebase server time offset，改用裝置時間。', error);
  }

  try {
    unsubscribe = await subscribeToClassEvents(config, handleEvents, handleFirebaseError);
    syncStatus.textContent = 'Firebase 即時同步已連線。';
  } catch (error) {
    handleFirebaseError(error);
  }

  window.addEventListener('pagehide', cleanup);
}

function handleEvents(events) {
  snapshot = buildQuizSnapshot(events, config.classId);
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
    ? '課程可能已超過 3 天到期，或 Firebase 權限設定尚未完成。'
    : (message || 'Firebase 連線失敗。');
}

function renderSnapshot() {
  const question = snapshot.question;
  const localAnswers = readLocalAnswers();
  const pendingAnswer = pendingAnswers.get(question.question_id) || '';
  const myAnswer = localAnswers[question.question_id] || findSyncedAnswer(question.question_id) || pendingAnswer;
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
    updateStudentCountdown();
    return;
  }

  if (question.status === 'closed' && !isAnswered) {
    renderQuestion(question, '');
    renderMessage('作答已截止', '請等待老師公布答案。', true, 'result-neutral');
    return;
  }

  if (question.status === 'revealed') {
    renderQuestion(question, '');
    renderResult(myAnswer, question.correct_answer, question.question_id);
    return;
  }

  renderQuestion(question, '');
  const pending = pendingAnswers.has(question.question_id);
  renderMessage(pending ? '正在送出…' : '答案已鎖定 ✓', `你的答案：${escapeHtml(myAnswer)}<br>${pending ? '正在寫入 Firebase，請勿關閉頁面。' : '等待老師公布答案。'}`, true, 'result-pending');
  updateStudentCountdown();
}

function renderQuestion(question, actionsHtml) {
  const countdownHtml = question.status === 'open' ? `
    <div id="student-countdown" class="countdown-widget student-countdown" aria-live="polite">
      <div class="countdown-label">作答倒數</div>
      <div class="countdown-number" data-countdown-number>${question.timer_seconds}</div>
      <div class="countdown-progress"><span data-countdown-fill></span></div>
    </div>
  ` : '';

  document.querySelector('#play-content').innerHTML = `
    <section class="student-question">
      ${countdownHtml}
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

function renderMessage(title, body, append = false, className = '') {
  const html = `
    <section class="message-panel ${className}">
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

function renderResult(myAnswer, correctAnswer, questionId) {
  const isCorrect = myAnswer && myAnswer === correctAnswer;
  const title = isCorrect ? '答對了！ ✓' : '答錯了';
  const body = myAnswer
    ? `你的答案：${escapeHtml(myAnswer)}<br>正確答案：${escapeHtml(correctAnswer)}`
    : `你沒有送出答案<br>正確答案：${escapeHtml(correctAnswer)}`;

  renderMessage(title, body, true, isCorrect ? 'result-correct' : 'result-wrong');
  const resultKey = `${questionId}:${correctAnswer}:${myAnswer || '-'}`;
  if (playedResultKey !== resultKey) {
    playedResultKey = resultKey;
    if (isCorrect) countdownAudio.correct();
    else countdownAudio.wrong();
  }
}

function updateStudentCountdown() {
  if (!snapshot) return;
  const state = getCountdownState(snapshot.question, Date.now() + serverTimeOffset);
  const element = document.querySelector('#student-countdown');
  updateCountdownElement(element, state);
  if (!state.active) return;

  countdownAudio.tick(state.key, state.secondsRemaining);
  if (state.remainingMs <= 0) {
    document.querySelectorAll('.choice-btn').forEach((button) => {
      button.disabled = true;
    });
    setText('#question-status', '時間到');
  }
}

async function toggleSound() {
  soundEnabled = !soundEnabled;
  await countdownAudio.setEnabled(soundEnabled);
  soundToggle.setAttribute('aria-pressed', String(soundEnabled));
  soundToggle.textContent = soundEnabled ? '🔊 節拍開啟' : '🔇 開啟節拍';
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-answer]');
  if (!button || !snapshot) return;

  const question = snapshot.question;
  const answer = button.dataset.answer;
  const localAnswers = readLocalAnswers();
  const countdown = getCountdownState(question, Date.now() + serverTimeOffset);

  if (question.status !== 'open' || localAnswers[question.question_id]) return;
  if (countdown.active && countdown.remainingMs <= 0) {
    syncStatus.textContent = '作答時間已結束。';
    updateStudentCountdown();
    return;
  }

  document.querySelectorAll('.choice-btn').forEach((item) => {
    item.disabled = true;
  });
  button.classList.add('is-selected');
  pendingAnswers.set(question.question_id, answer);
  renderSnapshot();
  await submitAnswer(question, answer);
});

async function submitAnswer(question, answer) {
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
      timer_seconds: question.timer_seconds,
      extra_json: '{}',
    });
    writeLocalAnswer(question.question_id, answer);
    pendingAnswers.delete(question.question_id);
    countdownAudio.submit();
    renderSnapshot();
    syncStatus.textContent = '答案已送出並鎖定。';
  } catch (error) {
    console.error(error);
    pendingAnswers.delete(question.question_id);
    syncStatus.textContent = `送出失敗：${String(error?.message || error)}`;
    renderSnapshot();
  }
}

function findSyncedAnswer(questionId) {
  return snapshot.answers.find((item) => item.question_id === questionId && item.student_session_id === studentId)?.answer || '';
}

function getStudentId() {
  const key = 'classpop:student_session_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = generateId('stu');
  localStorage.setItem(key, next);
  return next;
}

function readLocalAnswers() {
  return JSON.parse(localStorage.getItem(`classpop:${config.classId}:answers`) || '{}');
}

function writeLocalAnswer(questionId, answer) {
  const answers = readLocalAnswers();
  answers[questionId] = answer;
  localStorage.setItem(`classpop:${config.classId}:answers`, JSON.stringify(answers));
}

function cleanup() {
  unsubscribe?.();
  unsubscribeTimeOffset?.();
  if (countdownInterval) window.clearInterval(countdownInterval);
}

function symbolFor(choice) {
  return { A: '▲', B: '◆', C: '●', D: '■' }[choice];
}
