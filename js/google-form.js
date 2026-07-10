import { FIELD_KEYS } from './config.js';

export async function submitEvent(config, event) {
  const formData = new FormData();
  const normalized = {
    class_id: config.classId,
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
    ...event,
  };

  normalized.client_timestamp = event.client_timestamp || new Date().toISOString();

  for (const key of FIELD_KEYS) {
    const entryId = config.fields[key];
    if (!entryId) continue;
    formData.append(entryId, normalized[key] || '');
  }

  await fetch(config.formUrl, {
    method: 'POST',
    mode: 'no-cors',
    body: formData,
  });
}
