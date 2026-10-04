// 05 · Part editor: change the beats or notes of one part (route param `id`: a track id, or 'voice').
// Drums get the grid, hummed parts the piano roll, chords their bar blocks, and "My voice" its
// controls (partEditor.ts).
import '../styles/part.css';
import { player, toggleVoice } from '../app';
import { trackById, type Track } from '../model/project';
import { navigate, type Params } from '../router';
import { edit, getProject } from '../state';
import { fill, h, sheet, toast } from './dom';
import { canFix, fixChip } from './fix';
import { icon } from './icons';
import { backBtn, btn2, chip, iconBtn } from './kit';
import { makeChords } from './chords';
import { partEditor } from './partEditor';
import { PARTS, partLabel } from './parts';
import { openSounds, soundName } from './soundsSheet';
import { playSquare } from './transport';

export function mountPart(root: HTMLElement, params: Params): () => void {
  const id = params.id ?? 'voice';
  const p = getProject;
  const track = (): Track | undefined => (id === 'voice' ? undefined : trackById(p(), id));
  const t0 = track();
  if (id !== 'voice' && !t0) {
    navigate('studio');
    return () => undefined;
  }
  const title = t0 ? partLabel(p(), t0) : PARTS.voice.label;
  const play = playSquare();
  const head = h('div', { class: 'part-chips chips' });
  const editor = partEditor(id);
  const build = (): void => editor.rebuild();
  let raf = 0;

  root.append(h('div', { class: 'screen part' },
    h('header', { class: 'top' },
      backBtn(() => navigate(params.back === 'tracks' ? 'tracks' : 'studio', { focus: id }), params.back === 'tracks' ? 'Tracks' : 'Studio'),
      id === 'voice' ? null : iconBtn('more', 'More', () => more(), { ghost: true })),
    h('div', { class: 'titleblock' }, h('h1', { class: 'h2' }, title), head),
    editor.el,
    h('div', { class: 'part-actions' }, ...actions(), play.el)));
  renderHead();

  function renderHead(): void {
    const t = track();
    if (!t) return head.replaceChildren();
    fill(head,
      chip([soundName(t), icon('down', 14)], () => openSounds(id, renderHead)),
      canFix(id) ? fixChip(id, () => { build(); renderHead(); }) : null);
  }

  function actions(): HTMLElement[] {
    if (id === 'voice') return [btn2('Redo', () => navigate('record', { kind: 'lead' }), 'record')];
    if (t0?.kind === 'chords') return [btn2('Redo', () => { makeChords(() => { build(); renderHead(); }); }, 'again')];
    const take = btn2('My take', undefined, 'voice');
    take.addEventListener('click', () => {
      const t = track();
      if (!t) return;
      const on = toggleVoice(t, () => take.removeAttribute('aria-pressed'));
      take.setAttribute('aria-pressed', String(on));
    });
    take.disabled = !track()?.rawVoice?.length;
    return [btn2('Redo', () => navigate('record', { kind: t0!.kind, replace: id }), 'record'), take];
  }

  function more(): void {
    const kind = t0!.kind;
    const go = (fn: () => void): void => { close(); fn(); };
    const close = sheet(h('div', { class: 'stack' },
      btn2('Clear', () => go(() => change('Cleared', (t) => { t.hits = kind === 'drums' ? [] : undefined; t.notes = kind === 'drums' ? undefined : []; }))),
      btn2('Remove part', () => go(() => change('Part removed', null)))),
    undefined, title);
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
      if (fn) navigate('part', params.back ? { id, back: params.back } : { id });
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
    editor.setPlayhead(player.currentStep());
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => cancelAnimationFrame(raf);
}
