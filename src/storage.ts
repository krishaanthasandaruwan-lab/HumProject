// Projects in IndexedDB (idb-keyval): one record per project plus a small index for the list screen.
import { del, get, set } from 'idb-keyval';
import type { Project, TrackKind } from './model/project';

export interface ProjectMeta {
  id: string;
  name: string;
  bpm: number;
  bars: number;
  kinds: TrackKind[];
  updatedAt: number;
  createdAt: number;
}

const INDEX = 'projects-index';
const key = (id: string): string => `project:${id}`;

export async function listProjects(): Promise<ProjectMeta[]> {
  const list = (await get<ProjectMeta[]>(INDEX)) ?? [];
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const p = await get<Project>(key(id));
  if (p) {
    // Older saves may miss newer fields.
    p.quantize ??= 1;
    p.swing ??= 0;
    p.updatedAt ??= p.createdAt;
  }
  return p;
}

export async function saveProject(p: Project): Promise<void> {
  await set(key(p.id), p);
  const list = (await get<ProjectMeta[]>(INDEX)) ?? [];
  const meta: ProjectMeta = {
    id: p.id, name: p.name, bpm: p.bpm, bars: p.bars,
    kinds: p.tracks.map((t) => t.kind), updatedAt: p.updatedAt, createdAt: p.createdAt,
  };
  const i = list.findIndex((m) => m.id === p.id);
  if (i >= 0) list[i] = meta;
  else list.push(meta);
  await set(INDEX, list);
}

export async function deleteProject(id: string): Promise<void> {
  await del(key(id));
  const list = ((await get<ProjectMeta[]>(INDEX)) ?? []).filter((m) => m.id !== id);
  await set(INDEX, list);
}

// ---- Recently deleted: songs wait here for 30 days, then go for good. ----
export interface TrashMeta extends ProjectMeta {
  deletedAt: number;
}

const TRASH = 'projects-trash';
const trashKey = (id: string): string => `trash:${id}`;
export const TRASH_DAYS = 30;

/** Move a song to Recently deleted. */
export async function trashProject(id: string): Promise<void> {
  const p = await get<Project>(key(id));
  const meta = ((await get<ProjectMeta[]>(INDEX)) ?? []).find((m) => m.id === id);
  if (p && meta) {
    await set(trashKey(id), p);
    const trash = (await get<TrashMeta[]>(TRASH)) ?? [];
    await set(TRASH, [...trash.filter((m) => m.id !== id), { ...meta, deletedAt: Date.now() }]);
  }
  await deleteProject(id);
}

/** Recently deleted songs, newest first; anything older than TRASH_DAYS is removed for good. */
export async function listTrash(now = Date.now()): Promise<TrashMeta[]> {
  const trash = (await get<TrashMeta[]>(TRASH)) ?? [];
  const keep = trash.filter((m) => now - m.deletedAt < TRASH_DAYS * 86400e3);
  if (keep.length !== trash.length) {
    await Promise.all(trash.filter((m) => !keep.includes(m)).map((m) => del(trashKey(m.id))));
    await set(TRASH, keep);
  }
  return keep.sort((a, b) => b.deletedAt - a.deletedAt);
}

export async function restoreProject(id: string): Promise<Project | undefined> {
  const p = await get<Project>(trashKey(id));
  if (p) await saveProject(p);
  await forgetTrash(id);
  return p;
}

export async function deleteForever(id: string): Promise<void> {
  await forgetTrash(id);
}

async function forgetTrash(id: string): Promise<void> {
  await del(trashKey(id));
  await set(TRASH, ((await get<TrashMeta[]>(TRASH)) ?? []).filter((m) => m.id !== id));
}
