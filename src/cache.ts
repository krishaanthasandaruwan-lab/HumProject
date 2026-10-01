// "Clear cache" (Settings): frees space without touching songs. Forgets rendered sounds and voice
// layers (made again when needed) and, in the apps, deletes the videos and audio files written for
// sharing. Only files HUMM wrote are removed — the system's own caches are left alone.
import { Capacitor } from '@capacitor/core';
import { clearVoiceCache } from './audio/voiceLayer';
import { clearRenderCache } from './synth/renderCache';

const OURS = /\.(mp4|webm|mov|m4a|aac|wav|mid)$/i;

/** Returns how many shared files were deleted. */
export async function clearCaches(): Promise<number> {
  clearRenderCache();
  clearVoiceCache();
  if (!Capacitor.isNativePlatform()) return 0;
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { files } = await Filesystem.readdir({ path: '', directory: Directory.Cache });
    let n = 0;
    for (const f of files) {
      if (f.type !== 'file' || !OURS.test(f.name)) continue;
      await Filesystem.deleteFile({ path: f.name, directory: Directory.Cache }).then(() => { n++; }, () => undefined);
    }
    return n;
  } catch {
    return 0;
  }
}
