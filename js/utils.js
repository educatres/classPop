export function setText(selector, text, root = document) {
  const element = root.querySelector(selector);
  if (element) element.textContent = text;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  }
}

export function formatStatus(status) {
  return {
    waiting: '等待題目',
    created: '題目已建立',
    open: '作答中',
    closed: '已截止',
    revealed: '已公布答案',
  }[status] || '等待題目';
}

export function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}
