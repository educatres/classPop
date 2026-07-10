import { generateId } from './config.js';

export const DEMO_CLASS_ID = 'demo_class';
export const DEMO_STORAGE_KEY = 'classquiz:demo:events';
export const DEMO_STUDENTS = [
  { id: 'demo_student_1', name: '學生 1' },
  { id: 'demo_student_2', name: '學生 2' },
  { id: 'demo_student_3', name: '學生 3' },
];

export function readDemoEvents() {
  return JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || '[]');
}

export function writeDemoEvents(events) {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(events));
}

export function appendDemoEvent(event) {
  const events = readDemoEvents();
  events.push({
    timestamp_server: '',
    class_id: DEMO_CLASS_ID,
    question_id: '',
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: '',
    answer: '',
    student_session_id: '',
    extra_json: '{}',
    ...event,
    client_timestamp: event.client_timestamp || new Date().toISOString(),
    row_index: events.length,
  });
  writeDemoEvents(events);
}

export function clearDemoEvents() {
  localStorage.removeItem(DEMO_STORAGE_KEY);
}

export function createDemoQuestionId() {
  return generateId('demo_q');
}

export function getDemoStudent() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('student') || DEMO_STUDENTS[0].id;
  return DEMO_STUDENTS.find((student) => student.id === requested) || DEMO_STUDENTS[0];
}
