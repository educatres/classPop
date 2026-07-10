const HEADER_ALIASES = {
  Timestamp: 'timestamp_server',
  '時間戳記': 'timestamp_server',
  class_id: 'class_id',
  event_type: 'event_type',
  question_id: 'question_id',
  question_text: 'question_text',
  option_a: 'option_a',
  option_b: 'option_b',
  option_c: 'option_c',
  option_d: 'option_d',
  correct_answer: 'correct_answer',
  answer: 'answer',
  student_session_id: 'student_session_id',
  client_timestamp: 'client_timestamp',
  extra_json: 'extra_json',
};

export async function fetchSheetEvents(config) {
  if (config.sheetName) {
    return fetchGvizRows(config.sheetId, config.sheetName);
  }

  if (config.gid) {
    return fetchCsvRows(config.sheetId, config.gid);
  }

  return fetchGvizRows(config.sheetId, '表單回應 1');
}

async function fetchGvizRows(sheetId, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) throw new Error('無法讀取 Google Sheet');

  const text = await response.text();
  const jsonText = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const data = JSON.parse(jsonText);
  const headers = data.table.cols.map((col) => normalizeHeader(col.label || col.id || ''));

  return data.table.rows.map((row, index) => {
    const record = { row_index: index };
    row.c.forEach((cell, cellIndex) => {
      const key = headers[cellIndex];
      if (!key) return;
      record[key] = cell?.f ?? cell?.v ?? '';
    });
    return normalizeEvent(record, index);
  });
}

async function fetchCsvRows(sheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) throw new Error('無法讀取 Google Sheet');

  const csv = await response.text();
  const rows = parseCsv(csv);
  const headers = (rows.shift() || []).map(normalizeHeader);

  return rows.map((row, index) => {
    const record = { row_index: index };
    row.forEach((value, cellIndex) => {
      const key = headers[cellIndex];
      if (!key) return;
      record[key] = value;
    });
    return normalizeEvent(record, index);
  });
}

function normalizeHeader(header) {
  const trimmed = String(header).trim();
  return HEADER_ALIASES[trimmed] || trimmed;
}

function normalizeEvent(record, index) {
  return {
    timestamp_server: stringValue(record.timestamp_server),
    class_id: stringValue(record.class_id),
    event_type: stringValue(record.event_type),
    question_id: stringValue(record.question_id),
    question_text: stringValue(record.question_text),
    option_a: stringValue(record.option_a),
    option_b: stringValue(record.option_b),
    option_c: stringValue(record.option_c),
    option_d: stringValue(record.option_d),
    correct_answer: choiceValue(record.correct_answer),
    answer: choiceValue(record.answer),
    student_session_id: stringValue(record.student_session_id),
    client_timestamp: stringValue(record.client_timestamp),
    extra_json: stringValue(record.extra_json),
    row_index: index,
  };
}

function stringValue(value) {
  return value == null ? '' : String(value).trim();
}

function choiceValue(value) {
  const choice = stringValue(value).toUpperCase();
  return ['A', 'B', 'C', 'D'].includes(choice) ? choice : '';
}

export function parseCsv(csv) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}
