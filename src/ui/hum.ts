// 02 · Mic (home): hum, sing or whistle — no metronome, no setup. HUMM finds the beat and the key,
// then offers three full arrangements (choices.ts).
import '../styles/hum.css';
import { getCtx, setAudioSession, unlockAudio } from '../audio/context';
import { decodeAudioFile, sliceSeconds } from '../audio/importAudio';
import { MicRecorder } from '../audio/recorder';
import { runDsp } from '../dsp/client';
import { boostQuiet, LevelGate } from '../dsp/level';
import { isPro } from '../pro/pro';
import { navigate } from '../router';
import { fill, h, sleep } from './dom';
import { icon, type IconName } from './icons';
import { art, link, mainBtn, mark, titleBlock } from './kit';
import { setHumTake } from './choices';
import { chooseImport } from './importSheet';
import { clock, limitSheet, maxSeconds } from './limits';
import { drawScope } from './waveform';

const MIN_SECONDS = 10; // a hum is at least this long: neither the mic button nor the quiet stops it sooner
const QUIET_STOP = 4; // after that, stops by itself after this much silence
const TOO_SHORT = `Hum at least ${MIN_SECONDS} seconds`;

type State = 'ready' | 'listening' | 'thinking' | 'no-tune' | 'mic-off' | 'error';

/** What HUMM can do, one line at a time under the mic while it waits. The first one stays longest. */
const HINTS = [
  'Tap the mic to start a new project',
  'Beatbox a beat. Get real drums.',
  'Record a street seller’s shout. Make it a song.',
  'Whistle, sing or hum. It all becomes music.',
  'Import a video. Its sound becomes a song.',
];
const HINT_MS = (i: number): number => (i === 0 ? 10_000 : 3400);

