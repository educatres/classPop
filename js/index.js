import {
  FIELD_KEYS,
  REQUIRED_FIELD_KEYS,
  buildPageUrl,
  clean,
  generateId,
  normalizeFormUrl,
} from './config.js';
import { renderQr } from './qr.js';
import { copyText } from './utils.js';

const STORAGE_KEY = 'classquiz:setup';
const form = document.querySelector('#setup-form');
const resultPanel = document.querySelector('#result-panel');
const hostLink = document.querySelector('#host-link');
const playLink = document.querySelector('#play-link');
const qrCode = document.querySelector('#qr-code');
const statusText = document.querySelector('#setup-status');
const entryGrid = document.querySelector('#entry-grid');
const prefillUrl = document.querySelector('#prefill-url');

let classId = generateId('class');

init();

function init() {
  renderFieldInputs();
  loadSavedSetup();

  document.querySelector('#reset-class-id').addEventListener('click', () => {
    classId = generateId('class');
    document.querySelector('#class-id').value = classId;
    statusText.textContent = '已產生新的 class_id。';
  });

  document.querySelector('#fill-markers').addEventListener('click', () => {
    prefillUrl.value = FIELD_KEYS.join('\n');
    statusText.textContent = '請到 Google Form 預填連結頁，把每題答案依序填成這些欄位名稱，再貼回預填連結。';
  });

  document.querySelector('#parse-prefill').addEventListener('click', () => {
    const result = parsePrefillUrl(prefillUrl.value);
    for (const [key, entryId] of Object.entries(result.fields)) {
      const input = form.elements.namedItem(`field_${key}`);
      if (input) input.value = entryId;
    }
    if (result.formUrl && !clean(form.elements.namedItem('form_url').value)) {
      form.elements.namedItem('form_url').value = result.formUrl;
    }
    statusText.textContent = result.missing.length
      ? `已帶入 ${Object.keys(result.fields).length} 個 entry ID，還缺：${result.missing.join('、')}。`
      : '已自動帶入全部 entry ID。';
  });

  document.querySelector('#copy-host').addEventListener('click', () => copyGenerated(hostLink.value, '已複製主持頁連結。'));
  document.querySelector('#copy-play').addEventListener('click', () => copyGenerated(playLink.value, '已複製學生作答連結。'));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    generateLinks();
  });
}

function renderFieldInputs() {
  entryGrid.innerHTML = FIELD_KEYS.map((key) => `
    <label>
      <span>${key}${REQUIRED_FIELD_KEYS.includes(key) ? ' <b>*</b>' : ''}</span>
      <input name="field_${key}" autocomplete="off" placeholder="entry.123456789">
    </label>
  `).join('');
}

function loadSavedSetup() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  classId = saved.class_id || classId;
  document.querySelector('#class-id').value = classId;

  for (const [key, value] of Object.entries(saved)) {
    const input = form.elements.namedItem(key);
    if (input) input.value = value;
  }
}

function generateLinks() {
  const values = readFormValues();
  const missing = [
    ...['class_id', 'sheet_id', 'form_url'].filter((key) => !values[key]),
    ...REQUIRED_FIELD_KEYS.map((key) => `field_${key}`).filter((key) => !values[key]),
  ];

  if (!values.sheet_name && !values.gid) missing.push('sheet_name 或 gid');

  if (missing.length > 0) {
    statusText.textContent = `設定不完整：${missing.join('、')}`;
    return;
  }

  const hostUrl = buildPageUrl('host.html', values);
  const studentUrl = buildPageUrl('play.html', values);
  hostLink.value = hostUrl;
  playLink.value = studentUrl;
  renderQr(qrCode, studentUrl, '學生作答 QR Code');
  resultPanel.classList.remove('hidden');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  statusText.textContent = '連結已產生，設定也已儲存在這台電腦。';
}

function readFormValues() {
  const formData = new FormData(form);
  const values = {
    class_id: clean(formData.get('class_id')) || classId,
    sheet_id: clean(formData.get('sheet_id')),
    sheet_name: clean(formData.get('sheet_name')),
    gid: clean(formData.get('gid')),
    form_url: normalizeFormUrl(clean(formData.get('form_url'))),
  };

  for (const key of FIELD_KEYS) {
    values[`field_${key}`] = clean(formData.get(`field_${key}`));
  }

  return values;
}

function parsePrefillUrl(rawUrl) {
  const fields = {};
  const missing = [];

  try {
    const url = new URL(clean(rawUrl));
    const formUrl = normalizeFormUrl(`${url.origin}${url.pathname}`);

    for (const [paramKey, paramValue] of url.searchParams.entries()) {
      if (!paramKey.startsWith('entry.')) continue;
      const matchedKey = FIELD_KEYS.find((key) => normalizeMarker(key) === normalizeMarker(paramValue));
      if (matchedKey) fields[matchedKey] = paramKey;
    }

    for (const key of FIELD_KEYS) {
      if (!fields[key]) missing.push(key);
    }

    return { fields, missing, formUrl };
  } catch {
    return { fields, missing: [...FIELD_KEYS], formUrl: '' };
  }
}

async function copyGenerated(value, successMessage) {
  if (!value) return;
  await copyText(value);
  statusText.textContent = successMessage;
}

function normalizeMarker(value) {
  return clean(value).toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
}
