// Share a file with the Web Share API, falling back to a download link.
export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function shareFile(blob: Blob, filename: string, title: string): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title, text: 'Made with MouthBand 🎤 → 🥁🎸🎹' });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled';
    }
  }
  download(blob, filename);
  return 'downloaded';
}

export const safeName = (s: string): string => s.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'MouthBand';
