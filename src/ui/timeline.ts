// The tracks table (Tracks screen, landscape): one row per part — icon, the same name as in the Studio,
// a small ▾ for its sound, Fix when it can help, and mute — then a lane across the whole song with one
// playhead over all lanes. The song always fits the width (no sideways scrolling); up to 8 parts fit
// the height, more scroll down. Tap a lane to edit that part; hold a name to solo it.
import { prepareProject } from '../audio/prepare';
import { STEPS_PER_BAR, type Track } from '../model/project';
import { navigate } from '../router';
import { edit, getProject } from '../state';
import { h } from './dom';
import { canFix, runFix } from './fix';
import { icon } from './icons';
import { drawLane } from './laneDraw';
import { makeChords } from './chords';
import { PARTS, partLabel } from './parts';
import { openSounds } from './soundsSheet';

const MAX_ROWS = 8; // fit this many parts on screen; more scroll down
const MIN_ROW = 40;
const RULER = 26;

const hasContent = (t: Track): boolean => (t.hits?.length ?? 0) + (t.notes?.length ?? 0) > 0;
const voiceTracks = (): Track[] => getProject().tracks.filter((t) => (t.kind === 'bass' || t.kind === 'lead') && t.rawVoice?.length && t.anchors?.length);
const needsChords = (): boolean => {
  const p = getProject();
  return p.tracks.some((t) => (t.kind === 'lead' || t.kind === 'bass') && t.notes?.length) && !p.tracks.some((t) => t.kind === 'chords' && t.notes?.length);
};

export interface Timeline {
  el: HTMLElement;
  refresh(): void;
  setPlayhead(step: number): void;
  empty(): boolean;
  dispose(): void;
}

