import { DEFAULT_TIMER_SECONDS, OPTION_KEYS } from './config.js';

const TEACHER_EVENTS = ['question_create', 'question_open', 'question_close', 'answer_reveal', 'question_reset'];

const STATUS_BY_EVENT = {
  question_create: 'created',
  question_open: 'open',
  question_close: 'closed',
  answer_reveal: 'revealed',
  question_reset: 'created',
};

export function buildQuizSnapshot(events, classId, selectedQuestionId = '') {
  const classEvents = sortEvents(events.filter((event) => event.class_id === classId && event.event_type !== 'class_reset'));
  const questions = buildQuestionSnapshotsFromClassEvents(classEvents);
  const selectedQuestion = selectedQuestionId
    ? questions.find((item) => item.question.question_id === selectedQuestionId)
    : null;
  const latestQuestion = questions.at(-1);
  const questionSnapshot = selectedQuestion || latestQuestion;
  const question = questionSnapshot?.question || buildQuestionState(null);
  const answers = buildAnswerStates(classEvents, question.question_id);
  const stats = buildStats(question, answers);

  return {
    events: classEvents,
    questions,
    question,
    answers,
    stats,
  };
}

export function buildQuestionSnapshots(events, classId) {
  const classEvents = sortEvents(events.filter((event) => event.class_id === classId && event.event_type !== 'class_reset'));
  return buildQuestionSnapshotsFromClassEvents(classEvents);
}

export function sortEvents(events) {
  return [...events].sort((a, b) => {
    const aTime = comparableTime(a);
    const bTime = comparableTime(b);
    if (aTime !== bTime) return aTime - bTime;
    return (a.row_index || 0) - (b.row_index || 0);
  });
}

function buildQuestionState(event) {
  if (!event) {
    return {
      class_id: '',
      question_id: '',
      status: 'waiting',
      question_text: '',
      options: { A: '', B: '', C: '', D: '' },
      correct_answer: '',
      timer_seconds: DEFAULT_TIMER_SECONDS,
      opened_at: 0,
      updated_at: '',
    };
  }

  const timerSeconds = normalizeTimerSeconds(event.timer_seconds);
  const openedAt = event.event_type === 'question_open'
    ? (Number(event.created_at) || Date.parse(event.client_timestamp || '') || 0)
    : 0;

  return {
    class_id: event.class_id,
    question_id: event.question_id,
    status: STATUS_BY_EVENT[event.event_type] || 'waiting',
    question_text: event.question_text,
    options: {
      A: event.option_a,
      B: event.option_b,
      C: event.option_c,
      D: event.option_d,
    },
    correct_answer: event.correct_answer,
    timer_seconds: timerSeconds,
    opened_at: openedAt,
    updated_at: event.client_timestamp || event.timestamp_server || '',
  };
}

function buildQuestionSnapshotsFromClassEvents(classEvents) {
  const latestTeacherEventByQuestion = new Map();
  const teacherEvents = classEvents.filter((event) => (
    TEACHER_EVENTS.includes(event.event_type)
    && event.question_id
  ));

  for (const event of teacherEvents) {
    latestTeacherEventByQuestion.set(event.question_id, event);
  }

  return [...latestTeacherEventByQuestion.values()].map((event) => {
    const question = buildQuestionState(event);
    const answers = buildAnswerStates(classEvents, question.question_id);
    return {
      question,
      answers,
      stats: buildStats(question, answers),
    };
  });
}

function buildAnswerStates(events, questionId) {
  if (!questionId) return [];

  const firstAnswers = new Map();
  const answerEvents = sortEvents(events).filter((event) => (
    event.event_type === 'answer_submit'
    && event.question_id === questionId
    && event.student_session_id
    && OPTION_KEYS.includes(event.answer)
  ));

  for (const event of answerEvents) {
    const key = `${event.question_id}:${event.student_session_id}`;
    if (firstAnswers.has(key)) continue;
    firstAnswers.set(key, {
      question_id: event.question_id,
      student_session_id: event.student_session_id,
      answer: event.answer,
      submitted_at: event.client_timestamp || event.timestamp_server || '',
    });
  }

  return [...firstAnswers.values()];
}

function buildStats(question, answers) {
  const counts = { A: 0, B: 0, C: 0, D: 0 };

  for (const answer of answers) {
    counts[answer.answer] += 1;
  }

  const total = answers.length;
  const correct = question.correct_answer ? counts[question.correct_answer] : 0;
  const wrong = Math.max(0, total - correct);

  return {
    question_id: question.question_id,
    total_answers: total,
    counts,
    correct_answer: question.correct_answer,
    correct_count: correct,
    wrong_count: wrong,
    correct_rate: total ? (correct / total) * 100 : 0,
  };
}

function normalizeTimerSeconds(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_TIMER_SECONDS;
  return Math.max(5, Math.min(300, Math.round(number)));
}

function comparableTime(event) {
  const serverTime = Number(event.created_at);
  if (Number.isFinite(serverTime) && serverTime > 0) return serverTime;
  const raw = event.client_timestamp || event.timestamp_server || '';
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}
