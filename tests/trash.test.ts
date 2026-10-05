import 'fake-indexeddb/auto';
import { clear, get } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';

const { deleteForever, listProjects, listTrash, restoreProject, saveProject, trashProject, TRASH_DAYS } = await import('../src/storage');
const { newProject } = await import('../src/model/project');
const { nextSongName } = await import('../src/songName');

describe('Recently deleted', () => {
  beforeEach(() => clear());

  it('moves a deleted song to the bin and back', async () => {
    const p = newProject('Song 1');
    await saveProject(p);
    await trashProject(p.id);
    expect(await listProjects()).toHaveLength(0);
    expect((await listTrash()).map((m) => m.name)).toEqual(['Song 1']);
    await restoreProject(p.id);
    expect((await listProjects()).map((m) => m.name)).toEqual(['Song 1']);
    expect(await listTrash()).toHaveLength(0);
  });

  it('forgets songs after 30 days, or right away when asked', async () => {
    const a = newProject('A');
    const b = newProject('B');
    await saveProject(a);
    await saveProject(b);
    await trashProject(a.id);
    await trashProject(b.id);
    expect(await listTrash(Date.now() + (TRASH_DAYS + 1) * 86400e3)).toHaveLength(0);
    expect(await get(`trash:${a.id}`)).toBeUndefined();
    const c = newProject('C');
    await saveProject(c);
    await trashProject(c.id);
    await deleteForever(c.id);
    expect(await listTrash()).toHaveLength(0);
  });
});

describe('song names', () => {
  beforeEach(() => clear());

  it('numbers new songs after the highest one', async () => {
    expect(await nextSongName()).toBe('Song 1');
    await saveProject(newProject('Song 1'));
    await saveProject(newProject('Song 4'));
    await saveProject(newProject('Demo'));
    expect(await nextSongName()).toBe('Song 5');
  });
});
