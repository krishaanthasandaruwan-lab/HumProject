// Share or save a file: Web Share API in browsers (download fallback); in the iPhone and Android
// apps, write it to the cache and open the native share sheet (whose "Save video" / "Save to
// Files" options do the saving — the web views have no downloads).
import { Capacitor } from '@capacitor/core';
import { pruneSharedFiles, SHARE_BUDGET, SHARE_CACHE } from './cache';

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';
const TEXT = 'Made with HUMM';

export const safeName = (s: string): string => s.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'HUMM';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error ?? new Error('Could not read file'));
    r.readAsDataURL(blob);
  });
}

async function shareNative(blob: Blob, filename: string, title: string): Promise<ShareOutcome> {
  if (!blob.size || blob.size > SHARE_BUDGET) throw new Error('This file is too large to share. Try a shorter song.');
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  await pruneSharedFiles(false, blob.size);
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) => n.toString(16).padStart(2, '0')).join('');
  const folder = `${SHARE_CACHE}/${Date.now()}-${nonce}`;
  const path = `${folder}/${safeName(filename)}`;
  try {
    // A single base64 bridge payload would duplicate the entire video in memory.
    const chunk = 768 * 1024; // divisible by three, so appended base64 chunks decode correctly
    for (let offset = 0; offset < blob.size; offset += chunk) {
      const options = { path, data: await blobToBase64(blob.slice(offset, offset + chunk)), directory: Directory.Cache };
      if (offset === 0) await Filesystem.writeFile({ ...options, recursive: true });
      else await Filesystem.appendFile(options);
    }
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    await Share.share({ title, text: TEXT, files: [uri], dialogTitle: 'Share your song' });
    return 'shared';
  } catch (err) {
    await Filesystem.rmdir({ path: folder, directory: Directory.Cache, recursive: true }).catch(() => undefined);
    if (/cancel/i.test((err as Error).message ?? '')) return 'cancelled';
    throw err;
  }
}

function webDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Save a copy. In the app this opens the share sheet, where "Save to device / Drive" lives. */
export async function download(blob: Blob, filename: string, title = filename): Promise<ShareOutcome> {
  if (Capacitor.isNativePlatform()) return shareNative(blob, filename, title);
  webDownload(blob, filename);
  return 'downloaded';
}

export async function shareFile(blob: Blob, filename: string, title: string): Promise<ShareOutcome> {
  if (Capacitor.isNativePlatform()) return shareNative(blob, filename, title);
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title, text: TEXT });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled';
    }
  }
  webDownload(blob, filename);
  return 'downloaded';
}
