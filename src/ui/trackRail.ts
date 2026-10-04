// The Tracks screen's rail: one tile per part ("Drums", "Drums 2", "Bass"…), "My voice" when the song
// holds your recorded voice, "Add chords" while the tune has none, and "All". Tap a tile to edit that part,
// hold it to solo, the speaker mutes it. While the song plays, a part's icon lights up on each of its
// notes. The rail never scrolls: its tiles share the height.
import { prepareProject } from '../audio/prepare';
import { trackGain, type Track } from '../model/project';
import { edit, getProject } from '../state';
import { h } from './dom';
import { icon, type IconName } from './icons';
import { makeChords } from './chords';
import { PARTS, partLabel } from './parts';
import { soundName } from './soundsSheet';

const hasContent = (t: Track): boolean => (t.hits?.length ?? 0) + (t.notes?.length ?? 0) > 0;
export const voiceTracks = (): Track[] =>
  getProject().tracks.filter((t) => (t.kind === 'bass' || t.kind === 'lead') && t.rawVoice?.length && t.anchors?.length);

export interface Rail {
  el: HTMLElement;
  refresh(): void;
  /** Light up the parts that play on this step (-1: none). */
  pulse(step: number): void;
}

interface TileOptions {
  muted: boolean;
  solo?: Track;
  mute: () => void;
}

export function trackRail(o: { selected: () => string; select: (id: string) => void; changed: () => void }): Rail {
  const el = h('nav', { class: 'rail', 'aria-label': 'Parts' });
  let beats: { tile: HTMLElement; steps: Set<number> }[] = [];

  /** Hold a part to solo it; returns whether the last press was a hold (so it doesn't also select). */
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
        o.changed();
      }, 450);
    });
    const cancel = (): void => clearTimeout(timer);
    target.addEventListener('pointerup', cancel);
    target.addEventListener('pointerleave', cancel);
    target.addEventListener('pointercancel', cancel);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    return () => held;
  }

  function tile(id: string, ic: IconName, name: string, sub: string, t: TileOptions): HTMLElement {
    const sel = o.selected() === id;
    const soloed = !!t.solo?.solo;
    let wasHeld = (): boolean => false;
    const pick = h('button', { type: 'button', class: 'rail-pick', 'aria-pressed': String(sel), onClick: () => { if (!wasHeld()) o.select(id); } },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, icon(ic, 20)),
      h('span', { class: 'rail-txt' }, h('b', null, name), h('small', null, sub), soloed ? h('span', { class: 'sr-only' }, ' (solo)') : null));
    if (t.solo) wasHeld = holdToSolo(pick, t.solo);
    const mute = h('button', { type: 'button', class: 'icon-btn ghost rail-mute', 'aria-pressed': String(t.muted), 'aria-label': `Mute ${name}`, onClick: () => t.mute() },
      icon(t.muted ? 'mute' : 'unmute', 20));
    return h('div', { class: `rail-part${sel ? ' sel' : ''}${t.muted ? ' muted' : ''}${soloed ? ' solo' : ''}`, 'data-id': id }, pick, mute);
  }

  function refresh(): void {
    const p = getProject();
    const changed = (): void => { refresh(); o.changed(); };
    beats = [];
    const tiles = p.tracks.filter(hasContent).map((t) => {
      const row = tile(t.id, PARTS[t.kind].icon, partLabel(p, t), soundName(t), {
        muted: t.muted,
        solo: t,
        mute: () => { edit(() => { t.muted = !t.muted; }); changed(); },
      });
      const steps = trackGain(p, t) > 0 ? (t.kind === 'drums' ? (t.hits ?? []).map((x) => x.step) : (t.notes ?? []).map((n) => n.start)) : [];
      beats.push({ tile: row, steps: new Set(steps) });
      return row;
    });
    const voices = voiceTracks();
    if (voices.length) {
      const on = voices.some((v) => v.voice?.on);
      const tuned = voices.some((v) => v.voice?.tune ?? true);
      tiles.push(tile('voice', PARTS.voice.icon, PARTS.voice.label, tuned ? 'Tuned' : 'Natural', {
        muted: !on,
        mute: () => {
          edit(() => { for (const v of voices) v.voice = { ...(v.voice ?? { tune: true, level: 0.8 }), on: !on }; });
          void prepareProject(getProject()).catch(() => undefined);
          changed();
        },
      }));
    }
    const tune = p.tracks.some((t) => (t.kind === 'lead' || t.kind === 'bass') && t.notes?.length);
    if (tune && !p.tracks.some((t) => t.kind === 'chords' && t.notes?.length)) {
      tiles.push(h('button', { type: 'button', class: 'rail-suggest', onClick: () => makeChords(() => {
        const chords = getProject().tracks.find((t) => t.kind === 'chords' && t.notes?.length);
        refresh();
        if (chords) o.select(chords.id);
        o.changed();
      }) },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, icon('add', 20)),
      h('span', { class: 'rail-txt' }, h('b', null, 'Add chords'), h('small', null, 'Made from your melody'))));
    }
    // "All": every part together, bar by bar.
    const allSel = o.selected() === 'all';
    tiles.push(h('div', { class: `rail-part rail-all${allSel ? ' sel' : ''}` },
      h('button', { type: 'button', class: 'rail-pick', 'aria-pressed': String(allSel), onClick: () => o.select('all') },
        h('span', { class: 'ico', 'aria-hidden': 'true' }, icon('tracks', 20)),
        h('span', { class: 'rail-txt' }, h('b', null, 'All'), h('small', null, 'Every part')))));
    el.classList.toggle('dense', tiles.length > 5);
    el.replaceChildren(...tiles);
  }

  function pulse(step: number): void {
    for (const b of beats) b.tile.classList.toggle('hit', step >= 0 && b.steps.has(step));
  }

  refresh();
  return { el, refresh, pulse };
}
