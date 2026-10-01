// 08 · Record: beatbox the drums, hum the bass or the melody over the song. 1-bar count-in, then the
// loop records and stops by itself (recordProcess.ts turns it into a track).
import '../styles/record.css';
import { getCtx } from '../audio/context';
import { phaseAt, type TakePlan } from '../audio/metronome';
import type { MicRecorder } from '../audio/recorder';
import { Player } from '../audio/scheduler';
import { captureTake, type Take } from '../audio/take';
import type { Project, Track } from '../model/project';
import { getProfile } from '../profile';
import { navigate, type Params } from '../router';
import { settings, updateSettings } from '../settings';
import { edit, getProject } from '../state';
import { h, segmented, sheet } from './dom';
import { icon } from './icons';
import { backBtn, chip, group, iconBtn, listRow, mainBtn, stepper, titleBlock, toggle } from './kit';
import { PARTS } from './parts';
import { importRecording, type ImportKind } from './recordImport';
import { commit, processTake } from './recordProcess';
import { drawScope } from './waveform';

const clampBpm = (v: number): number => Math.max(70, Math.min(140, Math.round(v)));
const hasContent = (t: Track): boolean => (t.hits?.length ?? 0) + (t.notes?.length ?? 0) > 0;
const HINTS: Record<ImportKind, string> = { drums: 'B = kick · K = snare · ts = hat', bass: 'Hum low, one note at a time', lead: 'Hum or whistle the tune' };

