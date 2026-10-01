// Bring in a recording made elsewhere (a voice memo, a video, a file): pick it, decode it, mix to mono.
import { getCtx } from './context';

const MAX_SECONDS = 60;

/** Opens the system file picker (must be called from a tap). Resolves null if nothing was chosen. */
export function pickAudioFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,video/*,.m4a,.mp3,.wav,.aac,.caf,.ogg,.flac,.mp4,.mov';
    input.style.display = 'none';
    let done = false;
    const finish = (f: File | null): void => {
      if (done) return;
      done = true;
      input.remove();
      resolve(f);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

/** Decode any format the browser understands; first minute only, mixed to mono. */
export async function decodeAudioFile(file: File): Promise<{ audio: Float32Array<ArrayBuffer>; sampleRate: number }> {
  const ctx = getCtx();
  let buf: AudioBuffer;
  try {
    buf = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error('That file has no sound MouthBand can read. Try an MP3, M4A or WAV.');
  }
  const len = Math.min(buf.length, Math.round(MAX_SECONDS * buf.sampleRate));
  const audio = new Float32Array(len);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) audio[i] += d[i] / buf.numberOfChannels;
  }
  return { audio, sampleRate: buf.sampleRate };
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
