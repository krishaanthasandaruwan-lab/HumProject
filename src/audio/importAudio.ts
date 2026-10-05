// Bring in a recording made elsewhere (a voice memo, a video, a file): pick it, decode it, mix to mono.
import { getCtx } from './context';
import { decodeNative, nativeMedia, pickNative, type NativeMedia } from '../native/media';
export type AudioFile = File | NativeMedia;

/** Opens the system picker (must be called from a tap). 'video' opens the photo library's videos on
 * iPhone; the sound is taken out of the video. Resolves null if nothing was chosen. */
export function pickAudioFile(kind: 'audio' | 'video' = 'audio', signal?: AbortSignal): Promise<AudioFile | null> {
  if (nativeMedia()) return pickNative(kind, signal);
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(null); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = kind === 'video' ? 'video/*,.mp4,.mov,.m4v,.webm' : 'audio/*,.m4a,.mp3,.wav,.aac,.caf,.ogg,.flac';
    input.style.display = 'none';
    let done = false;
    let timer = 0;
    const returned = (): void => {
      clearTimeout(timer);
      timer = window.setTimeout(() => finish(input.files?.[0] ?? null), 1000);
    };
    const visible = (): void => { if (document.visibilityState === 'visible') returned(); };
    const aborted = (): void => finish(null);
    const finish = (f: File | null): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener('focus', returned);
      document.removeEventListener('visibilitychange', visible);
      signal?.removeEventListener('abort', aborted);
      input.remove();
      resolve(f);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    window.addEventListener('focus', returned);
    document.addEventListener('visibilitychange', visible);
    signal?.addEventListener('abort', aborted, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

/** Decode any format the browser understands (videos too), mixed to mono; at most `maxSeconds`.
 * `seconds` is the whole file's length, so callers can tell when it was cut. */
export async function decodeAudioFile(file: AudioFile, maxSeconds = 60, signal?: AbortSignal): Promise<{ audio: Float32Array<ArrayBuffer>; sampleRate: number; seconds: number }> {
  if ('nativeId' in file) return decodeNative(file, maxSeconds, signal);
  if (signal?.aborted) throw new DOMException('Import cancelled', 'AbortError');
  if (file.size > 24 * 1024 * 1024) throw new Error('Choose a file smaller than 24 MB, or import it in the iPhone app.');
  // Web Audio cannot decode a time range. Check metadata before allocating the decoded buffer.
  await checkDuration(file, signal);
  const ctx = getCtx();
  let buf: AudioBuffer;
  try {
    buf = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error('Can’t open this file. Try a voice memo, an MP3 or a video.');
  }
  if (signal?.aborted) throw new DOMException('Import cancelled', 'AbortError');
  if (buf.length * buf.numberOfChannels * 4 > 72 * 1024 * 1024) throw new Error('This recording is too large. Try a shorter file.');
  const len = Math.min(buf.length, Math.round(maxSeconds * buf.sampleRate));
  const audio = new Float32Array(len);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) audio[i] += d[i] / buf.numberOfChannels;
  }
  return { audio, sampleRate: buf.sampleRate, seconds: buf.duration };
}

function checkDuration(file: File, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const media = document.createElement('video');
    const url = URL.createObjectURL(file);
    const finish = (error?: Error): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      media.onloadedmetadata = media.onerror = null;
      media.removeAttribute('src'); media.load(); URL.revokeObjectURL(url);
      if (error) reject(error); else resolve();
    };
    const abort = (): void => finish(new DOMException('Import cancelled', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('Cannot read this recording. Try a voice memo or MP3.')), 10_000);
    media.preload = 'metadata';
    media.onloadedmetadata = () => finish(!Number.isFinite(media.duration) || media.duration > 180.5
      ? new Error('For longer files, use the iPhone app. On the web, trim the file to 3 minutes first.') : undefined);
    media.onerror = () => finish(new Error('Cannot open this format. Try a voice memo or MP3.'));
    signal?.addEventListener('abort', abort, { once: true });
    media.src = url;
  });
}

/** Audio between two times (s), zero-padded where the range runs past either end. */
export function sliceSeconds(audio: Float32Array, sampleRate: number, from: number, to: number): Float32Array<ArrayBuffer> {
  const s0 = Math.round(from * sampleRate);
  const out = new Float32Array(Math.max(0, Math.round(to * sampleRate) - s0));
  const a = Math.max(0, s0);
  const b = Math.min(audio.length, s0 + out.length);
  if (b > a) out.set(audio.subarray(a, b), a - s0);
  return out;
}
