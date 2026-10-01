// The tracks table (like GarageBand), full screen from the Studio's Tracks button: one row per part —
// its name, sound, Fix and mute on the left (they stay put), and a lane across the bars on the right,
// with one playhead over all lanes. Long songs scroll sideways; many parts scroll down. Tap a part to
// edit it, hold its name to solo.
import { prepareProject } from '../audio/prepare';
import { STEPS_PER_BAR, type Track } from '../model/project';
import { navigate } from '../router';
import { edit, getProject } from '../state';
import { h } from './dom';
import { canFix, runFix } from './fix';
import { icon } from './icons';
import { chip } from './kit';
import { drawLane } from './laneDraw';
import { makeChords } from './chords';
import { PARTS, partLabel } from './parts';
import { openSounds, soundName } from './soundsSheet';

const ROW_H = 84;
const MIN_BAR = 48;

const hasContent = (t: Track): boolean => (t.hits?.length ?? 0) + (t.notes?.length ?? 0) > 0;
const voiceTracks = (): Track[] => getProject().tracks.filter((t) => (t.kind === 'bass' || t.kind === 'lead') && t.rawVoice?.length && t.anchors?.length);

export interface Timeline {
  el: HTMLElement;
  refresh(): void;
  setPlayhead(step: number, follow: boolean): void;
  empty(): boolean;
  focus(id: string): void;
  dispose(): void;
}

export function timeline(onChange: () => void): Timeline {
  const content = h('div', { class: 'tl-content' });
  const el = h('div', { class: 'tl', role: 'list', 'aria-label': 'Parts' }, content);
  const playhead = h('div', { class: 'tl-playhead', 'aria-hidden': 'true' });
  let barW = MIN_BAR;
  let headW = 140;

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

  function row(t: Track, asVoice: boolean): HTMLElement {
    const p = getProject();
    const id = asVoice ? 'voice' : t.id;
    const name = asVoice ? PARTS.voice.label : partLabel(p, t);
    const muted = asVoice ? !voiceTracks().some((v) => v.voice?.on) : t.muted;
    const open = (): void => navigate('part', { id });
    const nameBtn = h('button', { type: 'button', class: 'tl-name', onClick: () => { if (!wasHeld()) open(); } },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, icon(PARTS[asVoice ? 'voice' : t.kind].icon, 20)),
      h('span', { class: 'nm' }, name, t.solo && !asVoice ? h('span', { class: 'sr-only' }, ' (solo)') : null));
    const wasHeld = asVoice ? (): boolean => false : holdToSolo(nameBtn, t);
    const mute = h('button', { type: 'button', class: 'icon-btn ghost tl-mute', 'aria-pressed': String(muted), 'aria-label': `Mute ${name}`, onClick: () => {
      if (asVoice) {
        const list = voiceTracks();
        const on = list.some((v) => v.voice?.on);
        edit(() => { for (const v of list) v.voice = { ...(v.voice ?? { tune: true, level: 0.8 }), on: !on }; });
        void prepareProject(getProject()).catch(() => undefined);
      } else edit(() => { t.muted = !t.muted; });
      refresh();
      onChange();
    } }, icon(muted ? 'mute' : 'unmute', 20));
    const tools = asVoice
      ? [chip(t.voice?.tune ?? true ? 'Tuned' : 'Natural', open)]
      : [chip([soundName(t), icon('down', 12)], () => openSounds(t.id, () => { refresh(); onChange(); })),
        canFix(t.id) ? fixChip(t) : null];
    const canvas = h('canvas', { 'aria-hidden': 'true' });
    const lane = h('button', { type: 'button', class: 'tl-lane', 'aria-label': `Edit ${name}`, onClick: open }, canvas);
    drawLane(canvas, t, { bars: p.bars, barW, height: ROW_H - 1 }, asVoice);
    return h('div', { class: `tl-row${muted ? ' muted' : ''}${t.solo && !asVoice ? ' solo' : ''}`, role: 'listitem', 'data-id': id },
      h('div', { class: 'tl-head' }, h('div', { class: 'tl-line' }, nameBtn, mute), h('div', { class: 'tl-tools' }, tools)),
      lane);
  }

  /** Fix as a small red icon chip: it only shows when it can help. */
  function fixChip(t: Track): HTMLElement {
    const c = chip('', () => runFix(t.id, () => { refresh(); onChange(); }), { icon: 'fix', attn: true });
    c.setAttribute('aria-label', 'Fix');
    c.classList.add('icon-chip');
    return c;
  }

  function ruler(bars: number): HTMLElement {
    return h('div', { class: 'tl-ruler', 'aria-hidden': 'true' }, h('div', { class: 'tl-corner' }),
      h('div', { class: 'tl-bars' }, Array.from({ length: bars }, (_, b) => h('span', { style: `width:${barW}px` }, String(b + 1)))));
  }

  /** Chords made from the melody, offered where the song has a tune but no chords yet. */
  function suggestion(): HTMLElement | null {
    const p = getProject();
    const tune = p.tracks.some((t) => (t.kind === 'lead' || t.kind === 'bass') && t.notes?.length);
    if (!tune || p.tracks.some((t) => t.kind === 'chords' && t.notes?.length)) return null;
    return h('button', { type: 'button', class: 'tl-suggest', onClick: () => makeChords(() => { refresh(); onChange(); }) },
      icon('add', 18), h('span', null, h('b', null, 'Add chords'), h('small', null, 'Made from your melody')));
  }

  function refresh(): void {
    const p = getProject();
    headW = el.clientWidth > 600 ? 210 : 164;
    const avail = Math.max(0, (el.clientWidth || 360) - headW);
    barW = Math.max(MIN_BAR, Math.floor(avail / p.bars));
    el.style.setProperty('--head-w', `${headW}px`);
    el.style.setProperty('--row-h', `${ROW_H}px`);
    const rows = p.tracks.filter(hasContent).map((t) => row(t, false));
    const voices = voiceTracks();
    if (voices.length) rows.push(row(voices[0], true));
    content.style.width = `${headW + p.bars * barW}px`;
    content.replaceChildren(ruler(p.bars), ...rows, ...[suggestion()].filter((x): x is HTMLElement => !!x), playhead);
  }

  function setPlayhead(step: number, follow: boolean): void {
    playhead.style.display = step < 0 ? 'none' : 'block';
    if (step < 0) return;
    const x = headW + (step / STEPS_PER_BAR) * barW;
    playhead.style.transform = `translateX(${x}px)`;
    // Long songs: keep the playhead in view while playing.
    if (follow && (x < el.scrollLeft + headW || x > el.scrollLeft + el.clientWidth - 24)) el.scrollLeft = Math.max(0, x - headW - 12);
    if (step === 0 && follow) el.scrollLeft = 0;
  }

  function focus(id: string): void {
    const r = content.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
    if (!r) return;
    r.scrollIntoView({ block: 'nearest' });
    r.classList.add('flash');
    setTimeout(() => r.classList.remove('flash'), 900);
  }

  // Re-measure when the screen turns or the window changes size.
  let lastW = 0;
  const ro = new ResizeObserver(() => {
    if (Math.abs(el.clientWidth - lastW) > 4) {
      lastW = el.clientWidth;
      refresh();
    }
  });
  ro.observe(el);

  return { el, refresh, setPlayhead, empty: () => !getProject().tracks.some(hasContent), focus, dispose: () => ro.disconnect() };
}
