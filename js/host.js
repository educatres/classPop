import { OPTION_KEYS, buildConfigFromParams, buildPageUrl, buildUrlValuesFromConfig, generateId } from './config.js';
import {
  authorizeTeacher,
  deleteClass,
  deleteExpiredClass,
  fetchClassEvents,
  fetchClassMeta,
  hasTeacherSession,
  submitEvent,
  subscribeToClassEvents,
  subscribeToServerTimeOffset,
} from './firebase-store.js';
import { CountdownAudio, getCountdownState, updateCountdownElement } from './countdown-audio.js';
import { buildQuizSnapshot } from './quiz-store.js';
import { renderQr } from './qr.js';
import { copyText, escapeHtml, formatStatus, setText } from './utils.js';

const configResult = buildConfigFromParams();
const app = document.querySelector('#host-app');
const loginPanel = document.querySelector('#teacher-login');
const loginForm = document.querySelector('#teacher-login-form');
const loginStatus = document.querySelector('#teacher-login-status');
const errorPanel = document.querySelector('#config-error');
const questionForm = document.querySelector('#question-form');
const syncStatus = document.querySelector('#sync-status');
const countdownElement = document.querySelector('#host-countdown');
const soundToggle = document.querySelector('#sound-toggle');

let config = null;
let snapshot = null;
let currentQuestionId = generateId('q');
let unsubscribe = null;
let unsubscribeTimeOffset = null;
let serverTimeOffset = 0;
let hostInitialized = false;
let autoCloseKey = '';
let countdownInterval = null;
let soundEnabled = true;
const countdownAudio = new CountdownAudio(true);

init();

async function init() {
  if (!configResult.ok) {
    errorPanel.classList.remove('hidden');
    errorPanel.textContent = `系統設定不完整，請回到老師設定頁重新產生連結。缺少：${configResult.missing.join('、')}`;
    return;
  }

  config = configResult.config;
  snapshot = buildQuizSnapshot([], config.classId);
  setText('#login-class-id', config.classId);
  loginForm.addEventListener('submit', teacherLogin);

  try {
    await fetchClassMeta(config.classId);
    if (await hasTeacherSession(config.classId)) {
      await unlockHost();
    } else {
      loginPanel.classList.remove('hidden');
      document.querySelector('#teacher-pin-input').focus();
    }
  } catch (error) {
    showAccessError(error);
  }
}

async function teacherLogin(event) {
  event.preventDefault();
  const button = loginForm.querySelector('button[type="submit"]');
  const pin = String(new FormData(loginForm).get('teacher_pin') || '').trim();

  if (!/^\d{6}$/.test(pin)) {
    loginStatus.textContent = '請輸入 6 位數字密鑰。';
    return;
  }

  button.disabled = true;
  loginStatus.textContent = '正在驗證密鑰…';
  try {
    await authorizeTeacher(config.classId, pin);
    loginStatus.textContent = '驗證成功。';
    await unlockHost();
  } catch (error) {
    console.error(error);
    const message = String(error?.message || error || '');
    loginStatus.textContent = /permission_denied|permission denied/i.test(message)
      ? '密鑰不正確。若剛更新程式，也請確認已重新部署 database.rules.json。'
      : (message || '登入失敗。');
  } finally {
    button.disabled = false;
  }
}

