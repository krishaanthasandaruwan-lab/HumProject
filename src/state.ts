// The project being edited, with debounced autosave to IndexedDB.
import { newProject, type Project } from './model/project';
import { settings, updateSettings } from './settings';
import { nextSongName } from './songName';
import { isSaved, listProjects, loadProject, saveProject } from './storage';

let project: Project = newProject();
const listeners = new Set<() => void>();
let timer = 0;

export function getProject(): Project {
  return project;
}

export function setProject(p: Project): void {
  project = p;
  updateSettings({ lastProjectId: p.id });
  emit();
  queueSave();
}

/** Mutate the current project in place, then notify + autosave. */
export function edit(fn: (p: Project) => void): void {
  fn(project);
  project.updatedAt = Date.now();
  emit();
  queueSave();
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit(): void {
  listeners.forEach((cb) => cb());
}

function queueSave(): void {
  clearTimeout(timer);
  timer = window.setTimeout(() => void flushSave(), 600);
}

const hasContent = (p: Project): boolean => p.tracks.some((t) => (t.hits?.length ?? 0) + (t.notes?.length ?? 0) > 0);

export async function flushSave(): Promise<void> {
  clearTimeout(timer);
  try {
    // An empty new song is only kept once something is in it (it doesn't fill a free song slot).
    if (!hasContent(project) && !(await isSaved(project.id))) return;
    await saveProject(project);
  } catch (err) {
    console.warn('Could not save project', err);
  }
}

export async function openInitialProject(): Promise<void> {
  const id = settings().lastProjectId;
  let p = id ? await loadProject(id).catch(() => undefined) : undefined;
  if (!p) {
    const list = await listProjects().catch(() => []);
    if (list[0]) p = await loadProject(list[0].id).catch(() => undefined);
  }
  project = p ?? newProject(await nextSongName(), settings().lastBpm, settings().lastBars);
  updateSettings({ lastProjectId: project.id });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flushSave();
});
