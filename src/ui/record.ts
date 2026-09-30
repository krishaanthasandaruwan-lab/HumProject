// Record screen (Phase 1): tempo, bars, count-in, live waveform, playback.
import '../styles/record.css';
import { h, segmented, toast } from './dom';
import { getCtx, getMaster, outputLatency, unlockAudio } from '../audio/context';
import { captureTake, loopAudio, type Take } from '../audio/take';
import { phaseAt, type TakePlan } from '../audio/metronome';
import type { MicRecorder } from '../audio/recorder';
import { drawScope, drawWave } from './waveform';
import { settings, updateSettings } from '../settings';

const clampBpm = (v: number): number => Math.max(70, Math.min(140, Math.round(v)));

export function mountRecord(root: HTMLElement): () => void {
  let bpm = settings().lastBpm;
  let bars = settings().lastBars;
  let take: Take | null = null;
  let loop: Float32Array | null = null;
  let abort: AbortController | null = null;
  let plan: TakePlan | null = null;
  let mic: MicRecorder | null = null;
  let player: AudioBufferSourceNode | null = null;
  let playStart = 0;
  let raf = 0;
  const scope = new Float32Array(2048);

  const bpmVal = h('div', { class: 'val' }, `${bpm}`);
  const bpmSlider = h('input', { type: 'range', min: 70, max: 140, step: 1, value: String(bpm) });
  bpmSlider.addEventListener('input', () => setBpm(Number(bpmSlider.value)));
  function setBpm(v: number): void {
    bpm = clampBpm(v);
    bpmVal.textContent = `${bpm}`;
    bpmSlider.value = String(bpm);
    updateSettings({ lastBpm: bpm });
  }
  const barsSeg = segmented<2 | 4 | 8>(
    [{ value: 2, label: '2 bars' }, { value: 4, label: '4 bars' }, { value: 8, label: '8 bars' }],
    bars,
    (v) => {
      bars = v;
      barsSeg.set(v);
      updateSettings({ lastBars: v });
    },
  );

  const countin = h('div', { class: 'countin' });
  const status = h('div', { class: 'status muted' }, 'Tap REC. You get a 1-bar count-in, then sing or beatbox.');
  const dots = [0, 1, 2, 3].map((i) => h('i', { class: i === 0 ? 'down' : '' }));
  const bar = h('div');
  const canvas = h('canvas', { class: 'wave' });
  const recBtn = h('button', { class: 'recbtn', 'aria-label': 'Record', onClick: () => void toggleRecord() }, 'REC');
  const playBtn = h('button', { class: 'wide big', disabled: true, onClick: () => togglePlay() }, '▶  Play take');

  const latLabel = h('span', { class: 'small muted' });
  const latSlider = h('input', { type: 'range', min: -100, max: 300, step: 5, value: String(settings().latencyMs) });
  const updateLatLabel = (): void => {
    const auto = Math.round(outputLatency() * 1000);
    latLabel.textContent = `auto ${auto} ms + manual ${settings().latencyMs} ms`;
  };
  latSlider.addEventListener('input', () => {
    updateSettings({ latencyMs: Number(latSlider.value) });
    updateLatLabel();
  });
  const clickBox = h('input', { type: 'checkbox', checked: settings().clickDuringTake });
  clickBox.addEventListener('change', () => updateSettings({ clickDuringTake: clickBox.checked }));
  const settingsCard = h('div', { class: 'card stack hidden' },
    h('h2', null, 'Settings'),
    h('div', null, h('div', { class: 'row between' }, h('span', null, 'Latency correction'), latLabel), latSlider,
      h('p', { class: 'tiny muted' }, 'If your hits land late on the grid, drag right. Early? Drag left.')),
    h('label', { class: 'check' }, clickBox, 'Click while recording (use headphones)'),
  );

  root.append(
    h('header', { class: 'topbar' },
      h('h1', null, h('span', { class: 'brand' }, 'MouthBand')),
      h('button', { class: 'icon ghost', 'aria-label': 'Settings', onClick: () => { settingsCard.classList.toggle('hidden'); updateLatLabel(); } }, '⚙︎'),
    ),
    h('div', { class: 'card stack' },
      h('div', { class: 'row between' }, h('h2', null, 'Tempo'),
        h('div', { class: 'stepper' },
          h('button', { class: 'icon', 'aria-label': 'Slower', onClick: () => setBpm(bpm - 1) }, '−'),
          bpmVal,
          h('button', { class: 'icon', 'aria-label': 'Faster', onClick: () => setBpm(bpm + 1) }, '+'))),
      bpmSlider,
      barsSeg.el,
    ),
    settingsCard,
    h('div', { class: 'rec-stage' }, countin, h('div', { class: 'beats' }, dots), recBtn, status,
      h('div', { class: 'progress' }, bar), canvas),
    playBtn,
  );

  function frame(): void {
    const ctx = getCtx();
    if (mic && plan) {
      mic.analyser.getFloatTimeDomainData(scope);
      drawScope(canvas, scope);
      const p = phaseAt(plan, ctx.currentTime);
      if (p.phase === 'countin') {
        countin.textContent = String(p.beat + 1);
        dots.forEach((d, i) => d.classList.toggle('on', i === p.beat));
        status.textContent = 'Get ready…';
      } else if (p.phase === 'rec') {
        countin.textContent = '';
        dots.forEach((d, i) => d.classList.toggle('on', i === p.beat));
        status.textContent = `Recording · bar ${p.bar + 1} of ${bars}`;
        bar.style.width = `${(p.progress * 100).toFixed(1)}%`;
      } else if (p.phase === 'done') {
        status.textContent = 'Finishing…';
        dots.forEach((d) => d.classList.remove('on'));
      }
    } else if (loop) {
      const ph = player ? ((ctx.currentTime - playStart) * take!.sampleRate % loop.length) / loop.length : -1;
      drawWave(canvas, loop, '#9b7bff', ph);
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  async function toggleRecord(): Promise<void> {
    if (abort) {
      abort.abort();
      return;
    }
    stopPlay();
    abort = new AbortController();
    recBtn.classList.add('live');
    recBtn.textContent = 'STOP';
    bar.style.width = '0';
    try {
      take = await captureTake({
        bpm, bars,
        clickDuringTake: settings().clickDuringTake,
        manualLatencyMs: settings().latencyMs,
        signal: abort.signal,
        onPlan: (p, m) => { plan = p; mic = m; },
      });
      loop = loopAudio(take);
      status.textContent = `Got it — ${(loop.length / take.sampleRate).toFixed(1)} s. Tap play to hear it.`;
      playBtn.disabled = false;
    } catch (err) {
      const e = err as Error;
      status.textContent = e.name === 'AbortError' ? 'Cancelled.' : e.name === 'NotAllowedError' ? 'Microphone permission was denied.' : e.message;
      if (e.name !== 'AbortError') toast(status.textContent ?? 'Recording failed');
    } finally {
      abort = null;
      plan = null;
      mic = null;
      countin.textContent = '';
      dots.forEach((d) => d.classList.remove('on'));
      recBtn.classList.remove('live');
      recBtn.textContent = 'REC';
    }
  }

  function togglePlay(): void {
    if (player) {
      stopPlay();
      return;
    }
    if (!take || !loop) return;
    void unlockAudio();
    const ctx = getCtx();
    const buf = ctx.createBuffer(1, loop.length, take.sampleRate);
    buf.getChannelData(0).set(loop);
    player = ctx.createBufferSource();
    player.buffer = buf;
    player.loop = true;
    player.connect(getMaster());
    playStart = ctx.currentTime + 0.05;
    player.start(playStart);
    playBtn.textContent = '■  Stop';
  }

  function stopPlay(): void {
    if (!player) return;
    try {
      player.stop();
    } catch {
      /* not started */
    }
    player.disconnect();
    player = null;
    playBtn.textContent = '▶  Play take';
  }

  return () => {
    cancelAnimationFrame(raf);
    abort?.abort();
    stopPlay();
  };
}
