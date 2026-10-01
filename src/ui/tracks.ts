// One card per track kind: header, preset chips, and the editor (drum grid or piano roll).
import { auditionDrum, auditionNote, toggleVoice } from '../app';
import { getTrack, newTrack, putTrack, totalSteps, TRACK_META, type Track, type TrackKind } from '../model/project';
import { navigate } from '../router';
import { edit, getProject } from '../state';
import { prepareProject } from '../audio/prepare';
import { instrumentLocked, kitLocked } from '../pro/pro';
import { getInstrument, getKit, instrumentsFor, KITS } from '../synth/kits';
import { h } from './dom';
import { fixButton } from './fixButton';
import { drumGrid } from './grid';
import { openPaywall } from './paywall';
import { pianoRoll, type RollApi } from './pianoroll';
import { voiceRow } from './voiceRow';

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
  const row = h('div', { class: 'presets' }, buttons);
  // Show the chosen sound even when it sits far along the row.
  requestAnimationFrame(() => {
    const on = buttons.find((b) => b.classList.contains('on'));
    if (on && on.offsetLeft + on.offsetWidth > row.clientWidth) row.scrollLeft = on.offsetLeft - 12;
  });
  return row;
}

/** 🎤 button that plays the raw take behind a recorded track. */
function voiceButton(track: Track | undefined): HTMLElement | null {
  if (!track?.rawVoice?.length) return null;
  const btn = h('button', { class: 'mini', 'aria-label': 'Hear my recording', title: 'Hear my recording' }, '🎤');
  btn.addEventListener('click', () => {
    const on = toggleVoice(track, () => btn.classList.remove('on'));
    btn.classList.toggle('on', on);
  });
  return btn;
}

function head(kind: TrackKind, refresh: () => void, extra?: HTMLElement | null, auto = false): HTMLElement {
  const m = TRACK_META[kind];
  return h('div', { class: 'track-head' },
    h('h2', null, h('span', { class: 'swatch', style: `background:${m.color}` }), m.label, auto ? h('span', { class: 'gen-tag' }, 'auto') : null),
    voiceButton(getTrack(getProject(), kind)),
    kind !== 'chords' ? fixButton(kind, refresh) : null,
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
  const kitChips = chips(KITS.map((k) => ({ id: k.id, name: k.name, locked: kitLocked(k.id) })), () => track()?.preset ?? '808', (id) => {
    if (kitLocked(id)) {
      auditionDrum('kick', id); // a taste of the sound
      openPaywall(`The ${getKit(id).name} kit is part of Pro.`);
      return;
    }
    edit(() => { ensure().preset = id; });
    auditionDrum('kick', id);
  });
  const headWrap = h('div');
  const refresh = (): void => {
    grid.render();
    headWrap.replaceChildren(head('drums', refresh));
  };
  headWrap.append(head('drums', refresh));
  const el = h('section', { class: 'card' },
    headWrap,
    kitChips,
    grid.el,
    h('p', { class: 'hint' }, 'Tap to add · tap a lit cell: kick → snare → hat → off · hold to delete'));
  return { el, setPlayhead: (s) => grid.setPlayhead(s), refresh };
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
    headWrap.replaceChildren(head(kind, build, action?.() ?? null, !!t?.generated && kind !== 'chords'));
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
    const list = instrumentsFor(kind);
    if (!list.some((i) => i.id === t.preset)) list.unshift(getInstrument(t.preset));
    const presets = chips(list.map((i) => ({ id: i.id, name: i.name, locked: instrumentLocked(i.id) })), () => track()?.preset ?? TRACK_META[kind].preset, (id) => {
      const note = kind === 'bass' ? 40 : 64;
      if (instrumentLocked(id)) {
        auditionNote(id, note); // a taste of the sound
        openPaywall(`${getInstrument(id).name} is part of Pro.`);
        return;
      }
      edit(() => {
        const tr = track();
        if (tr) tr.preset = id;
      });
      auditionNote(id, note);
      void prepareProject(getProject()).catch(() => undefined);
    });
    const labels = t.labels?.length ? h('div', { class: 'chord-names' }, t.labels.map((l) => h('span', null, l))) : null;
    const voice = kind !== 'chords' ? voiceRow(kind) : null;
    body.replaceChildren(...(labels ? [labels] : []), presets, ...(voice ? [voice] : []), roll.el);
  }
  build();
  const el = h('section', { class: 'card' }, headWrap, body);
  return { el, setPlayhead: (s) => roll?.setPlayhead(s), refresh: build };
}
