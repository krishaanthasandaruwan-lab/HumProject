// The first screen after the logo: hum (or sing, or whistle) a melody — no metronome, no setup.
// MouthBand finds the beat and the key, then offers three full arrangements (choices.ts).
import '../styles/hum.css';
import { getCtx, setAudioSession, unlockAudio } from '../audio/context';
import { decodeAudioFile, pickAudioFile, sliceSeconds } from '../audio/importAudio';
import { MicRecorder } from '../audio/recorder';
import { runDsp } from '../dsp/client';
import { navigate } from '../router';
import { h } from './dom';
import { setHumTake } from './choices';
import { drawScope } from './waveform';

const MAX_SECONDS = 24;
const QUIET_STOP = 2.2; // stop by itself after this much quiet, once something was hummed
const LOUD = 0.012; // RMS that counts as humming

export function mountHum(root: HTMLElement): () => void {
  let mic: MicRecorder | null = null;
  let startedAt = 0;
  let heard = 0;
  let quiet = 0;
  let last = 0;
  let raf = 0;
  let alive = true;
  let busy = false;
  const scope = new Float32Array(2048);

  const title = h('h1', { class: 'hum-title' }, 'Hum a melody');
  const sub = h('p', { class: 'muted hum-sub' }, 'Hum, sing or whistle anything. MouthBand finds the beat and the key and turns it into a full song.');
  const micBtn = h('button', { class: 'hum-mic', 'aria-label': 'Start humming', onClick: () => void toggle() }, h('span', null, '🎤'));
  const timer = h('div', { class: 'hum-timer' });
  const status = h('p', { class: 'hum-status muted' }, 'Tap the mic and hum. Tap again when you’re done.');
  const spinner = h('div', { class: 'spinner hidden' });
  const canvas = h('canvas', { class: 'wave hum-wave hidden' });
  const importBtn = h('button', { class: 'link', onClick: () => void importFile() }, '📂 Use a recording instead');

  root.append(h('div', { class: 'hum' },
    h('header', { class: 'row between' },
      h('span', { class: 'brand hum-brand' }, 'MouthBand'),
      h('button', { class: 'link', onClick: () => skip() }, 'Skip')),
    h('div', { class: 'hum-stage' }, title, sub, micBtn, timer, spinner, status, canvas),
    h('div', { class: 'center' }, importBtn)));

  function skip(): void {
    navigate('studio');
  }

  function setBusy(on: boolean, text = ''): void {
    busy = on;
    micBtn.classList.toggle('hidden', on);
    spinner.classList.toggle('hidden', !on);
    importBtn.disabled = on;
    if (text) status.textContent = text;
  }

  async function toggle(): Promise<void> {
    if (busy) return;
    if (mic) return void finish();
    try {
      await unlockAudio();
      setAudioSession('play-and-record');
      mic = await MicRecorder.open();
      if (!alive) return void mic.close();
      mic.start();
      startedAt = last = getCtx().currentTime;
      heard = quiet = 0;
      micBtn.classList.add('live');
      canvas.classList.remove('hidden');
      micBtn.setAttribute('aria-label', 'Done');
      status.textContent = 'Listening… tap when you’re done.';
      raf = requestAnimationFrame(frame);
    } catch (err) {
      const e = err as Error;
      mic = null;
      setAudioSession('playback');
      status.textContent = e.name === 'NotAllowedError' ? 'MouthBand needs the microphone to hear you. Allow it in Settings, or tap Skip.' : e.message;
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
    micBtn.style.setProperty('--lvl', Math.min(1, level * 12).toFixed(3));
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
    micBtn.classList.remove('live');
    micBtn.style.removeProperty('--lvl');
    canvas.classList.add('hidden');
    timer.textContent = '';
    const end = getCtx().currentTime;
    await m.stop();
    const audio = m.extract(startedAt, end);
    m.close();
    setAudioSession('playback');
    await analyze(audio, getCtx().sampleRate);
  }

  async function importFile(): Promise<void> {
    if (busy || mic) return;
    const file = await pickAudioFile();
    if (!file) return;
    setBusy(true, 'Opening your recording…');
    try {
      const { audio, sampleRate } = await decodeAudioFile(file);
      await analyze(audio, sampleRate);
    } catch (err) {
      setBusy(false, (err as Error).message);
    }
  }

  async function analyze(audio: Float32Array, sampleRate: number): Promise<void> {
    setBusy(true, 'Finding the beat and the key…');
    try {
      const r = await runDsp('free', { audio, sampleRate, kind: 'lead' });
      if (!alive) return;
      if (r.notes.length < 2 || !r.key) {
        setBusy(false, r.voiced < 0.05
          ? 'I didn’t hear any humming. Try again a little louder, close to the mic.'
          : 'I couldn’t find a clear tune. Hum steady notes with little breaks between them.');
        return;
      }
      const voice = sliceSeconds(audio, sampleRate, r.loopStart, r.loopEnd + 0.3);
      setHumTake({ notes: r.notes, bpm: r.bpm, bars: r.bars, key: r.key, voice: { audio: voice, rate: sampleRate, anchors: r.anchors } });
      navigate('choices');
    } catch (err) {
      setBusy(false, `Something went wrong: ${(err as Error).message}`);
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
