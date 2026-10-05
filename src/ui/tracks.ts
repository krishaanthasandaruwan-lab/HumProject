// The Tracks screen, always in landscape: the song's parts down a rail on the left (trackRail.ts; it never
// scrolls) and, filling the rest, the picked part in the drum grid's look — drums, notes with a row per
// pitch, "My voice" — or "All" parts together bar by bar. In the apps the screen is locked to landscape
// while it is open; elsewhere a phone held upright shows the page turned a quarter.
// Tracks is a Pro tool: looking is free, but changing notes or hits here makes the song need Pro to export.
import '../styles/tracks.css';
import { player } from '../app';
import { keyName } from '../dsp/key';
import { cloneProject, totalSteps, trackById, type Project, type Track } from '../model/project';
import { appendBarSet, barSetSize, maxSongBars, removeBarSet } from '../model/songLength';
import { holdLandscape } from '../native/orientation';
import { navigate } from '../router';
import { markTool, unmarkTool } from '../pro/exports';
import { isPro } from '../pro/pro';
import { edit, getProject, subscribe } from '../state';
import { fill, h, toast } from './dom';
import { gridPages } from './gridPages';
import { proNotice } from './proNotice';
import { allGrid } from './allGrid';
import { canFix, fixChip } from './fix';
import { icon } from './icons';
import { backBtn, chip, iconBtn } from './kit';
import { partEditor, type PartEditor } from './partEditor';
import { PARTS, partLabel } from './parts';
import { openSounds, soundName } from './soundsSheet';
import { trackRail, voiceTracks } from './trackRail';
import { playSquare } from './transport';

const hasContent = (t: Track): boolean => (t.hits?.length ?? 0) + (t.notes?.length ?? 0) > 0;
/** The part picked last time, so coming back opens on it. */
let lastPicked = '';
/** What the parts play (hits and notes): an edit here changes it. */
const content = (p: Project): string => JSON.stringify([p.bars, p.tracks.map((t) => [t.hits, t.notes])]);