export function mountRecord(root: HTMLElement, params: Params): () => void {
  let kind: ImportKind = (['drums', 'bass', 'lead'] as const).includes(params.kind as ImportKind) ? (params.kind as ImportKind) : 'drums';
  let abort: AbortController | null = null;
  let plan: TakePlan | null = null;
  let mic: MicRecorder | null = null;
  let band: Player | null = null;
  let raf = 0;
  let alive = true;
  const scope = new Float32Array(2048);
  const empty = !getProject().tracks.some(hasContent);

  const tiles = (['drums', 'bass', 'lead'] as const).map((k) =>
    h('button', { type: 'button', class: 'rtile', 'aria-pressed': 'false', onClick: () => setKind(k) }, icon(PARTS[k].icon, 26), h('span', { class: 'label' }, PARTS[k].label)));
  const hint = h('p', { class: 'body muted rec-hint' });
  const teach = h('span');
  const countin = h('div', { class: 'hero countin num', 'aria-live': 'assertive' });
  const beats = [0, 1, 2, 3].map(() => h('i'));
  const recBtn = h('button', { type: 'button', class: 'recbtn', 'aria-label': 'Record', onClick: () => void toggleRecord() }, h('i', { class: 'dot' }), h('span', null, 'Rec'));
  const status = h('p', { class: 'small muted rec-status', 'aria-live': 'polite' });
  const progress = h('div', { class: 'bar rec-progress' }, h('i'));
  const canvas = h('canvas', { class: 'rec-wave', 'aria-hidden': 'true' });
  const spinner = h('div', { class: 'spinner hidden' });
  const importChip = chip('Import', () => void importTake(), { icon: 'import' });

  root.append(h('div', { class: 'screen record' },
    h('header', { class: 'top' }, backBtn(() => navigate('studio'), 'Studio'), iconBtn('settings', 'Recording options', () => options(), { ghost: true })),
    titleBlock(['Record']),
    h('div', { class: 'rtiles', role: 'group', 'aria-label': 'Part' }, tiles),
    hint,
    h('div', { class: 'chips' }, chip('Best with headphones', undefined, { icon: 'headphones', tip: true }), teach, importChip),
    h('div', { class: 'rec-stage' }, countin, h('div', { class: 'beatsq', 'aria-hidden': 'true' }, beats), recBtn, spinner, status, progress, canvas),
    empty ? tempoBox() : null));
  setKind(kind);
  if (params.import === '1') void importTake();

  function setKind(k: ImportKind): void {
    kind = k;
    tiles.forEach((b, i) => b.setAttribute('aria-pressed', String((['drums', 'bass', 'lead'] as const)[i] === k)));
    hint.textContent = HINTS[k];
    const has = !!getProfile();
    teach.replaceChildren(k === 'drums' ? chip('Teach my sounds', () => navigate('calibrate', { back: 'record' }), { icon: has ? 'done' : 'teach' }) : '');
    teach.firstElementChild?.classList.toggle('done', has);
    if (!abort) status.textContent = '';
  }

  function tempoBox(): HTMLElement {
    const bpm = stepper(() => getProject().bpm, (v) => {
      edit((p) => { p.bpm = clampBpm(v); });
      updateSettings({ lastBpm: getProject().bpm });
    }, 'BPM', 'Tempo');
    const bars = segmented<2 | 4 | 8>([{ value: 2, label: '2 bars' }, { value: 4, label: '4 bars' }, { value: 8, label: '8 bars' }], getProject().bars, (v) => {
      edit((p) => { p.bars = v; });
      updateSettings({ lastBars: v });
      bars.set(v);
    }, 'Loop length');
    return h('div', { class: 'rec-tempo' }, bpm.el, bars.el);
  }

  function options(): void {
    const close = sheet(h('div', { class: 'stack' },
      group('While recording',
        listRow('Click', toggle(settings().clickDuringTake, (on) => updateSettings({ clickDuringTake: on }), 'Metronome click')),
        listRow('Play other parts', toggle(settings().bandDuringTake, (on) => updateSettings({ bandDuringTake: on }), 'Play other parts'))),
      mainBtn('Done', () => close(), { icon: 'done' })),
    undefined, 'Options');
  }

  function frame(): void {
    if (mic && plan) {
      mic.analyser.getFloatTimeDomainData(scope);
      drawScope(canvas, scope);
      const ph = phaseAt(plan, getCtx().currentTime);
      if (ph.phase === 'countin') {
        countin.textContent = String(4 - ph.beat);
        beats.forEach((d, i) => d.classList.toggle('on', i <= ph.beat));
        status.textContent = 'Get ready…';
      } else if (ph.phase === 'rec') {
        countin.textContent = '';
        beats.forEach((d, i) => d.classList.toggle('on', i === ph.beat));
        status.textContent = `Bar ${ph.bar + 1} of ${getProject().bars}`;
        (progress.firstChild as HTMLElement).style.width = `${(ph.progress * 100).toFixed(1)}%`;
      } else if (ph.phase === 'done') {
        beats.forEach((d) => d.classList.remove('on'));
      }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  /** The project minus the part being re-recorded: what plays along during the take. */
  const bandView = (): Project => {
    const p = getProject();
    return { ...p, tracks: p.tracks.filter((t) => t.kind !== kind) };
  };

  function busy(on: boolean, live = false): void {
    tiles.forEach((b) => { b.disabled = on; });
    (importChip as HTMLButtonElement).disabled = on;
    recBtn.classList.toggle('live', live);
    recBtn.lastElementChild!.textContent = live ? 'Stop' : 'Rec';
    recBtn.setAttribute('aria-label', live ? 'Stop' : 'Record');
    root.querySelector('.rec-stage')?.classList.toggle('active', live);
  }

  async function toggleRecord(): Promise<void> {
    if (abort) return void abort.abort();
    const takeKind = kind;
    busy(true, true);
    abort = new AbortController();
    (progress.firstChild as HTMLElement).style.width = '0';
    const p = getProject();
    band = settings().bandDuringTake && p.tracks.some((t) => t.kind !== kind && hasContent(t)) ? new Player(bandView) : null;
    let take: Take | null = null;
    try {
      take = await captureTake({
        bpm: p.bpm, bars: p.bars, clickDuringTake: settings().clickDuringTake, manualLatencyMs: settings().latencyMs, signal: abort.signal,
        onPlan: (pl, m) => { plan = pl; mic = m; band?.start(pl.recStart); },
      });
    } catch (err) {
      const e = err as Error;
      status.textContent = e.name === 'AbortError' ? 'Stopped.' : e.name === 'NotAllowedError' ? 'Mic is off. Allow it in Settings.' : e.message;
    } finally {
      band?.stop();
      band = null;
      abort = null;
      plan = null;
      mic = null;
      countin.textContent = '';
      beats.forEach((d) => d.classList.remove('on'));
      busy(false);
    }
    if (!take || !alive) return;
    navigator.vibrate?.(15);
    busy(true);
    recBtn.disabled = true;
    spinner.classList.remove('hidden');
    status.textContent = 'Listening back…';
    try {
      const res = await processTake(take, takeKind);
      if (!alive) return;
      if (res.ok) commit(res.track, res.message, res.after);
      else status.textContent = res.message;
    } catch (err) {
      status.textContent = `Something went wrong: ${(err as Error).message}`;
    } finally {
      if (alive) {
        busy(false);
        recBtn.disabled = false;
        spinner.classList.add('hidden');
      }
    }
  }

  /** A recording made elsewhere, beat-matched into this song (recordImport.ts). */
  async function importTake(): Promise<void> {
    if (abort) return;
    busy(true);
    recBtn.disabled = true;
    try {
      const res = await importRecording(kind, (on, text) => {
        spinner.classList.toggle('hidden', !on);
        if (text) status.textContent = text;
      });
      if (res && alive) commit(res.track, res.message, res.after);
    } finally {
      if (alive) {
        busy(false);
        recBtn.disabled = false;
        spinner.classList.add('hidden');
      }
    }
  }

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    abort?.abort();
    band?.stop();
  };
}
