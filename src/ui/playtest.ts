/**
 * The playtest build.
 *
 * Phase 7's gate (docs/13 §4) is six things a stranger has to do or say, and
 * none of them has ever been observed (docs/31). This is the instrument that
 * makes a session cheap to run without an observer in the room: the game
 * writes down what it can see for itself, asks the tester the questions only
 * they can answer, and hands back one block of plain text to paste.
 *
 * It is off unless the link carries `?playtest=1`, and it stays on for that
 * browser until `?playtest=0`. A normal player never sees any of it.
 *
 * The recorder only listens. It never touches the simulation, so a playtest
 * session plays exactly the game everybody else plays.
 */
import type { EventBus } from '../core/events';
import type { SimEvents } from '../sim/events';

const FLAG = 'underwatch.playtest';

/** Whether this browser is a playtest build. The query string wins, and is remembered. */
export function playtestEnabled(search: string, store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null): boolean {
  const q = new URLSearchParams(search).get('playtest');
  try {
    if (q === '1') store?.setItem(FLAG, '1');
    if (q === '0') store?.removeItem(FLAG);
    return q === '1' || (q !== '0' && store?.getItem(FLAG) === '1');
  } catch {
    return q === '1';
  }
}

/** A clean line: this long, at least this fast, without coming off. */
export const CLEAN_LINE = { seconds: 15, speed: 4 };
/** A throw counts as on the move at or above this board speed. */
export const MOVING_THROW = 2.5;
const CAMERA_HITS = new Set(['cameraLens', 'cameraMount', 'cameraMotor']);
const LEVELS = ['PASSIVE', 'MONITORING', 'DRONE_DISPATCH', 'PATROL_DISPATCH', 'INTERVENTION'];

/** The questions only the tester can answer, each tied to a criterion. */
export const QUESTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'knew', label: 'Did the town ever seem to know where you were going before you got there? When?' },
  { id: 'route', label: 'Did you ever pick a way through because you remembered where the cameras were?' },
  { id: 'peel', label: 'What did you think when the town peeled back and showed its labels?' },
  { id: 'reprise', label: 'How did the advertisement feel the second time?' },
  { id: 'stuck', label: 'Where were you stuck, lost or bored?' },
];

export interface PlaytestStats {
  played: number;
  firstCleanLine: number | null;
  bails: number;
  throws: number;
  cameraHits: number;
  cameraHitsMoving: number;
  firstCameraHit: number | null;
  firstMovingCameraHit: number | null;
  visionAt: number | null;
  peels: number;
  plans: { committed: number; held: number; blown: number };
  peak: string;
  interventions: number;
  repriseAt: number | null;
  ending: string | null;
  beats: Array<{ at: number; label: string }>;
}

export class PlaytestRecorder {
  private t = 0;
  private run = 0;
  private speed = 0;
  private lastThrowMoving = false;
  readonly stats: PlaytestStats = {
    played: 0, firstCleanLine: null, bails: 0, throws: 0,
    cameraHits: 0, cameraHitsMoving: 0, firstCameraHit: null, firstMovingCameraHit: null,
    visionAt: null, peels: 0, plans: { committed: 0, held: 0, blown: 0 },
    peak: 'PASSIVE', interventions: 0, repriseAt: null, ending: null, beats: [],
  };

  bind(bus: EventBus<SimEvents>): void {
    const s = this.stats;
    bus.on('player:bail', () => { s.bails++; this.run = 0; });
    bus.on('player:fire', () => { s.throws++; this.lastThrowMoving = this.speed >= MOVING_THROW; });
    bus.on('projectile:impact', ({ kind }) => {
      if (!CAMERA_HITS.has(kind)) return;
      s.cameraHits++;
      s.firstCameraHit ??= this.t;
      if (this.lastThrowMoving) { s.cameraHitsMoving++; s.firstMovingCameraHit ??= this.t; }
    });
    bus.on('vision:unlocked', () => { s.visionAt ??= this.t; });
    bus.on('veneer:crack', () => { s.peels++; });
    bus.on('plan:committed', () => { s.plans.committed++; });
    bus.on('plan:held', () => { s.plans.held++; });
    bus.on('plan:blown', () => { s.plans.blown++; });
    bus.on('escalation:changed', ({ to }) => {
      if (LEVELS.indexOf(to) > LEVELS.indexOf(s.peak)) s.peak = to;
      if (to === 'INTERVENTION') s.interventions++;
    });
    bus.on('story:beat', ({ label }) => { if (label) s.beats.push({ at: this.t, label }); });
  }

  /** Once a frame while the town is being played (not paused, not in an advertisement). */
  sample(dt: number, speed: number): void {
    this.t += dt;
    this.stats.played = this.t;
    this.speed = speed;
    this.run = speed >= CLEAN_LINE.speed ? this.run + dt : 0;
    if (this.run >= CLEAN_LINE.seconds) this.stats.firstCleanLine ??= this.t - CLEAN_LINE.seconds;
  }

  reprise(): void { this.stats.repriseAt ??= this.t; }
  ended(id: string): void { this.stats.ending = id; }

