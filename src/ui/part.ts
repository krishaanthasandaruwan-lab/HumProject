// 05 · Part editor: change the beats or notes of one part. Drums get the grid, hummed parts the piano
// roll, chords their bar blocks, and "My voice" its three controls (voicePanel.ts).
import '../styles/part.css';
import { auditionDrum, auditionNote, player, toggleVoice } from '../app';
import { getTrack, totalSteps, TRACK_META, type Track, type TrackKind } from '../model/project';
import { navigate, type Params } from '../router';
import { edit, getProject } from '../state';
import { fill, h, sheet, toast } from './dom';
import { canFix, runFix } from './fix';
import { drumGrid } from './grid';
import { icon } from './icons';
import { backBtn, btn2, chip, iconBtn } from './kit';
import { makeChords } from './addPart';
import { PARTS, type PartId } from './parts';
import { pianoRoll } from './pianoroll';
import { openSounds, soundName } from './soundsSheet';
import { playSquare } from './transport';
import { voicePanel } from './voicePanel';

const KINDS: PartId[] = ['drums', 'bass', 'lead', 'chords', 'voice'];

export function mountPart(root: HTMLElement, params: Params): () => void {
  const id = (KINDS.includes(params.kind as PartId) ? params.kind : 'drums') as PartId;
  const p = getProject;
  const track = (): Track | undefined => (id === 'voice' ? undefined : getTrack(p(), id));
  if (id !== 'voice' && !track()) {
    navigate('studio');
    return () => undefined;
  }
  const play = playSquare();
  const head = h('div', { class: 'part-chips chips' });
  const editor = h('div', { class: 'part-editor' });
  let setPlayhead: (step: number) => void = () => undefined;
  let raf = 0;

  root.append(h('div', { class: 'screen part' },
    h('header', { class: 'top' },
      backBtn(() => navigate('studio', { focus: id }), 'Studio'),
      id === 'voice' ? null : iconBtn('more', 'More', () => more(), { ghost: true })),
    h('div', { class: 'titleblock' }, h('h1', { class: 'h2' }, PARTS[id].label), head),
    editor,
    h('div', { class: 'part-actions' }, ...actions(), play.el)));
  renderHead();
  build();

  function renderHead(): void {
    if (id === 'voice') return head.replaceChildren();
    const kind = id as TrackKind;
    fill(head,
      chip([soundName(kind), icon('down', 14)], () => openSounds(kind, renderHead)),
      canFix(kind) ? chip('Fix', () => runFix(kind, () => { build(); renderHead(); }), { icon: 'fix', attn: true }) : null);
  }

  function build(): void {
    if (id === 'voice') {
      editor.replaceChildren(voicePanel());
      return;
    }
    const kind = id as TrackKind;
    if (kind === 'drums') {
      const grid = drumGrid({
        hits: () => track()?.hits ?? [],
        bars: () => p().bars,
        edit: (fn) => edit(() => fn((track()!.hits ??= []))),
        audition: (type, v) => auditionDrum(type, track()?.preset ?? '808', v),
      });
      setPlayhead = (s) => grid.setPlayhead(s);
      editor.replaceChildren(grid.el, h('p', { class: 'small muted' }, 'Tap to add · tap again to change · hold to delete'));
      return;
    }
    const roll = pianoRoll({
      notes: () => track()?.notes ?? [],
      steps: () => totalSteps(p()),
      keyOf: () => p().key,
      edit: (fn) => edit(() => fn(track()?.notes ?? [])),
      audition: (m) => auditionNote(track()?.preset ?? TRACK_META[kind].preset, m),
    });
    setPlayhead = (s) => roll.setPlayhead(s);
    const labels = track()?.labels ?? [];
    fill(editor,
      labels.length ? h('div', { class: 'chordblocks', 'aria-label': 'Chords' }, labels.map((l) => h('span', { class: 'h3' }, l))) : null,
      roll.el,
      h('p', { class: 'small muted' }, 'Drag a note up or down · tap to pick it'));
  }

  function actions(): HTMLElement[] {
    if (id === 'voice') return [btn2('Redo', () => navigate('record', { kind: 'lead' }), 'record')];
    if (id === 'chords') return [btn2('Redo', () => { makeChords(() => { build(); renderHead(); }); }, 'again')];
    const take = btn2('My take', undefined, 'voice');
    take.addEventListener('click', () => {
      const t = track();
      if (!t) return;
      const on = toggleVoice(t, () => take.removeAttribute('aria-pressed'));
      take.setAttribute('aria-pressed', String(on));
    });
    take.disabled = !track()?.rawVoice?.length;
    return [btn2('Redo', () => navigate('record', { kind: id }), 'record'), take];
  }

  function more(): void {
    const kind = id as TrackKind;
    const go = (fn: () => void): void => { close(); fn(); };
    const close = sheet(h('div', { class: 'stack' },
      btn2('Clear', () => go(() => change('Cleared', (t) => { t.hits = kind === 'drums' ? [] : undefined; t.notes = kind === 'drums' ? undefined : []; }))),
      btn2('Remove part', () => go(() => change('Part removed', null)))),
    undefined, PARTS[kind].label);
  }

  /** Clear or remove this part, with Undo. */
  function change(msg: string, fn: ((t: Track) => void) | null): void {
    const before = p().tracks.slice();
    const old = track();
    if (!old) return;
    const copy: Track = { ...old, hits: old.hits?.slice(), notes: old.notes?.slice() };
    edit((pp) => {
      if (!fn) pp.tracks = pp.tracks.filter((t) => t !== old);
      else fn(old);
    });
    const undo = (): void => {
      edit((pp) => { pp.tracks = before.map((t) => (t === old ? copy : t)); });
      if (fn) navigate('part', { kind: id });
      else navigate('studio');
    };
    if (!fn) {
      navigate('studio');
      toast(msg, { label: 'Undo', run: undo });
      return;
    }
    build();
    renderHead();
    toast(msg, { label: 'Undo', run: undo });
  }

  const frame = (): void => {
    play.sync();
    setPlayhead(player.currentStep());
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => cancelAnimationFrame(raf);
}