export function mountTracks(root: HTMLElement): () => void {
  const p = getProject;
  const ids = (): string[] => [...p().tracks.filter(hasContent).map((t) => t.id), ...(voiceTracks().length ? ['voice'] : []), 'all'];
  if (ids().length < 2) {
    navigate('studio');
    return () => undefined;
  }
  let picked = ids().includes(lastPicked) ? lastPicked : ids()[0];
  const pages = gridPages(() => p().bars, refreshPage, () => barSetSize(p()));
  const view = (id: string): PartEditor => {
    if (id !== 'all') return partEditor(id, pages.bounds);
    const g = allGrid({ project: p, open: pick, page: pages.bounds });
    return { el: h('div', { class: 'part-editor' }, g.el, h('p', { class: 'small muted' }, 'Every part, bar by bar · tap a row to edit it')), rebuild: g.render, setPlayhead: g.setPlayhead };
  };
  let editor = view(picked);
  let raf = 0;
  let lastStep = -2;
  const play = playSquare();
  const meta = h('p', { class: 'label muted' });
  const chips = h('div', { class: 'chips tracks-chips' });
  const stage = h('section', { class: 'tracks-stage' }, editor.el);
  const add = iconBtn('add', 'Add bar set', () => changeLength(false));
  const remove = iconBtn('minus', 'Remove last bar set', () => changeLength(true));
  const sets = h('div', { class: 'tracks-sets', 'aria-hidden': 'true' });
  const cursor = h('span', { class: 'tracks-cursor', hidden: true, 'aria-hidden': 'true' });
  const timeline = h('div', { class: 'tracks-timeline', role: 'img' }, sets, cursor);
  const barTools = h('div', { class: 'tracks-bars' },
    h('div', { class: 'tracks-bars-nav' }, pages.control(true), remove, add), timeline);
  const rail = trackRail({ selected: () => picked, select: pick, changed: () => renderHead() });
  const screen = h('div', { class: 'screen tracks fixed' },
    h('header', { class: 'top' },
      backBtn(() => navigate('studio'), 'Studio'),
      h('div', { class: 'tracks-title' }, h('h1', { class: 'h3' }, p().name), meta),
      chips,
      play.el),
    h('div', { class: 'tracks-body' }, rail.el, h('div', { class: 'tracks-workspace' }, barTools, stage)));
  // Keep editing gestures from magnifying the landscape app frame in iOS.
  for (const gesture of ['gesturestart', 'gesturechange', 'gestureend']) screen.addEventListener(gesture, (e) => e.preventDefault(), { passive: false });
  root.append(screen);
  renderHead();

  function refreshPage(): void {
    editor.rebuild();
    stage.scrollTop = 0;
    lastStep = -2;
    renderBars();
  }

  function renderBars(): void {
    const s = p(), size = barSetSize(s);
    pages.control(true);
    add.disabled = s.bars + size > maxSongBars(s.bpm);
    add.setAttribute('aria-label', `Add ${size}-bar set`);
    add.title = add.disabled ? 'Five-minute limit reached' : `Add ${size} bars at the end`;
    remove.disabled = s.bars <= size;
    remove.title = 'Remove the last bar set';
    const first = pages.bounds()[0];
    sets.replaceChildren(...Array.from({ length: Math.ceil(s.bars / size) }, (_, i) =>
      h('span', { class: `tracks-set${i * size === first ? ' sel' : ''}`, style: `flex-grow:${Math.min(size, s.bars - i * size)}` }, i + 1)));
    timeline.setAttribute('aria-label', `${s.bars} bars in ${Math.ceil(s.bars / size)} sets of ${size}`);
  }

  function changeLength(deleting: boolean): void {
    const saved = cloneProject(p(), false);
    const savedPage = pages.bounds()[0];
    const wasMarked = marked;
    const oldBars = saved.bars;
    edit((s) => deleting ? removeBarSet(s) : appendBarSet(s), saved.id);
    pages.show(deleting ? pages.bounds()[0] : oldBars);
    refreshPage();
    if (!deleting) return;
    const revision = p().updatedAt;
    toast('Last bar set removed', { label: 'Undo', run: () => {
      if (p().updatedAt !== revision) { toast('The song changed after deleting this set.'); return; }
      restoring = true;
      marked = wasMarked;
      edit((s) => {
        restoreMusic(s, saved);
        if (!wasMarked) unmarkTool(s, 'tracks');
      }, saved.id);
      if (!wasMarked) { before = content(p()); snapshot = cloneProject(p(), false); }
      restoring = false;
      pages.show(savedPage);
      refreshPage();
    } });
  }

  function restoreMusic(song: Project, saved: Project): void {
    song.bars = saved.bars;
    song.barSet = saved.barSet;
    for (const t of saved.tracks) {
      const track = trackById(song, t.id);
      if (track) { track.hits = t.hits?.map((x) => ({ ...x })); track.notes = t.notes?.map((x) => ({ ...x })); track.labels = t.labels?.slice(); }
    }
  }

  function pick(id: string): void {
    if (id === picked) return;
    picked = lastPicked = id;
    editor = view(id);
    stage.replaceChildren(editor.el);
    stage.scrollTop = 0;
    lastStep = -2;
    rail.refresh();
    renderHead();
  }

  /** Song facts, and the picked part's sound and Fix. */
  function renderHead(): void {
    const s = p();
    meta.textContent = [`${Math.round(s.bpm)} BPM`, s.key ? keyName(s.key) : null, `${s.bars} bars`].filter(Boolean).join(' · ');
    const t = picked === 'voice' || picked === 'all' ? undefined : trackById(s, picked);
    stage.setAttribute('aria-label', t ? partLabel(s, t) : picked === 'all' ? 'All parts' : PARTS.voice.label);
    const after = (): void => { editor.rebuild(); rail.refresh(); renderHead(); };
    fill(chips,
      t ? chip([soundName(t), icon('down', 14)], () => openSounds(t.id, () => { rail.refresh(); renderHead(); })) : null,
      t && canFix(t.id) ? fixChip(t.id, after) : null);
    renderBars();
  }

  // Tracks is a Pro tool: the first change to notes or hits made here marks the song (with Undo).
  let before = content(p());
  let snapshot = cloneProject(p(), false);
  let marked = !!p().proTools?.includes('tracks');
  let restoring = false;
  const markOnce = (): void => {
    if (restoring || marked || content(p()) === before) return;
    marked = true;
    let added = false;
    edit((pp) => { added = markTool(pp, 'tracks'); });
    if (added && !isPro()) proNotice('Tracks is Pro · export needs Pro', () => {
      restoring = true;
      edit((pp) => {
        restoreMusic(pp, snapshot);
        unmarkTool(pp, 'tracks');
      });
      marked = false;
      before = content(p());
      snapshot = cloneProject(p(), false);
      restoring = false;
      refreshPage();
    });
  };

  // Edits change what lights up, whether Fix can help, and (in All) what the grid shows.
  const unsubscribe = subscribe(() => {
    markOnce();
    rail.refresh();
    renderHead();
    if (picked === 'all') editor.rebuild();
  });

  // Landscape only: lock the app's screen where we can; otherwise turn the page on a phone held upright.
  const upright = matchMedia('(orientation: portrait)');
  const turn = (): void => {
    screen.classList.toggle('turned', upright.matches);
    document.body.classList.toggle('ui-turned', upright.matches); // sheets and messages turn with the page
  };
  turn();
  upright.addEventListener('change', turn);
  const releaseLandscape = holdLandscape();

  const frame = (): void => {
    play.sync();
    const now = player.currentPosition();
    const step = now < 0 ? -1 : Math.floor(now) % totalSteps(p());
    if (pages.follow(step)) refreshPage();
    cursor.hidden = now < 0;
    if (now >= 0) cursor.style.left = `${now / totalSteps(p()) * 100}%`;
    editor.setPlayhead(step);
    if (step !== lastStep) {
      lastStep = step;
      rail.pulse(step);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    unsubscribe();
    upright.removeEventListener('change', turn);
    document.body.classList.remove('ui-turned');
    releaseLandscape();
  };
}
