import { OPTION_KEYS } from './config.js';
import { buildQuizSnapshot } from './quiz-store.js';
import { escapeHtml, formatStatus, setText } from './utils.js';
import { DEMO_CLASS_ID, appendDemoEvent, getDemoStudent, readDemoEvents } from './demo-store.js';

const student = getDemoStudent();
const syncStatus = document.querySelector('#sync-status');

let snapshot = buildQuizSnapshot(readDemoEvents(), DEMO_CLASS_ID);

init();

function init() {
  setText('#student-name', student.name);
  document.querySelector('#manual-sync').addEventListener('click', sync);
  window.addEventListener('storage', sync);
  setInterval(sync, 1000);
  sync();
}

function sync() {
  snapshot = buildQuizSnapshot(readDemoEvents(), DEMO_CLASS_ID);
  renderSnapshot();
  syncStatus.textContent = `已同步：${new Date().toLocaleTimeString()}`;
}

function renderSnapshot() {
  const question = snapshot.question;
  const myAnswer = findMyAnswer(question.question_id);
  const hasAnswered = Boolean(myAnswer);

  setText('#question-status', formatStatus(question.status));

  if (question.status === 'waiting') {
    renderMessage('等待老師開放題目', '目前尚未有題目。');
    return;
  }

  if (question.status === 'created') {
    renderQuestion(question, '');
    renderMessage('等待老師開放題目', '請看老師展示頁或稍候。', true);
    return;
  }

  if (question.status === 'open' && !hasAnswered) {
    renderQuestion(question, renderAnswerButtons(question));
    return;
  }

  if (question.status === 'closed' && !hasAnswered) {
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

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-answer]');
  if (!button) return;

  const question = snapshot.question;
  if (question.status !== 'open' || findMyAnswer(question.question_id)) return;

  appendDemoEvent({
    event_type: 'answer_submit',
    question_id: question.question_id,
    question_text: question.question_text,
    option_a: question.options.A,
    option_b: question.options.B,
    option_c: question.options.C,
    option_d: question.options.D,
    correct_answer: question.correct_answer,
    answer: button.dataset.answer,
    student_session_id: student.id,
  });
  sync();
});

function findMyAnswer(questionId) {
  return snapshot.answers.find((item) => (
    item.question_id === questionId
    && item.student_session_id === student.id
  ))?.answer || '';
}

function symbolFor(choice) {
  return { A: '▲', B: '◆', C: '●', D: '■' }[choice];
}
