export const FIELD_KEYS = [
  'class_id',
  'event_type',
  'question_id',
  'question_text',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
  'answer',
  'student_session_id',
  'client_timestamp',
  'extra_json',
];

export const REQUIRED_FIELD_KEYS = FIELD_KEYS.filter((key) => key !== 'extra_json');

export const REQUIRED_PARAMS = [
  'class_id',
  'sheet_id',
  'form_url',
  ...REQUIRED_FIELD_KEYS.map((key) => `field_${key}`),
];

export const OPTION_KEYS = ['A', 'B', 'C', 'D'];

export const SYNC_INTERVAL_MS = 3000;
export const DEFAULT_SHEET_NAME = '表單回應 1';

export function generateId(prefix) {
  const random = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}_${Date.now().toString(36)}_${Array.from(random, (value) => value.toString(36)).join('')}`;
}

export function buildConfigFromParams(search = window.location.search) {
  const params = new URLSearchParams(search);
  const missing = REQUIRED_PARAMS.filter((key) => !clean(params.get(key)));

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const fields = {};
  for (const key of FIELD_KEYS) {
    fields[key] = clean(params.get(`field_${key}`));
  }

  return {
    ok: true,
    config: {
      classId: clean(params.get('class_id')),
      sheetId: clean(params.get('sheet_id')),
      sheetName: clean(params.get('sheet_name')) || DEFAULT_SHEET_NAME,
      gid: clean(params.get('gid')),
      formUrl: normalizeFormUrl(clean(params.get('form_url'))),
      fields,
    },
  };
}

export function buildPageUrl(pageName, values, baseHref = window.location.href) {
  const url = new URL(pageName, baseHref);
  url.search = '';

  for (const [key, value] of Object.entries(values)) {
    if (clean(value)) url.searchParams.set(key, clean(value));
  }

  return url.toString();
}

export function buildUrlValuesFromConfig(config) {
  const values = {
    class_id: config.classId,
    sheet_id: config.sheetId,
    sheet_name: config.sheetName,
    gid: config.gid,
    form_url: config.formUrl,
  };

  for (const key of FIELD_KEYS) {
    values[`field_${key}`] = config.fields[key] || '';
  }

  return values;
}

export function normalizeFormUrl(url) {
  if (!url) return '';
  return url.replace('/viewform', '/formResponse').replace('/edit', '/formResponse');
}

export function clean(value) {
  return String(value || '').trim();
}
