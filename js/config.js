export const REQUIRED_PARAMS = ['class_id'];
export const OPTION_KEYS = ['A', 'B', 'C', 'D'];
export const CLASS_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;
export const DEFAULT_TIMER_SECONDS = 30;

export function generateId(prefix) {
  const random = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}_${Date.now().toString(36)}_${Array.from(random, (value) => value.toString(36)).join('')}`;
}

export function generateClassId() {
  const random = crypto.getRandomValues(new Uint32Array(2));
  const digits = `${random[0]}${random[1]}`.slice(0, 12).padEnd(12, '0');
  return `c${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
}

export function generateTeacherPin() {
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(random).padStart(6, '0');
}

export function buildConfigFromParams(search = window.location.search) {
  const params = new URLSearchParams(search);
  const missing = REQUIRED_PARAMS.filter((key) => !clean(params.get(key)));

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    config: {
      classId: clean(params.get('class_id')),
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
  return { class_id: config.classId };
}

export function clean(value) {
  return String(value || '').trim();
}
