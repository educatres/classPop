import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  get,
  getDatabase,
  onValue,
  push,
  ref,
  serverTimestamp,
  set,
  update,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';
import { CLASS_LIFETIME_MS, DEFAULT_TIMER_SECONDS } from './config.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
let anonymousSignInPromise;

export async function ensureSignedIn() {
  if (auth.currentUser) return auth.currentUser;

  if (!anonymousSignInPromise) {
    anonymousSignInPromise = signInAnonymously(auth)
      .then((credential) => credential.user)
      .catch((error) => {
        throw new Error('無法完成 Firebase 匿名登入，請確認 Authentication 已啟用「匿名」登入方式。', { cause: error });
      })
      .finally(() => {
        anonymousSignInPromise = undefined;
      });
  }

  return anonymousSignInPromise;
}

export async function createClass(classId, teacherPin) {
  await ensureSignedIn();
  const normalizedPin = String(teacherPin || '').trim();
  if (!/^\d{6}$/.test(normalizedPin)) throw new Error('教師密鑰必須是 6 位數字。');

  await set(ref(database, `classes/${classId}`), {
    meta: {
      class_id: String(classId),
      created_at: serverTimestamp(),
    },
    private: {
      teacher_pin: normalizedPin,
    },
  });

  await set(ref(database, `classCatalog/${classId}`), {
    class_id: String(classId),
    created_at: serverTimestamp(),
  });
}

export async function fetchClassMeta(classId) {
  await ensureSignedIn();
  const snapshot = await get(ref(database, `classes/${classId}/meta`));
  return snapshot.val();
}

export async function authorizeTeacher(classId, teacherPin) {
  const user = await ensureSignedIn();
  const normalizedPin = String(teacherPin || '').trim();
  if (!/^\d{6}$/.test(normalizedPin)) throw new Error('請輸入 6 位數教師密鑰。');

  await set(ref(database, `classes/${classId}/teacherSessions/${user.uid}`), {
    pin: normalizedPin,
    authorized_at: serverTimestamp(),
  });
  return true;
}

export async function hasTeacherSession(classId) {
  const user = await ensureSignedIn();
  const snapshot = await get(ref(database, `classes/${classId}/teacherSessions/${user.uid}`));
  return snapshot.exists();
}

export async function submitEvent(config, event) {
  await ensureSignedIn();
  const eventRef = push(ref(database, `classes/${config.classId}/events`));
  const normalized = normalizeOutgoingEvent(config.classId, eventRef.key, event);
  await set(eventRef, normalized);
  return eventRef.key;
}

export async function fetchClassEvents(config) {
  await ensureSignedIn();
  const snapshot = await get(ref(database, `classes/${config.classId}/events`));
  return normalizeEventCollection(snapshot.val());
}

export async function subscribeToClassEvents(config, onEvents, onError) {
  await ensureSignedIn();
  return onValue(
    ref(database, `classes/${config.classId}/events`),
    (snapshot) => onEvents(normalizeEventCollection(snapshot.val())),
    onError,
  );
}

export async function subscribeToServerTimeOffset(onOffset, onError) {
  await ensureSignedIn();
  return onValue(
    ref(database, '.info/serverTimeOffset'),
    (snapshot) => onOffset(Number(snapshot.val()) || 0),
    onError,
  );
}

export async function subscribeToClassCatalog(onClasses, onError) {
  await ensureSignedIn();
  return onValue(
    ref(database, 'classCatalog'),
    (snapshot) => {
      const classes = Object.values(snapshot.val() || {});
      classes.sort((first, second) => Number(second.created_at) - Number(first.created_at));
      onClasses(classes);
    },
    onError,
  );
}

export async function deleteClass(classId) {
  await ensureSignedIn();
  await update(ref(database), {
    [`classes/${classId}`]: null,
    [`classCatalog/${classId}`]: null,
  });
}

export async function deleteExpiredClass(classId) {
  return deleteClass(classId);
}

export function isExpired(createdAt, now = Date.now()) {
  const value = Number(createdAt);
  return Number.isFinite(value) && value + CLASS_LIFETIME_MS <= now;
}

function normalizeOutgoingEvent(classId, eventId, event) {
  const requestedTimer = Number(event.timer_seconds);
  const timerSeconds = Number.isFinite(requestedTimer)
    ? Math.max(5, Math.min(300, Math.round(requestedTimer)))
    : DEFAULT_TIMER_SECONDS;

  return {
    event_id: eventId,
    class_id: String(classId),
    event_type: '',
    question_id: '',
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: '',
    answer: '',
    student_session_id: '',
    client_timestamp: new Date().toISOString(),
    extra_json: '{}',
    timer_seconds: timerSeconds,
    ...event,
    event_id: eventId,
    class_id: String(classId),
    timer_seconds: timerSeconds,
    created_at: serverTimestamp(),
    client_timestamp: event.client_timestamp || new Date().toISOString(),
  };
}

function normalizeEventCollection(value) {
  return Object.entries(value || {})
    .map(([firebaseId, event], index) => ({
      ...event,
      firebase_id: firebaseId,
      row_index: index,
    }))
    .sort((a, b) => {
      const aTime = Number(a.created_at) || Date.parse(a.client_timestamp || '') || 0;
      const bTime = Number(b.created_at) || Date.parse(b.client_timestamp || '') || 0;
      if (aTime !== bTime) return aTime - bTime;
      return String(a.firebase_id).localeCompare(String(b.firebase_id));
    })
    .map((event, index) => ({ ...event, row_index: index }));
}
