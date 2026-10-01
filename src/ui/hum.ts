// 02 · Mic (home): hum, sing or whistle — no metronome, no setup. MouthBand finds the beat and the key,
// then offers three full arrangements (choices.ts).
import '../styles/hum.css';
import { getCtx, setAudioSession, unlockAudio } from '../audio/context';
import { decodeAudioFile, pickAudioFile, sliceSeconds } from '../audio/importAudio';
import { MicRecorder } from '../audio/recorder';
import { runDsp } from '../dsp/client';
import { navigate } from '../router';
import { fill, h, sleep } from './dom';
import { icon, type IconName } from './icons';
import { art, link, mainBtn, mark, titleBlock } from './kit';
import { setHumTake } from './choices';
import { drawScope } from './waveform';

const MAX_SECONDS = 24;
const QUIET_STOP = 2.2; // stop by itself after this much quiet, once something was hummed
const LOUD = 0.012; // RMS that counts as humming

type State = 'ready' | 'listening' | 'thinking' | 'no-tune' | 'mic-off' | 'error';

export function mountHum(root: HTMLElement): () => void {
  let mic: MicRecorder | null = null;
  let startedAt = 0;
  let heard = 0;
  let quiet = 0;
  let last = 0;
  let raf = 0;
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
    tile('songs', 'Songs', () => navigate('projects', { back: 'hum' })));
  const stage = h('div', { class: 'hum-stage' }, timer, micBtn, status, canvas, thinking, problem);

  root.append(h('div', { class: 'screen hum' },
    h('header', { class: 'top' }, mark(), link('Skip', () => navigate('studio'))),
    titleBlock(['Hum a', 'melody'], { hl: 1 }),
    stage,
    tiles));
  show('ready');

  function show(s: State, text = ''): void {
    stage.dataset.state = s;
    tiles.classList.toggle('faded', s === 'listening' || s === 'thinking');
    micBtn.setAttribute('aria-label', s === 'listening' ? 'Done' : 'Start humming');
    status.textContent = text || ({ ready: 'Tap and hum', listening: 'Tap when done', thinking: 'Finding the beat…' } as Record<string, string>)[s] || '';
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
    if (stage.dataset.state === 'thinking') return;
    if (mic) return void finish();
    try {
      await unlockAudio();
      setAudioSession('play-and-record');
      mic = await MicRecorder.open();
      if (!alive) return void mic.close();
      mic.start();
      startedAt = last = getCtx().currentTime;
      heard = quiet = 0;
      show('listening');
      raf = requestAnimationFrame(frame);
    } catch (err) {
      const e = err as Error;
      mic = null;
      setAudioSession('playback');
      if (e.name === 'NotAllowedError') show('mic-off', 'Allow the microphone for MouthBand in Settings. Import still works.');
      else show('error', e.message);
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
    const level = Math.sqrt(s / scope.length);
    micBtn.style.setProperty('--level', Math.min(1, level * 14).toFixed(3));
    if (level > LOUD) {
      heard += dt;
      quiet = 0;
    } else quiet += dt;
    const t = now - startedAt;
    timer.textContent = `0:${String(Math.floor(t)).padStart(2, '0')}`;
    if ((heard > 1.5 && quiet > QUIET_STOP) || t > MAX_SECONDS) return void finish();
    raf = requestAnimationFrame(frame);
  }

  async function finish(): Promise<void> {
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
    await analyze(audio, getCtx().sampleRate);
  }

  async function importFile(): Promise<void> {
    if (mic || stage.dataset.state === 'thinking') return;
    const file = await pickAudioFile();
    if (!file || !alive) return;
    show('thinking', 'Opening your recording…');
    try {
      const { audio, sampleRate } = await decodeAudioFile(file);
      await analyze(audio, sampleRate);
    } catch (err) {
      show('error', (err as Error).message);
    }
  }

  async function analyze(audio: Float32Array, sampleRate: number): Promise<void> {
    show('thinking');
    try {
      const job = runDsp('free', { audio, sampleRate, kind: 'lead' });
      void sleep(1400).then(() => { if (alive && stage.dataset.state === 'thinking') status.textContent = 'Building your band…'; });
      const r = await job;
      if (!alive) return;
      if (r.notes.length < 2 || !r.key) {
        show('no-tune', r.voiced < 0.05 ? 'Hum a little louder, close to the phone.' : 'Hum steady notes with small breaks between them.');
        return;
      }
      const voice = sliceSeconds(audio, sampleRate, r.loopStart, r.loopEnd + 0.3);
      setHumTake({ notes: r.notes, bpm: r.bpm, bars: r.bars, key: r.key, voice: { audio: voice, rate: sampleRate, anchors: r.anchors } });
      navigator.vibrate?.(10);
      navigate('choices');
    } catch (err) {
      show('error', (err as Error).message);
    }
  }

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    if (mic) {
      mic.close();
      mic = null;
      setAudioSession('playback');
    }
  };
}
