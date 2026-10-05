import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { newProject, newTrack } from '../src/model/project';
const storage = vi.hoisted(() => ({ isSaved: vi.fn(), saveProject: vi.fn(), loadProject: vi.fn(), listProjects: vi.fn(), repairProjectIndex: vi.fn() }));
vi.mock('../src/storage', () => storage);
vi.mock('../src/settings', () => ({ settings: () => ({ lastBpm: 90, lastBars: 4 }), updateSettings: vi.fn() }));
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.clearAllMocks();
  vi.stubGlobal('window', Object.assign(new EventTarget(), { setTimeout }));
  vi.stubGlobal('document', new EventTarget());
  storage.isSaved.mockResolvedValue(true); storage.saveProject.mockResolvedValue(undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const song = () => { const p = newProject('Saved'); p.tracks = [newTrack('lead', 'piano')]; return p; };
it('reports a failed save, rejects navigation flushes, and can retry without losing the song', async () => {
  const state = await import('../src/state');
  const statuses: unknown[] = [];
  window.addEventListener('humm:save-status', (event) => statuses.push((event as CustomEvent).detail));
  const p = song(); state.setProject(p);
  storage.saveProject.mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError'));
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  await expect(state.flushSave()).rejects.toThrow('Full');
  expect(state.getProject()).toBe(p);
  expect(statuses).toEqual([{ ok: false, id: p.id }]);
  await state.flushSave();
  expect(statuses.at(-1)).toEqual({ ok: true, id: p.id }); warning.mockRestore();
});
it('serializes saves and takes a content snapshot before the debounce can overwrite it', async () => {
  const state = await import('../src/state');
  let release!: () => void;
  storage.saveProject.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
  state.setProject(song()); const first = state.flushSave();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  state.edit((p) => { p.name = 'Later edit'; }); const second = state.flushSave();
  expect(storage.saveProject).toHaveBeenCalledOnce();
  expect(storage.saveProject.mock.calls[0][0].name).toBe('Saved');
  release(); await Promise.all([first, second]);
  expect(storage.saveProject.mock.calls[1][0].name).toBe('Later edit');
});
it('ignores an edit captured from a different project', async () => {
  const state = await import('../src/state');
  const first = song(); state.setProject(first); state.setProject(song());
  expect(state.edit((p) => { p.name = 'Wrong'; }, first.id)).toBe(false);
  expect(state.getProject().name).toBe('Saved');
});
