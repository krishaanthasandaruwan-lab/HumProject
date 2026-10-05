// 16 · My songs: open, rename, duplicate, delete, and start a new song. Stored in IndexedDB.
import { cloneProject, newProject, uid, type Project } from '../model/project';
import { navigate, screenGeneration } from '../router';
import { nextSongName } from '../songName';
import { settings } from '../settings';
import { edit, flushSave, getProject, setProject } from '../state';
import { listProjects, loadProject, restoreProject, saveProject, trashProject, type ProjectMeta } from '../storage';
import { ask, confirmSheet, h, sheet, toast } from './dom';
import { icon, type IconName } from './icons';
import { art, backBtn, iconBtn, mainBtn, titleBlock } from './kit';
import { trashRow } from './trash';
import { swipeToDelete } from './swipe';

function ago(ts: number): string {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString();
}

export async function openProject(p: Project): Promise<void> {
  const generation = screenGeneration();
  await flushSave();
  if (generation !== screenGeneration()) return;
  setProject(p);
  navigate('studio');
}

export async function createSong(): Promise<void> {
  const generation = screenGeneration();
  const s = settings();
  const name = await nextSongName();
  if (generation === screenGeneration()) await openProject(newProject(name, s.lastBpm, s.lastBars));
}

function card(ic: IconName, title: string, sub: string, go: () => void): HTMLButtonElement {
  return h('button', { type: 'button', class: 'card-list', onClick: go },
    h('span', { class: 'ico', 'aria-hidden': 'true' }, icon(ic, 20)), h('span', null, h('b', null, title), h('small', null, sub)), icon('open', 20));
}

export function mountProjects(root: HTMLElement): () => void {
  const list = h('div', { class: 'stack songs' });
  const foot = h('div', { class: 'stack songs-foot' });
  let alive = true;
  root.append(h('div', { class: 'screen' },
    h('header', { class: 'top' },
      backBtn(() => navigate('hum'), 'Home'),
      iconBtn('settings', 'Settings', () => navigate('settings', { back: 'projects' }), { ghost: true })),
    titleBlock(['My', 'songs'], { deco: 'deco' }),
    mainBtn('New', () => newSheet(), { icon: 'add' }),
    list, foot));
  void refresh().catch(() => toast('Couldn’t load your songs. Check storage and try again.'));

  function newSheet(): void {
    const go = (fn: () => void): void => { close(); fn(); };
    const close = sheet(h('div', { class: 'stack' },
      card('mic', 'Hum a song', 'Hum, get three songs', () => go(() => navigate('hum'))),
      card('add', 'Start empty', 'Record part by part', () => go(() => { void createSong().catch(() => toast('Couldn’t save your current song. Please retry.')); }))),
    undefined, 'New');
  }

  async function refresh(): Promise<void> {
    await flushSave();
    const items = await listProjects();
    if (!alive) return;
    list.replaceChildren(...items.map((m) => swipeToDelete(row(m), () => void remove(m, true).catch(() => toast('Couldn’t delete your song. Check storage and try again.')), `Delete ${m.name}`)));
    if (!items.length) list.append(h('div', { class: 'songs-empty' }, art('ill-08-no-songs'), h('p', { class: 'body muted' }, 'No songs yet')));
    const bin = await trashRow(() => void refresh().catch(() => toast('Couldn’t refresh your songs. Please retry.')));
    if (!alive) return;
    foot.replaceChildren(...[bin].filter((x): x is HTMLElement => !!x));
  }

  function row(m: ProjectMeta): HTMLElement {
    const current = m.id === getProject().id;
    return h('div', { class: 'card-list song', 'aria-current': String(current) },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, icon('songs', 20)),
      h('button', { type: 'button', class: 'song-open', onClick: () => open(m.id) },
        h('b', null, m.name), h('small', null, `${Math.round(m.bpm)} BPM · ${m.bars} bars · ${ago(m.updatedAt)}`)),
      h('button', { type: 'button', class: 'icon-btn ghost heart', 'aria-pressed': String(!!m.favorite), 'aria-label': `Favorite ${m.name}`, onClick: () => favorite(m) }, icon('heart', 20)),
      iconBtn('more', `More for ${m.name}`, () => menu(m), { ghost: true }));
  }

  /** Heart a song: favorites are listed first. */
  async function favorite(m: ProjectMeta): Promise<void> {
    const on = !m.favorite;
    if (m.id === getProject().id) {
      edit((p) => { p.favorite = on; });
      await flushSave();
    } else {
      const p = await loadProject(m.id);
      if (!p) return;
      p.favorite = on;
      await saveProject(p);
    }
    await refresh();
  }

  async function open(id: string): Promise<void> {
    const p = id === getProject().id ? getProject() : await loadProject(id);
    if (p) await openProject(p);
    else toast('Couldn’t open that song');
  }

  function menu(m: ProjectMeta): void {
    const go = (fn: () => Promise<void>): void => { close(); void fn().catch(() => toast('Couldn’t update your songs. Check storage and try again.')); };
    const item = (ic: IconName, label: string, fn: () => Promise<void>): HTMLButtonElement =>
      h('button', { type: 'button', class: 'lrow', onClick: () => go(fn) }, h('b', null, label), h('span', { class: 'end' }, icon(ic, 20)));
    const close = sheet(h('div', { class: 'listbox' },
      item('rename', 'Rename', () => rename(m)),
      item('duplicate', 'Duplicate', () => duplicate(m)),
      item('delete', 'Delete', () => remove(m))),
    undefined, m.name);
  }

  async function rename(m: ProjectMeta): Promise<void> {
    const name = await ask('Rename song', m.name);
    if (!name) return;
    if (m.id === getProject().id) {
      edit((p) => { p.name = name; });
    } else {
      const p = await loadProject(m.id);
      if (!p) return;
      p.name = name;
      p.updatedAt = Date.now();
      await saveProject(p);
    }
    await refresh();
  }

  async function duplicate(m: ProjectMeta): Promise<void> {
    const src = m.id === getProject().id ? getProject() : await loadProject(m.id);
    if (!src) return;
    const copy: Project = cloneProject(src);
    copy.id = uid();
    copy.name = `${src.name} (copy)`;
    copy.createdAt = copy.updatedAt = Date.now();
    await saveProject(copy);
    toast('Duplicated');
    await refresh();
  }

  /** Delete (to Recently deleted, with Undo). A swipe is already a clear choice, so it skips the question. */
  async function remove(m: ProjectMeta, swiped = false): Promise<void> {
    if (!swiped && !(await confirmSheet(`Delete “${m.name}”?`, 'Delete', true))) return;
    await flushSave();
    await trashProject(m.id);
    if (m.id === getProject().id) {
      const rest = await listProjects();
      const next = rest[0] ? await loadProject(rest[0].id) : undefined;
      setProject(next ?? newProject(await nextSongName(), settings().lastBpm, settings().lastBars));
    }
    toast('Moved to Recently deleted', { label: 'Undo', run: () => restoreProject(m.id).then(refresh) });
    await refresh();
  }

  return () => { alive = false; };
}
