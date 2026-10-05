// The project being edited, with debounced autosave to IndexedDB.
import { cloneProject, newProject, type Project } from './model/project';
import { settings, updateSettings } from './settings';
import { nextSongName } from './songName';
import { isSaved, listProjects, loadProject, repairProjectIndex, saveProject } from './storage';

let project: Project = newProject();
const listeners = new Set<() => void>();
let timer = 0;
let revision = 0;
let saving: Promise<void> = Promise.resolve();

export function getProject(): Project {
  return project;
}

export function setProject(p: Project): void {
  revision++;
  if (project.id !== p.id) window.dispatchEvent(new Event('humm:project-change'));
  project = p;
  updateSettings({ lastProjectId: p.id });
  emit();
  queueSave();
}

/** Mutate the current project in place, then notify + autosave. */
export function edit(fn: (p: Project) => void, expectedId = project.id): boolean {
  if (project.id !== expectedId) return false;
  revision++;
  fn(project);
  project.updatedAt = Math.max(Date.now(), project.updatedAt + 1);
  emit();
  queueSave();
  return true;
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
  timer = window.setTimeout(() => void flushSave().catch(() => undefined), 600);
}

const hasContent = (p: Project): boolean => p.tracks.some((t) => (t.hits?.length ?? 0) + (t.notes?.length ?? 0) > 0);

export async function flushSave(): Promise<void> {
  clearTimeout(timer);
  const pending = cloneProject(project, false); // raw recordings are immutable; IDB clones them at put()
  saving = saving.catch(() => undefined).then(async () => {
    try {
      // An empty new song is only kept once something is in it.
      if (!hasContent(pending) && !(await isSaved(pending.id))) return;
      await saveProject(pending);
      window.dispatchEvent(new CustomEvent('humm:save-status', { detail: { ok: true, id: pending.id } }));
    } catch (err) {
      console.warn('Could not save project', err);
      window.dispatchEvent(new CustomEvent('humm:save-status', { detail: { ok: false, id: pending.id } }));
      throw err;
    }
  });
  return saving;
}

export async function openInitialProject(): Promise<void> {
  const started = revision;
  try {
    await repairProjectIndex();
    const id = settings().lastProjectId;
    let p = id ? await loadProject(id) : undefined;
    if (!p) {
      const list = await listProjects();
      if (list[0]) p = await loadProject(list[0].id);
    }
    const initial = p ?? newProject(await nextSongName(), settings().lastBpm, settings().lastBars);
    if (revision !== started) return;
    project = initial;
    updateSettings({ lastProjectId: project.id });
  } catch (error) {
    console.warn('Could not open saved projects', error);
    window.dispatchEvent(new Event('humm:storage-error'));
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flushSave().catch(() => undefined);
});