export function timeline(onChange: () => void): Timeline {
  const ruler = h('div', { class: 'tl-ruler', 'aria-hidden': 'true' });
  const rows = h('div', { class: 'tl-rows', role: 'list', 'aria-label': 'Parts' });
  const playhead = h('div', { class: 'tl-playhead', 'aria-hidden': 'true' });
  const el = h('div', { class: 'tl' }, ruler, rows, playhead);
  let headW = 168;
  let laneW = 0;

  function holdToSolo(target: HTMLElement, t: Track): () => boolean {
    let held = false;
    let timer = 0;
    target.addEventListener('pointerdown', () => {
      held = false;
      timer = window.setTimeout(() => {
        held = true;
        navigator.vibrate?.(12);
        edit(() => { t.solo = !t.solo; });
        refresh();
        onChange();
      }, 450);
    });
    const cancel = (): void => clearTimeout(timer);
    target.addEventListener('pointerup', cancel);
    target.addEventListener('pointerleave', cancel);
    target.addEventListener('pointercancel', cancel);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    return () => held;
  }

  function row(t: Track, asVoice: boolean, rowH: number): HTMLElement {
    const p = getProject();
    const id = asVoice ? 'voice' : t.id;
    const name = asVoice ? PARTS.voice.label : partLabel(p, t);
    const muted = asVoice ? !voiceTracks().some((v) => v.voice?.on) : t.muted;
    const open = (): void => navigate('part', { id, back: 'tracks' });
    const changed = (): void => { refresh(); onChange(); };
    let wasHeld = (): boolean => false;
    const nameBtn = h('button', { type: 'button', class: 'tl-name', onClick: () => { if (!wasHeld()) open(); } },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, icon(PARTS[asVoice ? 'voice' : t.kind].icon, 18)),
      h('span', { class: 'nm' }, name));
    if (!asVoice) wasHeld = holdToSolo(nameBtn, t);
    const sound = h('button', { type: 'button', class: 'tl-ic', 'aria-label': asVoice ? `${name} settings` : `${name} sound`,
      onClick: () => (asVoice ? open() : openSounds(t.id, changed)) }, icon('down', 16));
    const fix = !asVoice && canFix(t.id)
      ? h('button', { type: 'button', class: 'tl-ic fix', 'aria-label': `Fix ${name}`, onClick: () => runFix(t.id, changed) }, icon('fix', 16))
      : null;
    const mute = h('button', { type: 'button', class: 'tl-ic tl-mute', 'aria-pressed': String(muted), 'aria-label': `Mute ${name}`, onClick: () => {
      if (asVoice) {
        const list = voiceTracks();
        const on = list.some((v) => v.voice?.on);
        edit(() => { for (const v of list) v.voice = { ...(v.voice ?? { tune: true, level: 0.8 }), on: !on }; });
        void prepareProject(getProject()).catch(() => undefined);
      } else edit(() => { t.muted = !t.muted; });
      changed();
    } }, icon(muted ? 'mute' : 'unmute', 18));
    const canvas = h('canvas', { 'aria-hidden': 'true' });
    const lane = h('button', { type: 'button', class: 'tl-lane', 'aria-label': `Edit ${name}`, onClick: open }, canvas);
    drawLane(canvas, t, { bars: p.bars, barW: laneW / p.bars, height: rowH - 1 }, asVoice);
    return h('div', { class: `tl-row${muted ? ' muted' : ''}${t.solo && !asVoice ? ' solo' : ''}`, role: 'listitem', style: `height:${rowH}px` },
      h('div', { class: 'tl-head' }, nameBtn, fix, sound, mute), lane);
  }

  /** Chords made from the melody, offered where the song has a tune but no chords yet. */
  function suggestion(rowH: number): HTMLElement {
    return h('button', { type: 'button', class: 'tl-row tl-suggest', style: `height:${rowH}px`, onClick: () => makeChords(() => { refresh(); onChange(); }) },
      h('span', { class: 'tl-head' }, h('span', { class: 'tl-name' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, icon('add', 18)), h('span', { class: 'nm' }, 'Add chords'))),
      h('span', { class: 'small muted tl-hint' }, 'Made from your melody'));
  }

  function refresh(): void {
    const p = getProject();
    const width = el.clientWidth || 640;
    headW = width < 560 ? 160 : 196;
    laneW = Math.max(40, width - headW - 4);
    const parts = p.tracks.filter(hasContent);
    const voices = voiceTracks();
    const chordsRow = needsChords();
    const count = parts.length + (voices.length ? 1 : 0) + (chordsRow ? 1 : 0);
    const avail = Math.max(MIN_ROW, (el.clientHeight || 320) - RULER - 4);
    const rowH = Math.max(MIN_ROW, Math.floor(avail / Math.max(1, Math.min(count, MAX_ROWS))));
    el.style.setProperty('--head-w', `${headW}px`);
    ruler.replaceChildren(h('span', { class: 'tl-corner' }),
      ...Array.from({ length: p.bars }, (_, b) => h('span', { style: `width:${laneW / p.bars}px` }, p.bars <= 32 || b % 4 === 0 ? String(b + 1) : '')));
    const list = parts.map((t) => row(t, false, rowH));
    if (voices.length) list.push(row(voices[0], true, rowH));
    if (chordsRow) list.push(suggestion(rowH));
    rows.replaceChildren(...list);
  }

  function setPlayhead(step: number): void {
    playhead.style.display = step < 0 ? 'none' : 'block';
    if (step < 0) return;
    const bars = getProject().bars;
    playhead.style.transform = `translateX(${headW + 2 + (step / (bars * STEPS_PER_BAR)) * laneW}px)`;
  }

  // Re-measure when the screen turns or the window changes size.
  let last = '';
  const ro = new ResizeObserver(() => {
    const now = `${Math.round(el.clientWidth)}x${Math.round(el.clientHeight)}`;
    if (now !== last) {
      last = now;
      refresh();
    }
  });
  ro.observe(el);

  return { el, refresh, setPlayhead, empty: () => !getProject().tracks.some(hasContent), dispose: () => ro.disconnect() };
}
