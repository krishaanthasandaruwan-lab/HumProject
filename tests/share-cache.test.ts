import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({
  files: { readdir: vi.fn(), stat: vi.fn(), rmdir: vi.fn(), deleteFile: vi.fn(), writeFile: vi.fn(), appendFile: vi.fn(), getUri: vi.fn() }, share: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: native.files, Directory: { Cache: 'CACHE' } }));
vi.mock('@capacitor/share', () => ({ Share: { share: native.share } }));
vi.mock('../src/audio/voiceLayer', () => ({ clearVoiceCache: vi.fn() }));
vi.mock('../src/synth/renderCache', () => ({ clearRenderCache: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  native.files.rmdir.mockResolvedValue(undefined);
  native.files.readdir.mockResolvedValue({ files: [] });
  native.files.getUri.mockResolvedValue({ uri: 'file:///cache/export.wav' });
  vi.stubGlobal('FileReader', class {
    result = ''; onload?: () => void;
    readAsDataURL(blob: Blob) {
      void blob.arrayBuffer().then((bytes) => { this.result = `data:audio/wav;base64,${Buffer.from(bytes).toString('base64')}`; this.onload?.(); });
    }
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('writes a large export in bounded bridge chunks without changing its bytes or file extension', async () => {
  const { shareFile } = await import('../src/share');
  const bytes = new Uint8Array(2 * 768 * 1024 + 5).map((_, i) => i % 251);
  expect(await shareFile(new Blob([bytes]), 'A/song.wav', 'Song')).toBe('shared');
  const writes = [...native.files.writeFile.mock.calls, ...native.files.appendFile.mock.calls].map((call) => call[0]);
  expect(writes).toHaveLength(3);
  const chunks = writes.map((options) => Buffer.from(options.data, 'base64'));
  expect(Math.max(...chunks.map((chunk) => chunk.length))).toBeLessThanOrEqual(768 * 1024);
  expect(Buffer.concat(chunks).equals(Buffer.from(bytes))).toBe(true);
  expect(writes[0].path).toMatch(/^humm-share\/\d{13}-[a-f\d]+\/Asong\.wav$/);
});
it('removes an incomplete temporary export when sharing fails', async () => {
  const { shareFile } = await import('../src/share');
  native.share.mockRejectedValueOnce(new Error('Share failed'));
  await expect(shareFile(new Blob(['audio']), 'song.wav', 'Song')).rejects.toThrow('Share failed');
  expect(native.files.rmdir.mock.calls[0][0]).toMatchObject({ path: expect.stringMatching(/^humm-share\//), recursive: true });
});
it('prunes oldest owned exports to reserve the next file without touching other plugin directories', async () => {
  const { pruneSharedFiles } = await import('../src/cache');
  const now = 1791158400000; vi.spyOn(Date, 'now').mockReturnValue(now);
  const old = `${now - 2000}-abcd`, recent = `${now - 1000}-efab`;
  native.files.readdir.mockImplementation(async ({ path }) => ({ files: path === 'humm-share' ? [
    { name: old, type: 'directory' }, { name: recent, type: 'directory' }, { name: 'another-plugin', type: 'directory' },
  ] : path.endsWith(old) ? [{ name: 'old.wav', size: 100 * 1024 * 1024 }] : path.endsWith(recent) ? [{ name: 'new.wav', size: 40 * 1024 * 1024 }] : [] }));
  expect(await pruneSharedFiles(false, 32 * 1024 * 1024)).toBe(1);
  expect(native.files.rmdir).toHaveBeenCalledExactlyOnceWith({ path: `humm-share/${old}`, directory: 'CACHE', recursive: true });
});
it('expires owned share files after a day and leaves saved project storage alone', async () => {
  const { pruneSharedFiles } = await import('../src/cache');
  const now = 1791158400000; vi.spyOn(Date, 'now').mockReturnValue(now);
  const name = `${now - 86400e3 - 1}-abcd`;
  native.files.readdir.mockImplementation(async ({ path }) => ({ files: path === 'humm-share' ? [{ name, type: 'directory' }]
    : path === `humm-share/${name}` ? [{ name: 'song.wav', size: 10 }] : [] }));
  expect(await pruneSharedFiles()).toBe(1); expect(native.files.deleteFile).not.toHaveBeenCalled();
});
