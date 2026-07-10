import { OPTION_KEYS } from './config.js';
import { buildQuizSnapshot } from './quiz-store.js';
import { copyText, escapeHtml, formatStatus, setText } from './utils.js';
import {
  DEMO_CLASS_ID,
  DEMO_STUDENTS,
  appendDemoEvent,
  clearDemoEvents,
  createDemoQuestionId,
  readDemoEvents,
} from './demo-store.js';

const questionForm = document.querySelector('#question-form');
const demoStatus = document.querySelector('#demo-status');

let currentQuestionId = createDemoQuestionId();
let snapshot = buildQuizSnapshot(readDemoEvents(), DEMO_CLASS_ID);

init();

function init() {
  renderDemoLinks();
  fillSampleQuestion();

  questionForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitTeacherEvent('question_create', readQuestionForm());
  });
  document.querySelector('#open-question').addEventListener('click', () => submitTeacherEvent('question_open'));
  document.querySelector('#close-question').addEventListener('click', () => submitTeacherEvent('question_close'));
  document.querySelector('#reveal-answer').addEventListener('click', () => submitTeacherEvent('answer_reveal'));
  document.querySelector('#reset-question').addEventListener('click', () => submitTeacherEvent('question_reset'));
  document.querySelector('#next-question').addEventListener('click', nextQuestion);
  document.querySelector('#load-sample').addEventListener('click', fillSampleQuestion);
  document.querySelector('#reset-demo').addEventListener('click', () => {
    clearDemoEvents();
    currentQuestionId = createDemoQuestionId();
    questionForm.reset();
    fillSampleQuestion();
    sync();
    demoStatus.textContent = '展示資料已清空。';
  });

  window.addEventListener('storage', sync);
  setInterval(sync, 1000);
  sync();
}

function renderDemoLinks() {
  const links = [
    { label: '老師展示頁', url: new URL('demo.html', window.location.href).toString() },
    { label: '作答統計頁', url: new URL('demo-stats.html', window.location.href).toString() },
    ...DEMO_STUDENTS.map((student) => ({
      label: student.name,
      url: demoStudentUrl(student.id),
    })),
  ];

  document.querySelector('#demo-links').innerHTML = links.map((item) => `
    <div class="demo-link-row">
      <label>
        <span>${item.label}</span>
        <input value="${escapeHtml(item.url)}" readonly>
      </label>
      <a class="ghost-btn as-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">開啟</a>
      <button class="ghost-btn" type="button" data-copy="${escapeHtml(item.url)}">複製</button>
    </div>
  `).join('');

  document.querySelector('#demo-links').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button) return;
    await copyText(button.dataset.copy);
    demoStatus.textContent = '已複製展示連結。';
  });
}

function submitTeacherEvent(eventType, data = readCurrentQuestionData()) {
  if (!data.question_id) {
    demoStatus.textContent = '請先建立題目。';
    return;
  }

  appendDemoEvent({
    ...data,
    event_type: eventType,
  });
  demoStatus.textContent = '已寫入 localStorage 展示資料。';
  sync();
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
  const question = snapshot.question;
  if (!question.question_id) return readQuestionForm();
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

function sync() {
  snapshot = buildQuizSnapshot(readDemoEvents(), DEMO_CLASS_ID);
  renderSnapshot();
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
  currentQuestionId = createDemoQuestionId();
  questionForm.reset();
  fillSampleQuestion();
  demoStatus.textContent = '已準備下一題。';
}

function fillSampleQuestion() {
  questionForm.elements.namedItem('question_text').value = '下列哪一個欄位用來記錄學生答案？';
  questionForm.elements.namedItem('option_a').value = 'question_id';
  questionForm.elements.namedItem('option_b').value = 'answer';
  questionForm.elements.namedItem('option_c').value = 'client_timestamp';
  questionForm.elements.namedItem('option_d').value = 'extra_json';
  questionForm.elements.namedItem('correct_answer').value = 'B';
}

function demoStudentUrl(studentId) {
  const url = new URL('demo-student.html', window.location.href);
  url.searchParams.set('student', studentId);
  return url.toString();
}

function symbolFor(choice) {
  return { A: '▲', B: '◆', C: '●', D: '■' }[choice];
}
