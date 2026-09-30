// One card per track kind: header, preset chips, and the editor (drum grid or piano roll).
import { auditionDrum, auditionNote } from '../app';
import { getTrack, newTrack, putTrack, totalSteps, TRACK_META, type Track, type TrackKind } from '../model/project';
import { navigate } from '../router';
import { edit, getProject } from '../state';
import { INSTRUMENTS, KITS } from '../synth/kits';
import { h } from './dom';
import { drumGrid } from './grid';
import { pianoRoll, type RollApi } from './pianoroll';

export interface TrackCard {
  el: HTMLElement;
  setPlayhead(step: number): void;
  refresh(): void;
}

export interface ChipItem {
  id: string;
  name: string;
  locked?: boolean;
}

export function chips(items: readonly ChipItem[], active: () => string, pick: (id: string) => void): HTMLElement {
  const buttons = items.map((it) =>
    h('button', { type: 'button', onClick: () => { pick(it.id); sync(); } }, it.name, it.locked ? ' 🔒' : ''));
  const sync = (): void => buttons.forEach((b, i) => b.classList.toggle('on', items[i].id === active()));
  sync();
  return h('div', { class: 'presets' }, buttons);
}

function head(kind: TrackKind, extra?: HTMLElement | null, auto = false): HTMLElement {
  const m = TRACK_META[kind];
  return h('div', { class: 'track-head' },
    h('h2', null, h('span', { class: 'swatch', style: `background:${m.color}` }), m.label, auto ? h('span', { class: 'gen-tag' }, 'auto') : null),
    extra ?? null,
    kind !== 'chords'
      ? h('button', { class: 'mini', onClick: () => navigate('record', { kind }) }, kind === 'drums' ? '🎙 Beatbox' : '🎙 Hum')
      : null);
}

export function drumsCard(): TrackCard {
  const p = getProject;
  const track = (): Track | undefined => getTrack(p(), 'drums');
  const ensure = (): Track => {
    let t = track();
    if (!t) {
      t = newTrack('drums');
      putTrack(p(), t);
    }
    return t;
  };
  const grid = drumGrid({
    hits: () => track()?.hits ?? [],
    bars: () => p().bars,
    edit: (fn) => edit(() => fn((ensure().hits ??= []))),
    audition: (type, v) => auditionDrum(type, track()?.preset ?? '808', v),
  });
  const kitChips = chips(KITS, () => track()?.preset ?? '808', (id) => {
    edit(() => { ensure().preset = id; });
    auditionDrum('kick', id);
  });
  const el = h('section', { class: 'card' },
    head('drums'),
    kitChips,
    grid.el,
    h('p', { class: 'hint' }, 'Tap to add · tap a lit cell: kick → snare → hat → off · hold to delete'));
  return { el, setPlayhead: (s) => grid.setPlayhead(s), refresh: () => grid.render() };
}

const EMPTY: Record<'bass' | 'lead' | 'chords', string> = {
  bass: 'Hum a low bassline — it becomes a synth bass, in key and on the beat.',
  lead: 'Hum or whistle a melody — it becomes a synth lead.',
  chords: 'Record a melody, then tap ✨ Add chords to harmonize it.',
};

export function melodicCard(kind: 'bass' | 'lead' | 'chords', action?: () => HTMLElement | null): TrackCard {
  const p = getProject;
  const track = (): Track | undefined => getTrack(p(), kind);
  const body = h('div');
  let roll: RollApi | null = null;
  const headWrap = h('div');

  function build(): void {
    const t = track();
    headWrap.replaceChildren(head(kind, action?.() ?? null, !!t?.generated && kind !== 'chords'));
    if (!t || !t.notes?.length) {
      roll = null;
      body.replaceChildren(h('div', { class: 'track-empty' },
        h('p', { class: 'muted small' }, EMPTY[kind]),
        kind !== 'chords' ? h('button', { class: 'primary', onClick: () => navigate('record', { kind }) }, '🎙 Record') : null));
      return;
    }
    roll = pianoRoll({
      notes: () => track()?.notes ?? [],
      steps: () => totalSteps(p()),
      keyOf: () => p().key,
      color: TRACK_META[kind].color,
      edit: (fn) => edit(() => fn((track()?.notes ?? []))),
      audition: (m) => auditionNote(track()?.preset ?? TRACK_META[kind].preset, m),
    });
    const presets = chips(INSTRUMENTS, () => track()?.preset ?? TRACK_META[kind].preset, (id) => {
      edit(() => {
        const tr = track();
        if (tr) tr.preset = id;
      });
      auditionNote(id, kind === 'bass' ? 40 : 64);
    });
    const labels = t.labels?.length ? h('div', { class: 'chord-names' }, t.labels.map((l) => h('span', null, l))) : null;
    body.replaceChildren(...(labels ? [labels] : []), presets, roll.el);
  }
  build();
  const el = h('section', { class: 'card' }, headWrap, body);
  return { el, setPlayhead: (s) => roll?.setPlayhead(s), refresh: build };
}
