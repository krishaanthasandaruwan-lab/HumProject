// "Learns your mouth": say B ×5 → K ×5 → ts ×5, with live per-hit feedback and a
// leave-one-out confidence meter. The 15 feature vectors become the personal k-NN profile.
import '../styles/calibrate.css';
import { setAudioSession, unlockAudio } from '../audio/context';
import { MicRecorder } from '../audio/recorder';
import { runDsp } from '../dsp/client';
import { buildProfile, looAccuracy, type Labeled, type Profile } from '../dsp/drumClassifier';
import type { DrumType } from '../model/project';
import { saveProfile } from '../profile';
import { navigate, type Params } from '../router';
import { h, toast } from './dom';

const SOUNDS: { type: DrumType; say: string; hint: string }[] = [
  { type: 'kick', say: 'B', hint: 'Your kick drum: a punchy lip “B”' },
  { type: 'snare', say: 'K', hint: 'Your snare: a sharp “K” or “Psh”' },
  { type: 'hat', say: 'ts', hint: 'Your hi-hat: a crisp “ts”' },
];
const CUES = 5;
const GAP = 0.8;
const LEAD_IN = 1.4;

export function mountCalibrate(root: HTMLElement, params: Params): () => void {
  const back = params.back || 'record';
  let samples: Labeled[] = [];
  let stage = 0;
  let alive = true;
  let mic: MicRecorder | null = null;
  let raf = 0;
  let testTimer = 0;

  const chips = SOUNDS.map((s) => h('span', null, s.say));
  const pad = h('div', { class: 'pad-big' });
  const dots = Array.from({ length: CUES }, () => h('i'));
  const info = h('p', { class: 'center muted' });
  const startBtn = h('button', { class: 'primary big wide', onClick: () => void runStage() });
  const meterBar = h('div');
  const meterLbl = h('span', { class: 'small muted' });
  const stagePanel = h('div', { class: 'card stack' }, pad, h('div', { class: 'hit-dots' }, dots), info, startBtn);
  const resultPanel = h('div', { class: 'card stack hidden' });

  root.append(
    h('header', { class: 'topbar' },
      h('button', { class: 'icon ghost', 'aria-label': 'Back', onClick: () => navigate(back) }, '←'),
      h('h1', null, 'Teach it your sounds')),
    h('p', { class: 'muted center small' }, 'Everyone beatboxes differently. Make each sound 5 times and MouthBand learns yours. Headphones help.'),
    h('div', { class: 'cal-steps' }, chips),
    stagePanel,
    h('div', { class: 'card stack' }, h('div', { class: 'row between' }, h('b', null, 'Confidence'), meterLbl), h('div', { class: 'meter' }, meterBar)),
    resultPanel,
  );
  showStage();
  updateMeter();

  function showStage(): void {
    const s = SOUNDS[stage];
    chips.forEach((c, i) => { c.className = i < stage ? 'done' : i === stage ? 'cur' : ''; });
    pad.className = `pad-big ${s.type}`;
    pad.textContent = s.say;
    dots.forEach((d) => { d.className = ''; });
    info.textContent = `${s.hint}. Tap start, then say “${s.say}” each time the circle flashes.`;
    startBtn.textContent = `Start — say “${s.say}” ×${CUES}`;
    startBtn.disabled = false;
  }

  function updateMeter(extra: Labeled[] = []): void {
    const all = [...samples, ...extra];
    if (new Set(all.map((s) => s.y)).size < 2) {
      meterBar.style.width = `${(all.length / (CUES * 3)) * 100}%`;
      meterLbl.textContent = `${all.length} of ${CUES * 3} sounds`;
      return;
    }
    const acc = looAccuracy(all);
    meterBar.style.width = `${Math.round(acc * 100)}%`;
    meterLbl.textContent = `${Math.round(acc * 100)}% — ${all.length} sounds`;
  }

  async function runStage(): Promise<void> {
    const s = SOUNDS[stage];
    const got: Labeled[] = [];
    startBtn.disabled = true;
    try {
      const ctx = await unlockAudio();
      setAudioSession('play-and-record');
      mic = await MicRecorder.open();
      mic.start();
      const m = mic;
      const t0 = ctx.currentTime;
      const cues = Array.from({ length: CUES }, (_, i) => t0 + LEAD_IN + i * GAP);
      const jobs: Promise<void>[] = [];
      const done = new Set<number>();
      await new Promise<void>((resolve) => {
        const loop = (): void => {
          if (!alive) return resolve();
          const now = ctx.currentTime;
          const on = cues.some((c) => now >= c && now < c + 0.18);
          pad.classList.toggle('cue', on);
          startBtn.textContent = now < cues[0] ? 'Get ready…' : `Say “${s.say}” on the flash`;
          cues.forEach((c, i) => {
            if (done.has(i) || now < c + 0.55) return;
            done.add(i);
            jobs.push(runDsp('calibration', { audio: m.extract(c - 0.35, c + 0.5), sampleRate: ctx.sampleRate, cues: [0.35] })
              .then(([hit]) => {
                if (hit) got.push({ x: hit.x, y: s.type });
                dots[i].classList.add(hit ? 'ok' : 'miss');
                updateMeter(got);
              })
              .catch(() => { dots[i].classList.add('miss'); }));
          });
          if (done.size === CUES) return resolve();
          raf = requestAnimationFrame(loop);
        };
        loop();
      });
      await Promise.all(jobs);
    } catch (err) {
      toast((err as Error).name === 'NotAllowedError' ? 'Microphone permission was denied.' : (err as Error).message);
    } finally {
      mic?.close();
      mic = null;
      setAudioSession('playback');
      pad.classList.remove('cue');
    }
    if (!alive) return;
    if (got.length >= 3) {
      samples = [...samples, ...got];
      stage++;
    } else {
      toast(`Only heard ${got.length} of ${CUES} — try again a bit louder.`);
    }
    updateMeter();
    if (stage < SOUNDS.length) showStage();
    else finish();
  }

  function finish(): void {
    const profile = buildProfile(samples);
    const acc = looAccuracy(samples);
    chips.forEach((c) => { c.className = 'done'; });
    stagePanel.classList.add('hidden');
    const verdict = acc >= 0.85 ? 'Great — your sounds are easy to tell apart.'
      : acc >= 0.65 ? 'Good. Making the three sounds more different will help.'
        : 'Your sounds are quite similar. Try a lower “B” and a sharper “ts”, then redo.';
    resultPanel.replaceChildren(
      h('div', { class: 'big-num' }, `${Math.round(acc * 100)}%`),
      h('p', { class: 'center' }, verdict),
      h('button', { class: 'primary big wide', onClick: () => void save(profile) }, 'Save & use my sounds'),
      h('button', { class: 'wide', onClick: () => redo() }, 'Start over'),
    );
    resultPanel.classList.remove('hidden');
  }

  function redo(): void {
    samples = [];
    stage = 0;
    resultPanel.classList.add('hidden');
    stagePanel.classList.remove('hidden');
    showStage();
    updateMeter();
  }

  async function save(profile: Profile): Promise<void> {
    await saveProfile(profile);
    toast('Saved — beatbox takes now use your sounds');
    showTester(profile);
  }

  function showTester(profile: Profile): void {
    const pads = SOUNDS.map((s) => h('div', { class: s.type }, s.say, h('small', null, s.type)));
    const status = h('p', { class: 'center small muted' }, 'Make any of your three sounds…');
    resultPanel.replaceChildren(
      h('h2', { class: 'center' }, 'Try it'),
      h('div', { class: 'test-pads' }, pads),
      status,
      h('button', { class: 'primary big wide', onClick: () => navigate(back) }, 'Done'),
    );
    void startTester(profile, pads, status);
  }

  async function startTester(profile: Profile, pads: HTMLElement[], status: HTMLElement): Promise<void> {
    try {
      const ctx = await unlockAudio();
      setAudioSession('play-and-record');
      mic = await MicRecorder.open();
      mic.start();
      const m = mic;
      let last = 0;
      let busy = false;
      testTimer = window.setInterval(() => {
        if (busy || !alive) return;
        busy = true;
        const end = ctx.currentTime - 0.03;
        const start = end - 1.2;
        runDsp('beatbox', { audio: m.extract(start, end), sampleRate: ctx.sampleRate, preroll: 0, bpm: 120, bars: 8, swing: 0, profile })
          .then(({ heard }) => {
            for (const hit of heard) {
              const at = start + hit.time;
              if (at <= last + 0.07 || hit.time > 1.2 - 0.08) continue;
              last = at;
              const el = pads[SOUNDS.findIndex((s) => s.type === hit.type)];
              el.classList.add('hit');
              setTimeout(() => el.classList.remove('hit'), 180);
              status.textContent = `Heard ${hit.type} · ${Math.round(hit.confidence * 100)}% sure`;
            }
          })
          .finally(() => { busy = false; });
      }, 250);
    } catch (err) {
      status.textContent = (err as Error).message;
    }
  }

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    clearInterval(testTimer);
    mic?.close();
    mic = null;
    setAudioSession('playback');
  };
}
