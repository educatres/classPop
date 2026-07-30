export class CountdownAudio {
  constructor(enabled = false) {
    this.enabled = enabled;
    this.context = null;
    this.lastKey = '';
    this.lastSecond = null;
    this.playedEnd = false;
  }

  async setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.enabled) {
      await this.ensureContext();
      this.playTone(660, 0.055, 0.03);
    }
  }

  async ensureContext() {
    if (!this.context) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return null;
      this.context = new AudioContextCtor();
    }
    if (this.context.state === 'suspended') await this.context.resume();
    return this.context;
  }

  reset(key) {
    if (this.lastKey === key) return;
    this.lastKey = key;
    this.lastSecond = null;
    this.playedEnd = false;
  }

  tick(key, secondsRemaining) {
    this.reset(key);
    if (!this.enabled) return;

    if (secondsRemaining <= 0) {
      if (!this.playedEnd) {
        this.playedEnd = true;
        this.playEnd();
      }
      return;
    }

    if (this.lastSecond === secondsRemaining) return;
    this.lastSecond = secondsRemaining;

    if (secondsRemaining <= 3) {
      this.playTone(880, 0.055, 0.045);
      window.setTimeout(() => this.playTone(1040, 0.045, 0.035), 105);
    } else if (secondsRemaining <= 5) {
      this.playTone(760, 0.06, 0.038);
    } else {
      this.playTone(520, 0.035, 0.02);
    }
  }

  submit() {
    if (!this.enabled) return;
    this.playTone(620, 0.055, 0.035);
    window.setTimeout(() => this.playTone(820, 0.075, 0.03), 80);
  }

  correct() {
    if (!this.enabled) return;
    this.playTone(660, 0.07, 0.03);
    window.setTimeout(() => this.playTone(880, 0.08, 0.03), 95);
    window.setTimeout(() => this.playTone(1100, 0.11, 0.025), 190);
  }

  wrong() {
    if (!this.enabled) return;
    this.playTone(330, 0.11, 0.03);
    window.setTimeout(() => this.playTone(260, 0.14, 0.025), 120);
  }

  playEnd() {
    this.playTone(330, 0.11, 0.04);
    window.setTimeout(() => this.playTone(220, 0.22, 0.035), 135);
  }

  playTone(frequency, duration, gainValue) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}

export function getCountdownState(question, now = Date.now()) {
  const durationSeconds = Number(question?.timer_seconds) || 30;
  const durationMs = durationSeconds * 1000;
  const openedAt = Number(question?.opened_at) || 0;
  if (!openedAt || question?.status !== 'open') {
    return {
      active: false,
      durationMs,
      remainingMs: durationMs,
      secondsRemaining: durationSeconds,
      progress: 1,
      key: '',
    };
  }

  const remainingMs = Math.max(0, openedAt + durationMs - now);
  return {
    active: true,
    durationMs,
    remainingMs,
    secondsRemaining: Math.max(0, Math.ceil(remainingMs / 1000)),
    progress: Math.max(0, Math.min(1, remainingMs / durationMs)),
    key: `${question.question_id}:${openedAt}`,
  };
}

export function updateCountdownElement(element, state) {
  if (!element) return;
  element.classList.toggle('hidden', !state.active);
  if (!state.active) return;

  const number = element.querySelector('[data-countdown-number]');
  const fill = element.querySelector('[data-countdown-fill]');
  if (number) number.textContent = String(state.secondsRemaining);
  if (fill) fill.style.transform = `scaleX(${state.progress})`;

  element.classList.toggle('countdown-warning', state.secondsRemaining <= 5 && state.secondsRemaining > 3);
  element.classList.toggle('countdown-urgent', state.secondsRemaining <= 3 && state.secondsRemaining > 0);
  element.classList.toggle('countdown-ended', state.secondsRemaining <= 0);
}
