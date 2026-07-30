import { CLASS_LIFETIME_MS, buildPageUrl, generateClassId, generateTeacherPin } from './config.js';
import { createClass, deleteExpiredClass, isExpired, subscribeToClassCatalog } from './firebase-store.js';
import { renderQr } from './qr.js';
import { copyText } from './utils.js';

const form = document.querySelector('#setup-form');
const classIdInput = document.querySelector('#class-id');
const teacherPinInput = document.querySelector('#teacher-pin');
const firebasePath = document.querySelector('#firebase-path');
const resultPanel = document.querySelector('#result-panel');
const hostLink = document.querySelector('#host-link');
const playLink = document.querySelector('#play-link');
const statsLink = document.querySelector('#stats-link');
const qrCode = document.querySelector('#qr-code');
const statusText = document.querySelector('#setup-status');
const expireNote = document.querySelector('#expire-note');
const directoryToggle = document.querySelector('#class-directory-toggle');
const directoryPanel = document.querySelector('#class-directory-panel');
const directoryClose = document.querySelector('#class-directory-close');
const directoryStatus = document.querySelector('#class-directory-status');
const directoryList = document.querySelector('#class-directory-list');

let classId = generateClassId();
let teacherPin = generateTeacherPin();
let latestClasses = [];
const attemptedExpiredCleanup = new Set();

init();

function init() {
  renderCredentials();

  document.querySelector('#reset-class-id').addEventListener('click', () => {
    classId = generateClassId();
    teacherPin = generateTeacherPin();
    renderCredentials();
    statusText.textContent = '已產生新的課程 ID 與教師密鑰。';
    resultPanel.classList.add('hidden');
  });

  document.querySelector('#copy-teacher-pin').addEventListener('click', async () => {
    await copyText(teacherPin);
    statusText.textContent = '已複製教師六位數密鑰。';
  });
  document.querySelector('#copy-host').addEventListener('click', () => copyGenerated(hostLink.value, '已複製主持頁連結。'));
  document.querySelector('#copy-play').addEventListener('click', () => copyGenerated(playLink.value, '已複製學生作答連結。'));
  document.querySelector('#copy-stats').addEventListener('click', () => copyGenerated(statsLink.value, '已複製作答統計連結。'));

  form.addEventListener('submit', createFirebaseClass);
  directoryToggle.addEventListener('click', () => setDirectoryOpen(directoryPanel.classList.contains('hidden')));
  directoryClose.addEventListener('click', () => setDirectoryOpen(false));

  subscribeToClassCatalog((classes) => {
    latestClasses = classes;
    renderDirectory();
    cleanupExpiredClasses(classes);
  }, (error) => {
    console.error(error);
    directoryStatus.textContent = '無法讀取 Firebase 課程清單，請確認匿名登入與資料庫規則。';
  }).catch((error) => {
    console.error(error);
    directoryStatus.textContent = error.message || 'Firebase 初始化失敗。';
  });
}

async function createFirebaseClass(event) {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  statusText.textContent = '正在建立 Firebase 課程…';

  try {
    await createClass(classId, teacherPin);
    const values = { class_id: classId };
    const hostUrl = buildPageUrl('host.html', values);
    const studentUrl = buildPageUrl('play.html', values);
    const statsUrl = buildPageUrl('stats.html', values);

    hostLink.value = hostUrl;
    playLink.value = studentUrl;
    statsLink.value = statsUrl;
    renderQr(qrCode, studentUrl, '學生作答 QR Code');
    resultPanel.classList.remove('hidden');
    expireNote.textContent = `本課程約於 ${new Date(Date.now() + CLASS_LIFETIME_MS).toLocaleString()} 到期`;
    statusText.textContent = `課程已建立。教師密鑰：${teacherPin}（請妥善保存）`;
  } catch (error) {
    console.error(error);
    statusText.textContent = error.message || '建立課程失敗，請確認 Firebase 設定。';
  } finally {
    submitButton.disabled = false;
  }
}

function renderCredentials() {
  classIdInput.value = classId;
  teacherPinInput.value = teacherPin;
  firebasePath.textContent = `classes/${classId}`;
}

function setDirectoryOpen(open) {
  directoryPanel.classList.toggle('hidden', !open);
  directoryToggle.setAttribute('aria-expanded', String(open));
  if (open) renderDirectory();
}

function renderDirectory() {
  directoryList.replaceChildren();

  if (latestClasses.length === 0) {
    directoryStatus.textContent = '目前沒有課程。';
    return;
  }

  directoryStatus.textContent = `共 ${latestClasses.length} 個課程節點；此入口僅供除錯。`;
  for (const item of latestClasses) {
    const createdAt = Number(item.created_at);
    const remaining = createdAt + CLASS_LIFETIME_MS - Date.now();
    const li = document.createElement('li');
    const id = document.createElement('strong');
    const path = document.createElement('code');
    const meta = document.createElement('span');

    id.textContent = item.class_id;
    path.textContent = `classes/${item.class_id}`;
    meta.textContent = Number.isFinite(remaining)
      ? (remaining > 0 ? `剩餘 ${formatRemainingTime(remaining)}` : '已到期，等待清除')
      : '建立時間同步中';
    li.append(id, path, meta);
    directoryList.append(li);
  }
}

function cleanupExpiredClasses(classes) {
  for (const item of classes) {
    if (!isExpired(item.created_at) || attemptedExpiredCleanup.has(item.class_id)) continue;
    attemptedExpiredCleanup.add(item.class_id);
    deleteExpiredClass(item.class_id).catch((error) => {
      console.error('清除過期課程失敗', item.class_id, error);
      attemptedExpiredCleanup.delete(item.class_id);
    });
  }
}

async function copyGenerated(value, successMessage) {
  if (!value) return;
  await copyText(value);
  statusText.textContent = successMessage;
}

function formatRemainingTime(milliseconds) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return `${days} 天 ${hours} 小時 ${minutes} 分`;
}