async function unlockHost() {
  loginPanel.classList.add('hidden');
  app.classList.remove('hidden');
  if (hostInitialized) return;
  hostInitialized = true;

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
  document.querySelector('#manual-sync').addEventListener('click', manualSync);
  document.querySelector('#open-question').addEventListener('click', openQuestion);
  document.querySelector('#close-question').addEventListener('click', () => submitTeacherEvent('question_close'));
  document.querySelector('#reveal-answer').addEventListener('click', () => submitTeacherEvent('answer_reveal'));
  document.querySelector('#reset-question').addEventListener('click', () => submitTeacherEvent('question_reset'));
  document.querySelector('#next-question').addEventListener('click', nextQuestion);
  document.querySelector('#delete-class').addEventListener('click', deleteCurrentClass);
  soundToggle.addEventListener('click', toggleSound);
  questionForm.addEventListener('submit', createQuestion);

  renderSnapshot();
  countdownInterval = window.setInterval(updateHostCountdown, 100);

  try {
    unsubscribeTimeOffset = await subscribeToServerTimeOffset((offset) => {
      serverTimeOffset = offset;
      updateHostCountdown();
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

async function createQuestion(event) {
  event.preventDefault();
  await submitTeacherEvent('question_create', readQuestionForm());
}

async function openQuestion() {
  if (soundEnabled) await countdownAudio.ensureContext();
  const data = readCurrentQuestionData();
  data.timer_seconds = readTimerSeconds();
  autoCloseKey = '';
  await submitTeacherEvent('question_open', data);
}

async function submitTeacherEvent(eventType, data = readCurrentQuestionData()) {
  if (!data.question_id) {
    syncStatus.textContent = '請先建立題目。';
    return false;
  }

  try {
    await submitEvent(config, {
      ...data,
      event_type: eventType,
      student_session_id: '',
      answer: '',
      extra_json: '{}',
    });
    syncStatus.textContent = `已送出：${new Date().toLocaleTimeString()}`;
    return true;
  } catch (error) {
    syncStatus.textContent = `送出失敗：${friendlyFirebaseError(error)}`;
    return false;
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
    timer_seconds: readTimerSeconds(),
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
    timer_seconds: question.timer_seconds || readTimerSeconds(),
  };
}

function readTimerSeconds() {
  return Number(document.querySelector('#timer-seconds').value) || 30;
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
  syncStatus.textContent = friendlyFirebaseError(error);
}

function friendlyFirebaseError(error) {
  const message = String(error?.message || error || '');
  if (/permission_denied|permission denied/i.test(message)) {
    deleteExpiredClass(config?.classId).catch(() => {});
    return '權限不足：課程可能已到期、教師登入已失效，或 Firebase 規則尚未更新。';
  }
  return message || 'Firebase 連線失敗，請確認網路、匿名登入與資料庫設定。';
}

function showAccessError(error) {
  console.error(error);
  loginPanel.classList.add('hidden');
  const message = String(error?.message || error || '');
  errorPanel.classList.remove('hidden');
  errorPanel.textContent = /permission_denied|permission denied/i.test(message)
    ? '無法開啟此課程。課程可能已超過 3 天，或新版 Firebase 規則尚未部署。'
    : (message || '無法讀取課程。');
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

  updateHostCountdown();
}

function updateHostCountdown() {
  if (!snapshot) return;
  const state = getCountdownState(snapshot.question, Date.now() + serverTimeOffset);
  updateCountdownElement(countdownElement, state);
  if (!state.active) return;

  countdownAudio.tick(state.key, state.secondsRemaining);
  if (state.remainingMs <= 0 && autoCloseKey !== state.key) {
    autoCloseKey = state.key;
    syncStatus.textContent = '時間到，正在自動關閉作答…';
    submitTeacherEvent('question_close');
  }
}

async function toggleSound() {
  soundEnabled = !soundEnabled;
  await countdownAudio.setEnabled(soundEnabled);
  soundToggle.setAttribute('aria-pressed', String(soundEnabled));
  soundToggle.textContent = soundEnabled ? '🔊 節拍開啟' : '🔇 節拍關閉';
}

async function deleteCurrentClass() {
  const confirmed = window.confirm(`確定要刪除課程 ${config.classId}？\n\n題目與所有匿名作答資料都會立即刪除，且無法復原。`);
  if (!confirmed) return;

  const button = document.querySelector('#delete-class');
  button.disabled = true;
  syncStatus.textContent = '正在刪除課程…';
  try {
    await deleteClass(config.classId);
    cleanup();
    app.classList.add('hidden');
    errorPanel.classList.remove('hidden');
    errorPanel.classList.add('success-panel');
    errorPanel.textContent = `課程 ${config.classId} 已刪除。可關閉此頁或回到首頁建立新課程。`;
  } catch (error) {
    console.error(error);
    syncStatus.textContent = `刪除失敗：${friendlyFirebaseError(error)}`;
    button.disabled = false;
  }
}

function nextQuestion() {
  currentQuestionId = generateId('q');
  questionForm.reset();
  const defaultAnswer = questionForm.querySelector('input[name="correct_answer"][value="A"]');
  const timerSelect = document.querySelector('#timer-seconds');
  if (defaultAnswer) defaultAnswer.checked = true;
  if (timerSelect) timerSelect.value = '30';
  autoCloseKey = '';
  syncStatus.textContent = '已準備下一題，請輸入題目後按「建立題目」。';
}

function cleanup() {
  unsubscribe?.();
  unsubscribe = null;
  unsubscribeTimeOffset?.();
  unsubscribeTimeOffset = null;
  if (countdownInterval) window.clearInterval(countdownInterval);
  countdownInterval = null;
}

function symbolFor(choice) {
  return { A: '▲', B: '◆', C: '●', D: '■' }[choice];
}
