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
