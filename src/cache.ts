// "Clear cache" (Settings): frees space without touching songs. Forgets rendered sounds and voice
// layers (made again when needed) and, in the apps, deletes the videos and audio files written for
// sharing. Only files HUMM wrote are removed — the system's own caches are left alone.
import { Capacitor } from '@capacitor/core';
import { clearVoiceCache } from './audio/voiceLayer';
import { clearRenderCache } from './synth/renderCache';

const OURS = /\.(mp4|webm|mov|m4a|aac|wav|mid)$/i;
export const SHARE_CACHE = 'humm-share';
export const SHARE_BUDGET = 128 * 1024 * 1024;

/** Expire our temporary exports after a day and keep their total within the sharing budget. */
export async function pruneSharedFiles(clear = false, reserveBytes = 0): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const readdir = async (path: string) => {
    try { return (await Filesystem.readdir({ path, directory: Directory.Cache })).files; }
    catch (error) {
      if (await Filesystem.stat({ path, directory: Directory.Cache }).then(() => true, () => false)) throw error;
      return [];
    }
  };
  const folders = (await readdir(SHARE_CACHE)).filter((f) => f.type === 'directory' && /^\d{13}-[a-f\d-]+$/i.test(f.name));
  const entries = await Promise.all(folders.map(async (folder) => {
    const path = `${SHARE_CACHE}/${folder.name}`;
    const files = await readdir(path);
    return { path, time: Number(folder.name.split('-')[0]), bytes: files.reduce((sum, f) => sum + f.size, 0), count: files.length };
  }));
  let bytes = entries.reduce((sum, e) => sum + e.bytes, 0), removed = 0;
  for (const entry of entries.sort((a, b) => a.time - b.time)) {
    if (!clear && Date.now() - entry.time < 86400e3 && bytes + reserveBytes <= SHARE_BUDGET) continue;
    await Filesystem.rmdir({ path: entry.path, directory: Directory.Cache, recursive: true });
    bytes -= entry.bytes;
    removed += entry.count;
  }
  // Upgrade cleanup for files created by previous builds in the cache root.
  for (const file of await readdir('')) {
    if (file.type !== 'file' || !OURS.test(file.name) || (!clear && Date.now() - file.mtime < 86400e3)) continue;
    await Filesystem.deleteFile({ path: file.name, directory: Directory.Cache });
    removed++;
  }
  return removed;
}

/** Returns how many shared files were deleted. */
export async function clearCaches(): Promise<number> {
  clearRenderCache();
  clearVoiceCache();
  return pruneSharedFiles(true);
}