export function mountHum(root: HTMLElement): () => void {
  let mic: MicRecorder | null = null;
  let opening = false;
  let operation = new AbortController();
  let startedAt = 0;
  let heard = 0;
  let quiet = 0;
  let last = 0;
  let raf = 0;
  let gate = new LevelGate();
  let hint = 0;
  let hintTimer = 0;
  const nextHint = (): void => {
    hintTimer = window.setTimeout(() => {
      if (stage.dataset.state === 'ready') {
        hint = (hint + 1) % HINTS.length;
        status.classList.remove('hint-in');
        void status.offsetWidth; // restart the fade
        status.style.setProperty('--hint-ms', `${HINT_MS(hint)}ms`);
        status.textContent = HINTS[hint];
        status.classList.add('hint-in');
      }
      nextHint();
    }, HINT_MS(hint));
  };
  nextHint();
  let alive = true;
  const scope = new Float32Array(2048);

  const rings = [1, 2, 3].map((n) => h('i', { class: 'ring', style: `--n:${n}`, 'aria-hidden': 'true' }));
  const micBtn = h('button', { type: 'button', class: 'mic', id: 'hum-mic', 'aria-label': 'Start humming', onClick: () => void toggle() }, rings, icon('mic', 56));
  const timer = h('div', { class: 'hum-timer num', 'aria-hidden': 'true' });
  const status = h('p', { class: 'hum-status body', 'aria-live': 'polite' });
  const canvas = h('canvas', { class: 'hum-wave', 'aria-hidden': 'true' });
  const spinner = h('div', { class: 'spinner' });
  const thinking = h('div', { class: 'hum-think' }, art('ill-13-keytar', 0.85), spinner);
  const problem = h('div', { class: 'hum-problem' });
  const tile = (name: IconName, label: string, go: () => void): HTMLButtonElement =>
    h('button', { type: 'button', class: 'hum-tile', onClick: go }, icon(name, 24), h('span', { class: 'label' }, label));
  const tiles = h('nav', { class: 'hum-tiles', 'aria-label': 'More ways to start' },
    tile('import', 'Import', () => void importFile()),
    tile('songs', 'Songs', () => navigate('projects')));
  const stage = h('div', { class: 'hum-stage' }, timer, micBtn, status, canvas, thinking, problem);

  root.append(h('div', { class: 'screen hum' },
    h('header', { class: 'top' }, mark(), link('Existing projects', () => navigate('projects'))),
    titleBlock(['Hum a', 'melody'], { hl: 1 }),
    stage,
    tiles));
  show('ready');

  function show(s: State, text = ''): void {
    stage.dataset.state = s;
    tiles.classList.toggle('faded', s === 'listening' || s === 'thinking');
    micBtn.setAttribute('aria-label', s === 'listening' ? 'Keep humming' : 'Start humming');
    status.textContent = text || ({ ready: HINTS[hint], listening: TOO_SHORT, thinking: 'Finding the beat…' } as Record<string, string>)[s] || '';
    if (s === 'no-tune' || s === 'mic-off' || s === 'error') {
      const off = s === 'mic-off';
      fill(problem,
        s === 'error' ? null : art(off ? 'ill-04-mic-off' : 'ill-03-no-tune', 0.8),
        h('h2', { class: 'h3' }, off ? 'Mic is off' : s === 'error' ? 'Something went wrong' : 'Didn’t catch a tune'),
        h('p', { class: 'small muted' }, text),
        mainBtn(off ? 'Turn on' : 'Try again', () => { show('ready'); if (off) void toggle(); }, { icon: off ? 'mic' : 'again' }));
    }
  }

  async function toggle(): Promise<void> {
    if (opening || stage.dataset.state === 'thinking') return;
    if (mic) {
      if (getCtx().currentTime - startedAt < MIN_SECONDS) return void tooShort();
      return void finish();
    }
    opening = true;
    operation = new AbortController();
    const job = operation;
    micBtn.disabled = true;
    try {
      await unlockAudio();
      if (!alive || job.signal.aborted) return;
      setAudioSession('play-and-record');
      const opened = await MicRecorder.open(job.signal);
      if (!alive || job.signal.aborted) { opened.close(); return; }
      mic = opened;
      mic.start();
      startedAt = last = getCtx().currentTime;
      heard = quiet = 0;
      gate = new LevelGate();
      show('listening');
      raf = requestAnimationFrame(frame);
    } catch (err) {
      if (!alive || job.signal.aborted) return;
      const e = err as Error;
      mic = null;
      setAudioSession('playback');
      if (e.name === 'NotAllowedError') show('mic-off', 'Allow the microphone for HUMM in Settings. Import still works.');
      else show('error', e.message);
    } finally {
      opening = false;
      micBtn.disabled = false;
      if (!mic) setAudioSession('playback');
    }
  }

  function frame(): void {
    if (!mic) return;
    const now = getCtx().currentTime;
    const dt = now - last;
    last = now;
    mic.analyser.getFloatTimeDomainData(scope);
    drawScope(canvas, scope);
    let s = 0;
    for (let i = 0; i < scope.length; i++) s += scope[i] * scope[i];
    const { silent, meter } = gate.update(Math.sqrt(s / scope.length), dt);
    micBtn.style.setProperty('--level', meter.toFixed(3));
    // Soft humming is humming too: only real silence counts towards stopping by itself.
    if (!silent) {
      heard += dt;
      quiet = 0;
    } else quiet += dt;
    const t = now - startedAt;
    const max = maxSeconds();
    timer.textContent = isPro() ? clock(t) : `${clock(t)} / ${clock(max)}`;
    if (t >= max) return void finish(!isPro());
    if (t >= MIN_SECONDS && status.textContent === TOO_SHORT) {
      status.textContent = 'Tap when done';
      micBtn.setAttribute('aria-label', 'Done');
    }
    if (t >= MIN_SECONDS && heard > 1.5 && quiet > QUIET_STOP) return void finish();
    raf = requestAnimationFrame(frame);
  }

  /** Tapped before the minimum: keep listening and say why. */
  function tooShort(): void {
    navigator.vibrate?.([10, 60, 10]);
    status.classList.remove('nudge');
    void status.offsetWidth; // restart the shake
    status.classList.add('nudge');
  }

  async function finish(limited = false): Promise<void> {
    const signal = operation.signal;
    const m = mic;
    if (!m) return;
    mic = null;
    cancelAnimationFrame(raf);
    micBtn.style.removeProperty('--level');
    timer.textContent = '';
    navigator.vibrate?.(15);
    show('thinking');
    const end = getCtx().currentTime;
    await m.stop();
    const audio = m.extract(startedAt, end);
    m.close();
    setAudioSession('playback');
    if (!alive || signal.aborted) return;
    if (limited) await limitSheet();
    if (alive && !signal.aborted) await analyze(audio, getCtx().sampleRate, signal);
  }

  async function importFile(): Promise<void> {
    if (mic || opening || stage.dataset.state === 'thinking') return;
    operation = new AbortController();
    const signal = operation.signal;
    show('thinking', 'Choose a recording…');
    const file = await chooseImport(signal);
    if (!alive || signal.aborted) return;
    if (!file) { show('ready'); return; }
    show('thinking', 'Opening your recording…');
    try {
      const { audio, sampleRate, seconds } = await decodeAudioFile(file, maxSeconds(), signal);
      if (seconds > maxSeconds() + 0.5 && !isPro()) await limitSheet();
      if (alive && !signal.aborted) await analyze(audio, sampleRate, signal);
    } catch (err) {
      if (alive && !signal.aborted) show('error', (err as Error).message);
    }
  }

  async function analyze(heardAudio: Float32Array, sampleRate: number, signal: AbortSignal): Promise<void> {
    show('thinking');
    try {
      const audio = boostQuiet(heardAudio, sampleRate); // soft humming counts too
      const job = runDsp('free', { audio, sampleRate, kind: 'lead' }, { signal });
      void sleep(1400).then(() => { if (alive && stage.dataset.state === 'thinking') status.textContent = 'Building your band…'; });
      let r = await job;
      if (!alive || signal.aborted) return;
      // Soft, breathy or far from the phone: listen again, more sensitively, before giving up.
      if (r.notes.length < 4 || !r.key) {
        const again = await runDsp('free', { audio, sampleRate, kind: 'lead', sensitive: true }, { signal });
        if (!alive || signal.aborted) return;
        if (again.notes.length > r.notes.length && again.key) r = again;
      }
      if (r.notes.length < 2 || !r.key) {
        show('no-tune', r.voiced < 0.05 ? 'Hum a little louder, close to the phone.' : 'Hum steady notes with small breaks between them.');
        return;
      }
      const voice = sliceSeconds(audio, sampleRate, r.loopStart, r.loopEnd + 0.3);
      setHumTake({ notes: r.notes, bpm: r.bpm, bars: r.bars, key: r.key, voice: { audio: voice, rate: sampleRate, anchors: r.anchors } });
      navigator.vibrate?.(10);
      navigate('choices');
    } catch (err) {
      if (alive && !signal.aborted) show('error', (err as Error).message);
    }
  }

  const hidden = (): void => {
    if (document.visibilityState !== 'hidden' || (!opening && !mic && stage.dataset.state !== 'thinking')) return;
    operation.abort();
    mic?.close();
    mic = null;
    cancelAnimationFrame(raf);
    setAudioSession('playback');
    show('error', 'Recording interrupted. Keep HUMM open and try again.');
  };
  document.addEventListener('visibilitychange', hidden);

  return () => {
    alive = false;
    operation.abort();
    document.removeEventListener('visibilitychange', hidden);
    clearTimeout(hintTimer);
    cancelAnimationFrame(raf);
    if (mic) {
      mic.close();
      mic = null;
      setAudioSession('playback');
    }
  };
}
