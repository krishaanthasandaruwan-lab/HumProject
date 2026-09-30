// Share or save a file: Web Share API in browsers (download fallback); in the Android app,
// write it to the cache and open the native share sheet (WebView has no Web Share or downloads).
import { Capacitor } from '@capacitor/core';

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';
const TEXT = 'Made with MouthBand 🎤 → 🥁🎸🎹';

export const safeName = (s: string): string => s.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'MouthBand';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error ?? new Error('Could not read file'));
    r.readAsDataURL(blob);
  });
}

async function shareNative(blob: Blob, filename: string, title: string): Promise<ShareOutcome> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const { uri } = await Filesystem.writeFile({ path: filename, data: await blobToBase64(blob), directory: Directory.Cache });
  try {
    await Share.share({ title, text: TEXT, files: [uri], dialogTitle: 'Share your song' });
    return 'shared';
  } catch (err) {
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
