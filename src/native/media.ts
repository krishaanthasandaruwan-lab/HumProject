import { Capacitor, registerPlugin } from '@capacitor/core';
export interface NativeMedia { nativeId: string; name: string }
interface MediaPlugin {
  pickMedia(options: { kind: 'audio' | 'video' }): Promise<NativeMedia & { cancelled?: boolean }>;
  cancelPick(): Promise<void>;
  decodeMedia(options: { id: string; seconds: number }): Promise<{ url: string; sampleRate: number; seconds: number }>;
  cancelDecode(options: { id: string }): Promise<void>;
  removeMedia(options: { id: string }): Promise<void>;
}
const media = registerPlugin<MediaPlugin>('HummMedia');
export const nativeMedia = (): boolean => Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('HummMedia');
export async function pickNative(kind: 'audio' | 'video', signal?: AbortSignal): Promise<NativeMedia | null> {
  if (signal?.aborted) return null;
  const cancel = (): void => { void media.cancelPick().catch(() => undefined); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const picked = await media.pickMedia({ kind });
    if (picked.cancelled) return null;
    if (signal?.aborted) { await media.removeMedia({ id: picked.nativeId }); return null; }
    return picked;
  } finally { signal?.removeEventListener('abort', cancel); }
}
export async function decodeNative(file: NativeMedia, seconds: number, signal?: AbortSignal): Promise<{ audio: Float32Array<ArrayBuffer>; sampleRate: number; seconds: number }> {
  const cancel = (): void => { void media.cancelDecode({ id: file.nativeId }).catch(() => undefined); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (signal?.aborted) throw new DOMException('Import cancelled', 'AbortError');
    const decoded = await media.decodeMedia({ id: file.nativeId, seconds });
    if (signal?.aborted) throw new DOMException('Import cancelled', 'AbortError');
    const response = await fetch(Capacitor.convertFileSrc(decoded.url), { signal });
    if (!response.ok) throw new Error('Could not read imported audio.');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 180 * 48000 * 4 || bytes.byteLength % 4) throw new Error('Invalid imported audio.');
    return { audio: new Float32Array(bytes), sampleRate: decoded.sampleRate, seconds: decoded.seconds };
  } finally {
    signal?.removeEventListener('abort', cancel);
    await media.removeMedia({ id: file.nativeId }).catch(() => undefined);
  }
}
