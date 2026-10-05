// Project records and their indexes change in one IndexedDB transaction, including across tabs.
import { createStore, get, promisifyRequest } from 'idb-keyval';
import type { Project, TrackKind } from './model/project';

export interface ProjectMeta {
  id: string;
  name: string;
  bpm: number;
  bars: number;
  kinds: TrackKind[];
  favorite?: boolean;
  updatedAt: number;
  createdAt: number;
}
export interface TrashMeta extends ProjectMeta { deletedAt: number }
const INDEX = 'projects-index';
const TRASH = 'projects-trash';
const key = (id: string): string => `project:${id}`;
const trashKey = (id: string): string => `trash:${id}`;
const store = createStore('keyval-store', 'keyval');
export const TRASH_DAYS = 30;

/** Recover records omitted by the old non-atomic index writer; never delete a song during repair. */
export function repairProjectIndex(): Promise<void> {
  return mutate(async (s) => {
    if (await read<boolean>(s, 'projects-index-repaired-v1')) return;
    const keys = new Set(await promisifyRequest<IDBValidKey[]>(s.getAllKeys()));
    const list = ((await read<ProjectMeta[]>(s, INDEX)) ?? []).filter((m) => keys.has(key(m.id)));
    const indexed = new Set(list.map((m) => m.id));
    for (const k of keys) {
      if (typeof k !== 'string' || !k.startsWith('project:') || indexed.has(k.slice(8))) continue;
      const p = await read<Project>(s, k);
      if (p && p.id === k.slice(8) && Array.isArray(p.tracks)) list.push(meta(p));
    }
    s.put(list, INDEX);
    s.put(true, 'projects-index-repaired-v1');
  });
}

/** Only IndexedDB requests may be awaited here. A failed write rolls everything back. */
function mutate<T>(fn: (s: IDBObjectStore) => Promise<T>): Promise<T> {
  return store('readwrite', async (s) => {
    const completed = promisifyRequest(s.transaction);
    try {
      const value = await fn(s);
      await completed;
      return value;
    } catch (error) {
      try { s.transaction.abort(); } catch { /* already completed or aborted */ }
      await completed.catch(() => undefined);
      throw error;
    }
  });
}
const read = async <T>(s: IDBObjectStore, k: string): Promise<T | undefined> => promisifyRequest<T>(s.get(k));
const meta = (p: Project): ProjectMeta => ({
  id: p.id, name: p.name, bpm: p.bpm, bars: p.bars, kinds: p.tracks.map((t) => t.kind),
  favorite: p.favorite, updatedAt: p.updatedAt, createdAt: p.createdAt,
});
function putProject(s: IDBObjectStore, p: Project, list: ProjectMeta[]): void {
  s.put(p, key(p.id));
  s.put([...list.filter((m) => m.id !== p.id), meta(p)], INDEX);
}
export async function listProjects(): Promise<ProjectMeta[]> {
  const list = (await get<ProjectMeta[]>(INDEX)) ?? [];
  return list.sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || b.updatedAt - a.updatedAt);
}
export async function loadProject(id: string): Promise<Project | undefined> {
  const p = await get<Project>(key(id));
  if (p) { p.quantize ??= 1; p.swing ??= 0; p.updatedAt ??= p.createdAt; }
  return p;
}
export function saveProject(p: Project): Promise<void> {
  return mutate(async (s) => putProject(s, p, (await read<ProjectMeta[]>(s, INDEX)) ?? []));
}
export async function isSaved(id: string): Promise<boolean> {
  return ((await get<ProjectMeta[]>(INDEX)) ?? []).some((m) => m.id === id);
}
export function deleteProject(id: string): Promise<void> {
  return mutate(async (s) => {
    const list = (await read<ProjectMeta[]>(s, INDEX)) ?? [];
    s.delete(key(id));
    s.put(list.filter((m) => m.id !== id), INDEX);
  });
}
export function trashProject(id: string): Promise<void> {
  return mutate(async (s) => {
    const p = await read<Project>(s, key(id));
    const list = (await read<ProjectMeta[]>(s, INDEX)) ?? [];
    const trash = (await read<TrashMeta[]>(s, TRASH)) ?? [];
    if (p) {
      s.put(p, trashKey(id));
      s.put([...trash.filter((m) => m.id !== id), { ...meta(p), deletedAt: Date.now() }], TRASH);
    }
    s.delete(key(id));
    s.put(list.filter((m) => m.id !== id), INDEX);
  });
}
export function listTrash(now = Date.now()): Promise<TrashMeta[]> {
  return mutate(async (s) => {
    const trash = (await read<TrashMeta[]>(s, TRASH)) ?? [];
    const keep = trash.filter((m) => now - m.deletedAt < TRASH_DAYS * 86400e3);
    for (const m of trash) if (!keep.includes(m)) s.delete(trashKey(m.id));
    if (keep.length !== trash.length) s.put(keep, TRASH);
    return keep.sort((a, b) => b.deletedAt - a.deletedAt);
  });
}
export function restoreProject(id: string): Promise<Project | undefined> {
  return mutate(async (s) => {
    const p = await read<Project>(s, trashKey(id));
    const list = (await read<ProjectMeta[]>(s, INDEX)) ?? [];
    const trash = (await read<TrashMeta[]>(s, TRASH)) ?? [];
    const entry = trash.find((m) => m.id === id);
    const valid = p && entry && Date.now() - entry.deletedAt < TRASH_DAYS * 86400e3;
    if (valid) putProject(s, p, list);
    s.delete(trashKey(id));
    s.put(trash.filter((m) => m.id !== id), TRASH);
    return valid ? p : undefined;
  });
}
export function deleteForever(id: string): Promise<void> {
  return mutate(async (s) => {
    const trash = (await read<TrashMeta[]>(s, TRASH)) ?? [];
    s.delete(trashKey(id));
    s.put(trash.filter((m) => m.id !== id), TRASH);
  });
}
