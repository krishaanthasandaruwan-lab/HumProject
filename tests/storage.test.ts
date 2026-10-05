import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { clear, get, set } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newProject } from '../src/model/project';
import { deleteProject, listProjects, listTrash, loadProject, repairProjectIndex, restoreProject, saveProject, trashProject } from '../src/storage';

beforeEach(() => clear());
afterEach(() => vi.restoreAllMocks());
describe('atomic project storage', () => {
  it('recovers orphaned records left by older index races without copying or deleting audio', async () => {
    const song = newProject('Recovered');
    await set(`project:${song.id}`, song);
    await set('projects-index', [{ id: 'missing', name: 'Stale row' }]);
    await repairProjectIndex();
    expect((await listProjects()).map((p) => p.name)).toEqual(['Recovered']);
    expect(await loadProject(song.id)).toEqual(song);
  });
  it('keeps every concurrent save in the index', async () => {
    const songs = Array.from({ length: 25 }, (_, i) => newProject(`Song ${i}`));
    await Promise.all(songs.map(saveProject));
    expect(new Set((await listProjects()).map((p) => p.id))).toEqual(new Set(songs.map((p) => p.id)));
  });
  it('rolls back the song record when its index write fails', async () => {
    const song = newProject('Original');
    await saveProject(song);
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (key === 'projects-index') throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, value, key);
    });
    await expect(saveProject({ ...song, name: 'Unsaved' })).rejects.toThrow('Storage full');
    expect((await loadProject(song.id))?.name).toBe('Original');
    expect((await listProjects())[0].name).toBe('Original');
  });
  it('does not resurrect an unrelated deletion during a save', async () => {
    const a = newProject('A'), b = newProject('B');
    await Promise.all([saveProject(a), saveProject(b)]);
    await Promise.all([deleteProject(a.id), saveProject({ ...b, name: 'B edited' })]);
    expect((await listProjects()).map((p) => p.id)).toEqual([b.id]);
    expect(await loadProject(a.id)).toBeUndefined();
  });
  it('moves concurrent trash operations without losing recoverable songs', async () => {
    const songs = Array.from({ length: 12 }, (_, i) => newProject(`Song ${i}`));
    await Promise.all(songs.map(saveProject));
    await Promise.all(songs.map((p) => trashProject(p.id)));
    expect(await listProjects()).toHaveLength(0);
    expect(await listTrash()).toHaveLength(12);
    await Promise.all(songs.map((p) => restoreProject(p.id)));
    expect(await listProjects()).toHaveLength(12);
    expect(await listTrash()).toHaveLength(0);
    expect(await get('projects-trash')).toEqual([]);
  });
});
