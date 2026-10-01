// 16 · My songs: open, rename, duplicate, delete, and start a new song. Stored in IndexedDB.
import { newProject, uid, type Project } from '../model/project';
import { navigate } from '../router';
import { nextSongName } from '../songName';
import { settings } from '../settings';
import { edit, flushSave, getProject, setProject } from '../state';
import { listProjects, loadProject, restoreProject, saveProject, trashProject, type ProjectMeta } from '../storage';
import { FREE_SONG_LIMIT, isPro } from '../pro/pro';
import { ask, confirmSheet, h, sheet, toast } from './dom';
import { icon, type IconName } from './icons';
import { art, backBtn, iconBtn, link, mainBtn, titleBlock } from './kit';
import { openPaywall } from './paywall';
import { trashRow } from './trash';

function ago(ts: number): string {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString();
}

export async function openProject(p: Project): Promise<void> {
  await flushSave();
  setProject(p);
  navigate('studio');
}

/** Free version keeps FREE_SONG_LIMIT songs; returns false (and shows Pro) when full. */
export async function roomForAnother(): Promise<boolean> {
  if (isPro()) return true;
  await flushSave();
  const count = (await listProjects().catch(() => [])).length;
  if (count < FREE_SONG_LIMIT) return true;
  openPaywall(`The free version keeps ${FREE_SONG_LIMIT} songs. Delete one, or go Pro.`);
  return false;
}

export async function createSong(): Promise<void> {
  if (!(await roomForAnother())) return;
  const s = settings();
  await openProject(newProject(await nextSongName(), s.lastBpm, s.lastBars));
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
  void refresh();

  function newSheet(): void {
    const go = (fn: () => void): void => { close(); fn(); };
    const close = sheet(h('div', { class: 'stack' },
      card('mic', 'Hum a song', 'Hum, get three songs', () => go(() => navigate('hum'))),
      card('add', 'Start empty', 'Record part by part', () => go(() => void createSong()))),
    undefined, 'New');
  }

  async function refresh(): Promise<void> {
    await flushSave();
    const items = await listProjects().catch(() => [] as ProjectMeta[]);
    if (!alive) return;
    list.replaceChildren(...items.map(row));
    if (!items.length) list.append(h('div', { class: 'songs-empty' }, art('ill-08-no-songs'), h('p', { class: 'body muted' }, 'No songs yet')));
    const bin = await trashRow(() => void refresh());
    if (!alive) return;
    foot.replaceChildren(...[bin, isPro() ? null : link(`${Math.min(items.length, FREE_SONG_LIMIT)} of ${FREE_SONG_LIMIT} free songs`, () => openPaywall(), true)].filter((x): x is HTMLElement => !!x));
  }

  function row(m: ProjectMeta): HTMLElement {
    const current = m.id === getProject().id;
    return h('div', { class: 'card-list song', 'aria-current': String(current) },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, icon('songs', 20)),
      h('button', { type: 'button', class: 'song-open', onClick: () => void open(m.id) },
        h('b', null, m.name), h('small', null, `${Math.round(m.bpm)} BPM · ${m.bars} bars · ${ago(m.updatedAt)}`)),
      iconBtn('more', `More for ${m.name}`, () => menu(m), { ghost: true }));
  }

  async function open(id: string): Promise<void> {
    const p = id === getProject().id ? getProject() : await loadProject(id);
    if (p) await openProject(p);
    else toast('Couldn’t open that song');
  }

  function menu(m: ProjectMeta): void {
    const go = (fn: () => Promise<void>): void => { close(); void fn(); };
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
    if (!(await roomForAnother())) return;
    const src = m.id === getProject().id ? getProject() : await loadProject(m.id);
    if (!src) return;
    const copy: Project = structuredClone(src);
    copy.id = uid();
    copy.name = `${src.name} (copy)`;
    copy.createdAt = copy.updatedAt = Date.now();
    await saveProject(copy);
    toast('Duplicated');
    await refresh();
  }

  async function remove(m: ProjectMeta): Promise<void> {
    if (!(await confirmSheet(`Delete “${m.name}”?`, 'Delete', true))) return;
    await flushSave();
    await trashProject(m.id);
    if (m.id === getProject().id) {
      const rest = await listProjects();
      const next = rest[0] ? await loadProject(rest[0].id) : undefined;
      setProject(next ?? newProject(await nextSongName(), settings().lastBpm, settings().lastBars));
    }
    toast('Moved to Recently deleted', { label: 'Undo', run: () => void restoreProject(m.id).then(refresh) });
    await refresh();
  }

  return () => { alive = false; };
}
