// Record screen: count-in, capture your voice, then turn it into a track.
import '../styles/record.css';
import { getCtx } from '../audio/context';
import { phaseAt, type TakePlan } from '../audio/metronome';
import type { MicRecorder } from '../audio/recorder';
import { Player } from '../audio/scheduler';
import { captureTake, loopAudio, type Take } from '../audio/take';
import { runDsp } from '../dsp/client';
import { refreshKey } from '../model/music';
import { getTrack, newTrack, putTrack, type Project, type Track, type TrackKind } from '../model/project';
import { getProfile } from '../profile';
import { navigate, type Params } from '../router';
import { settings, updateSettings } from '../settings';
import { edit, getProject } from '../state';
import { h, segmented, toast } from './dom';
import { drawScope } from './waveform';

const clampBpm = (v: number): number => Math.max(70, Math.min(140, Math.round(v)));
const hasContent = (t: Track): boolean => (t.hits?.length ?? 0) + (t.notes?.length ?? 0) > 0;

export function mountRecord(root: HTMLElement, params: Params): () => void {
  let kind: TrackKind = (['drums', 'bass', 'lead'] as const).includes(params.kind as 'drums') ? (params.kind as TrackKind) : 'drums';
  let abort: AbortController | null = null;
  let plan: TakePlan | null = null;
  let mic: MicRecorder | null = null;
  let band: Player | null = null;
  let raf = 0;
  let alive = true;
  const scope = new Float32Array(2048);

  const bpmVal = h('div', { class: 'val' }, String(getProject().bpm));
  const setBpm = (v: number): void => {
    edit((p) => { p.bpm = clampBpm(v); });
    updateSettings({ lastBpm: getProject().bpm });
    bpmVal.textContent = String(getProject().bpm);
  };
  const barsSeg = segmented<2 | 4 | 8>(
    [{ value: 2, label: '2 bars' }, { value: 4, label: '4 bars' }, { value: 8, label: '8 bars' }],
    getProject().bars,
    (v) => {
      edit((p) => { p.bars = v; });
      updateSettings({ lastBars: v });
      barsSeg.set(v);
    },
  );

  const KINDS: { kind: TrackKind; em: string; label: string; sub: string; hint: string; verb: string }[] = [
    { kind: 'drums', em: '🥁', label: 'Drums', sub: 'beatbox', hint: 'Beatbox your loop: B = kick, K = snare, ts = hi-hat.', verb: 'Listening to your beatbox…' },
    { kind: 'bass', em: '🎸', label: 'Bass', sub: 'hum', hint: 'Hum a low, simple bassline — one note at a time.', verb: 'Finding your bass notes…' },
    { kind: 'lead', em: '🎹', label: 'Lead', sub: 'hum or whistle', hint: 'Hum or whistle your melody. Short breaks between notes help.', verb: 'Finding your melody…' },
  ];
  const info = (): (typeof KINDS)[number] => KINDS.find((k) => k.kind === kind) ?? KINDS[0];
  const title = h('h1', null);
  const pickButtons = KINDS.map((k) =>
    h('button', { type: 'button', onClick: () => setKind(k.kind) },
      h('span', { class: 'em' }, k.em), h('span', null, k.label), h('span', { class: 'sub' }, k.sub)));
  function setKind(k: TrackKind): void {
    kind = k;
    pickButtons.forEach((b, i) => b.classList.toggle('on', KINDS[i].kind === k));
    title.textContent = `Record ${info().label.toLowerCase()}`;
    if (!abort) status.textContent = `Tap REC. 1-bar count-in, then go. ${info().hint}`;
    renderCalib();
  }

  const calib = h('div', { class: 'card row calib' });
  const renderCalib = (): void => {
    const has = !!getProfile();
    calib.classList.toggle('hidden', kind !== 'drums');
    calib.replaceChildren(
      h('span', { class: 'em' }, has ? '✅' : '🎯'),
      h('div', { class: 'grow small' }, has ? 'Using your personal beatbox sounds.' : 'Teach MouthBand your B, K and ts in 20 seconds. Much better accuracy.'),
      h('button', { class: has ? '' : 'primary', onClick: () => navigate('calibrate', { back: 'record' }) }, has ? 'Redo' : 'Calibrate'),
    );
  };
  const countin = h('div', { class: 'countin' });
  const status = h('div', { class: 'status muted' });
  const dots = [0, 1, 2, 3].map((i) => h('i', { class: i === 0 ? 'down' : '' }));
  const bar = h('div');
  const canvas = h('canvas', { class: 'wave' });
  const spinner = h('div', { class: 'spinner hidden' });
  const recBtn = h('button', { class: 'recbtn', 'aria-label': 'Record', onClick: () => void toggleRecord() }, 'REC');
  const clickBox = h('input', { type: 'checkbox', checked: settings().clickDuringTake });
  clickBox.addEventListener('change', () => updateSettings({ clickDuringTake: clickBox.checked }));
  const bandBox = h('input', { type: 'checkbox', checked: settings().bandDuringTake });
  bandBox.addEventListener('change', () => updateSettings({ bandDuringTake: bandBox.checked }));

  root.append(
    h('header', { class: 'topbar' },
      h('button', { class: 'icon ghost', 'aria-label': 'Back', onClick: () => navigate('studio') }, '←'),
      title,
      h('button', { class: 'icon ghost', 'aria-label': 'Settings', onClick: () => navigate('settings', { back: 'record' }) }, '⚙︎')),
    h('div', { class: 'picker' }, pickButtons),
    h('div', { class: 'card stack' },
      h('div', { class: 'row between' }, h('h2', null, 'Tempo'),
        h('div', { class: 'stepper' },
          h('button', { class: 'icon', 'aria-label': 'Slower', onClick: () => setBpm(getProject().bpm - 1) }, '−'),
          bpmVal,
          h('button', { class: 'icon', 'aria-label': 'Faster', onClick: () => setBpm(getProject().bpm + 1) }, '+'))),
      barsSeg.el),
    calib,
    h('div', { class: 'rec-stage' }, countin, h('div', { class: 'beats' }, dots), recBtn, spinner, status,
      h('div', { class: 'progress' }, bar), canvas),
    h('div', { class: 'card' },
      h('label', { class: 'check' }, clickBox, 'Metronome click while recording'),
      h('label', { class: 'check' }, bandBox, 'Play my other tracks while recording'),
      h('p', { class: 'tiny muted' }, 'Wear headphones so the speaker does not leak into the mic.')),
  );

  setKind(kind);

  function frame(): void {
    if (mic && plan) {
      mic.analyser.getFloatTimeDomainData(scope);
      drawScope(canvas, scope);
      const p = phaseAt(plan, getCtx().currentTime);
      if (p.phase === 'countin') {
        countin.textContent = String(p.beat + 1);
        dots.forEach((d, i) => d.classList.toggle('on', i === p.beat));
        status.textContent = 'Get ready…';
      } else if (p.phase === 'rec') {
        countin.textContent = '';
        dots.forEach((d, i) => d.classList.toggle('on', i === p.beat));
        status.textContent = `Recording · bar ${p.bar + 1} of ${getProject().bars}`;
        bar.style.width = `${(p.progress * 100).toFixed(1)}%`;
      } else if (p.phase === 'done') {
        dots.forEach((d) => d.classList.remove('on'));
      }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  /** The project minus the track being re-recorded — what plays along during the take. */
  const bandView = (): Project => {
    const p = getProject();
    return { ...p, tracks: p.tracks.filter((t) => t.kind !== kind) };
  };

  async function toggleRecord(): Promise<void> {
    if (abort) {
      abort.abort();
      return;
    }
    abort = new AbortController();
    recBtn.classList.add('live');
    recBtn.textContent = 'STOP';
    bar.style.width = '0';
    const p = getProject();
    band = settings().bandDuringTake && p.tracks.some((t) => t.kind !== kind && hasContent(t)) ? new Player(bandView) : null;
    let take: Take | null = null;
    try {
      take = await captureTake({
        bpm: p.bpm,
        bars: p.bars,
        clickDuringTake: settings().clickDuringTake,
        manualLatencyMs: settings().latencyMs,
        signal: abort.signal,
        onPlan: (pl, m) => {
          plan = pl;
          mic = m;
          band?.start(pl.recStart);
        },
      });
    } catch (err) {
      const e = err as Error;
      status.textContent = e.name === 'AbortError' ? 'Cancelled.' : e.name === 'NotAllowedError' ? 'Microphone permission was denied.' : e.message;
    } finally {
      band?.stop();
      band = null;
      abort = null;
      plan = null;
      mic = null;
      countin.textContent = '';
      dots.forEach((d) => d.classList.remove('on'));
      recBtn.classList.remove('live');
      recBtn.textContent = 'REC';
    }
    if (take && alive) await processTake(take);
  }

  async function processTake(take: Take): Promise<void> {
    recBtn.disabled = true;
    spinner.classList.remove('hidden');
    status.textContent = info().verb;
    try {
      const p = getProject();
      const common = { audio: take.audio, sampleRate: take.sampleRate, preroll: take.preroll, bpm: p.bpm, bars: p.bars, swing: p.swing };
      const track = newTrack(kind, getTrack(p, kind)?.preset);
      track.rawVoice = loopAudio(take);
      track.rawRate = take.sampleRate;
      if (kind === 'drums') {
        const res = await runDsp('beatbox', { ...common, profile: getProfile() });
        if (!alive) return;
        if (res.hits.length === 0) {
          status.textContent = 'I could not hear any hits. Try again a little louder or closer to the mic.';
          return;
        }
        track.hits = res.hits;
        commit(track, `🥁 ${res.hits.length} drum hits added`);
      } else {
        const res = await runDsp('melody', { ...common, mode: kind === 'bass' ? 'bass' : 'lead' });
        if (!alive) return;
        if (res.notes.length === 0) {
          status.textContent = res.voiced < 0.05
            ? 'I did not hear any humming. Try again a bit louder.'
            : 'I could not find clear notes. Hum steadier notes with short breaks.';
          return;
        }
        track.notes = res.notes;
        commit(track, `${kind === 'bass' ? '🎸' : '🎹'} ${res.notes.length} notes added`, (p) => refreshKey(p, settings().snapToScale));
      }
    } catch (err) {
      status.textContent = `Analysis failed: ${(err as Error).message}`;
    } finally {
      recBtn.disabled = false;
      spinner.classList.add('hidden');
    }
  }

  function commit(track: Track, message: string, after?: (p: Project) => void): void {
    let old: Track | undefined;
    edit((p) => {
      old = putTrack(p, track);
      after?.(p);
    });
    navigate('studio', { focus: track.kind });
    toast(message, {
      label: 'Undo',
      run: () => {
        edit((p) => {
          if (old) putTrack(p, old);
          else p.tracks = p.tracks.filter((t) => t.id !== track.id);
          after?.(p);
        });
        navigate('studio');
      },
    });
  }

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    abort?.abort();
    band?.stop();
  };
}
