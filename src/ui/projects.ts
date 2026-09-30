// "My songs": open, rename, duplicate, delete, and start a new song. Stored in IndexedDB.
import { newProject, TRACK_META, uid, type Project } from '../model/project';
import { navigate } from '../router';
import { settings } from '../settings';
import { edit, flushSave, getProject, setProject } from '../state';
import { deleteProject, listProjects, loadProject, saveProject, type ProjectMeta } from '../storage';
import { ask, confirmSheet, h, sheet, toast } from './dom';

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

export async function createSong(): Promise<void> {
  const s = settings();
  await openProject(newProject(`Song ${new Date().toLocaleDateString()}`, s.lastBpm, s.lastBars));
}

export function mountProjects(root: HTMLElement): () => void {
  const list = h('div');
  root.append(
    h('header', { class: 'topbar' },
      h('h1', null, h('span', { class: 'brand' }, 'MouthBand')),
      h('button', { class: 'icon ghost', 'aria-label': 'Settings', onClick: () => navigate('settings', { back: 'projects' }) }, '⚙︎')),
    h('button', { class: 'primary big wide', onClick: () => void createSong() }, '＋  New song'),
    h('h2', { style: 'margin:18px 0 4px' }, 'My songs'),
    list,
  );
  void refresh();

  async function refresh(): Promise<void> {
    await flushSave();
    const items = await listProjects().catch(() => [] as ProjectMeta[]);
    list.replaceChildren(...items.map(row));
    if (!items.length) list.append(h('p', { class: 'muted small' }, 'No songs yet. Tap “New song” and start beatboxing.'));
  }

  function row(m: ProjectMeta): HTMLElement {
    const current = m.id === getProject().id;
    return h('div', { class: `card song${current ? ' current' : ''}` },
      h('button', { class: 'song-main', onClick: () => void open(m.id) },
        h('div', { class: 'song-name' }, m.name),
        h('div', { class: 'small muted' },
          `${m.bpm} BPM · ${m.bars} bars · ${m.kinds.map((k) => TRACK_META[k].emoji).join(' ') || 'empty'} · ${ago(m.updatedAt)}`)),
      h('button', { class: 'icon ghost', 'aria-label': `More for ${m.name}`, onClick: () => menu(m) }, '⋯'));
  }

  async function open(id: string): Promise<void> {
    const p = id === getProject().id ? getProject() : await loadProject(id);
    if (p) await openProject(p);
    else toast('Could not open that song');
  }

  function menu(m: ProjectMeta): void {
    const close = sheet(h('div', { class: 'menu' },
      h('h2', null, m.name),
      h('button', { onClick: () => { close(); void rename(m); } }, '✏️  Rename'),
      h('button', { onClick: () => { close(); void duplicate(m); } }, '📄  Duplicate'),
      h('button', { onClick: () => { close(); void remove(m); } }, '🗑  Delete')));
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
    await flushSave();
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
    await deleteProject(m.id);
    if (m.id === getProject().id) {
      const rest = await listProjects();
      const next = rest[0] ? await loadProject(rest[0].id) : undefined;
      setProject(next ?? newProject('My first song', settings().lastBpm, settings().lastBars));
    }
    toast('Deleted');
    await refresh();
  }

  return () => undefined;
}