  /** The whole session as plain text, ready to paste into a message. */
  report(answers: Record<string, string>, device: string): string {
    const s = this.stats;
    const yes = (ok: boolean) => (ok ? 'YES' : 'not yet');
    const at = (t: number | null) => (t === null ? 'never' : `at ${clock(t)}`);
    const lines = [
      'UNDERWATCH PLAYTEST REPORT',
      `device: ${device}`,
      `played: ${clock(s.played)}`,
      '',
      'SEEN BY THE GAME',
      `1. clean line inside 4:00: ${yes(s.firstCleanLine !== null && s.firstCleanLine <= 240)} (first ${at(s.firstCleanLine)}, bails ${s.bails})`,
      `2. sling into a camera on the move: ${yes(s.cameraHitsMoving > 0)} (camera hits ${s.cameraHits}, on the move ${s.cameraHitsMoving}, first ${at(s.firstCameraHit)}, throws ${s.throws})`,
      `5. VISION unlocked ${at(s.visionAt)}, peels ${s.peels}`,
      `6. reprise reached: ${yes(s.repriseAt !== null)} (${at(s.repriseAt)}, ending ${s.ending ?? 'none'})`,
      `plans: committed ${s.plans.committed}, held ${s.plans.held}, blown ${s.plans.blown}`,
      `highest escalation: ${s.peak}, interventions ${s.interventions}`,
      `beats: ${s.beats.map((b) => `${clock(b.at)} ${b.label}`).join(' | ') || 'none'}`,
      '',
      'FROM THE TESTER',
      ...QUESTIONS.map((q) => `${q.label}\n> ${(answers[q.id] ?? '').trim() || '(no answer)'}`),
    ];
    return lines.join('\n');
  }
}

export function clock(s: number | null): string {
  if (s === null) return 'never';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** The sheet a tester fills in and copies. Opened from the pause menu and the ending. */
export class PlaytestSheet {
  private el: HTMLElement;
  private answers: Record<string, string> = {};
  open = false;

  constructor(host: HTMLElement, private rec: PlaytestRecorder, private device: string, private onClose: () => void) {
    this.el = document.createElement('div');
    this.el.id = 'playtest';
    this.el.className = 'hidden';
    host.appendChild(this.el);
    this.el.addEventListener('input', (e) => {
      const t = e.target as HTMLTextAreaElement;
      if (t.dataset.q) this.answers[t.dataset.q] = t.value;
    });
    // Typing an answer is typing, not skating: keep the letters away from the
    // game's own key handlers on the window. Escape still closes the sheet.
    this.el.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA' && e.code !== 'Escape') e.stopPropagation();
    });
    this.el.addEventListener('keyup', (e) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') e.stopPropagation();
    });
    this.el.addEventListener('click', (e) => {
      const act = ((e.target as HTMLElement).closest('[data-act]') as HTMLElement | null)?.dataset.act;
      if (act === 'close') this.hide();
      if (act === 'copy') void this.copy();
    });
  }

  show(): void {
    const report = this.rec.report(this.answers, this.device);
    const seen = report.split('\n\nFROM THE TESTER')[0].split('\n').slice(4);
    this.el.innerHTML = `
      <div class="end-card pt-card" role="dialog" aria-modal="true" aria-labelledby="pt-title">
        <div class="end-kicker">Playtest</div>
        <h2 id="pt-title">How did it go?</h2>
        <p class="pt-lede">Answer in your own words, then copy the report and send it back. Short answers are fine.</p>
        ${QUESTIONS.map((q) => `
          <label class="pt-q"><span>${q.label}</span>
            <textarea data-q="${q.id}" rows="2">${esc(this.answers[q.id] ?? '')}</textarea></label>`).join('')}
        <details class="pt-seen"><summary>What the game noticed</summary><pre>${esc(seen.join('\n'))}</pre></details>
        <div class="end-actions">
          <span class="pt-status" role="status" aria-live="polite"></span>
          <button data-act="close">Back</button>
          <button data-act="copy" class="primary">Copy report</button>
        </div>
      </div>`;
    this.open = true;
    this.el.classList.remove('hidden');
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('hidden');
    this.onClose();
  }

  key(code: string): boolean {
    if (!this.open) return false;
    if (code === 'Escape') this.hide();
    return true;
  }

  private async copy(): Promise<void> {
    const text = this.rec.report(this.answers, this.device);
    const status = this.el.querySelector('.pt-status');
    try {
      await navigator.clipboard.writeText(text);
      if (status) status.textContent = 'Copied. Paste it into a message.';
    } catch {
      // No clipboard (an insecure origin, or a browser that refused): show
      // the text selected, so a long press or Ctrl+C still gets it.
      const pre = this.el.querySelector('.pt-seen pre');
      const details = this.el.querySelector('.pt-seen') as HTMLDetailsElement | null;
      if (pre && details) {
        pre.textContent = text;
        details.open = true;
        const r = document.createRange(); r.selectNodeContents(pre);
        const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r);
      }
      if (status) status.textContent = 'Selected. Copy it by hand.';
    }
  }
}
