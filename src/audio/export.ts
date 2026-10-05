// Exports: WAV (OfflineAudioContext render), MIDI, and the before → after video
// (canvas.captureStream + a MediaStreamDestination, recorded with MediaRecorder).
import { loopDuration, type Project } from '../model/project';
import { authorizeExport } from '../pro/authorize';
import { isPro } from '../pro/pro';
import { getCtx, getMaster, unlockAudio } from './context';
import { projectToMidi } from './midi';
import { hasVoice, renderMix, voiceMix } from './render';
import { encodeWav } from './wav';

export async function exportWav(p: Project): Promise<Blob> {
  await authorizeExport(p);
  // Long songs need only one complete pass; repeating them doubles the peak bounce allocation.
  const loops = loopDuration(p) * 2 * 44100 * 8 > 96 * 1024 * 1024 ? 1 : 2;
  const buf = await renderMix(p, { loops, sampleRate: 44100, tail: 1.5 });
  await authorizeExport(p);
  return new Blob([encodeWav([buf.getChannelData(0), buf.getChannelData(1)], buf.sampleRate)], { type: 'audio/wav' });
}

export function exportMidi(p: Project): Blob {
  if (!isPro()) throw new Error('MIDI files are part of Pro.');
  return new Blob([projectToMidi(p)], { type: 'audio/midi' });
}

export interface VideoPlan {
  audio: AudioBuffer;
  rawDur: number;
  bars: number;
  wave: Float32Array<ArrayBuffer>;
}

/** Soundtrack: N bars of raw voice (if any), then N bars of the full band (N ≤ 4). */
export async function prepareVideo(p: Project, includeRaw = true): Promise<VideoPlan> {
  await authorizeExport(p);
  const ctx = getCtx();
  const sr = ctx.sampleRate;
  const bars = Math.min(p.bars, 4);
  const voice = includeRaw && hasVoice(p) ? voiceMix(p, bars, sr) : new Float32Array(0);
  const band = await renderMix(p, { sampleRate: sr, bars, loops: 1, tail: 1 });
  const out = ctx.createBuffer(2, voice.length + band.length, sr);
  for (let c = 0; c < 2; c++) {
    const d = out.getChannelData(c);
    d.set(voice, 0);
    d.set(band.getChannelData(c), voice.length);
  }
  return { audio: out, rawDur: voice.length / sr, bars, wave: voice };
}

export function videoType(): { mime: string; ext: 'mp4' | 'webm' } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' };
  }
  return null;
}

export interface RecordVideoOptions {
  canvas: HTMLCanvasElement;
  draw: (t: number) => void;
  audio: AudioBuffer;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  /** Video quality (bits per second); 3.5 Mbps by default. */
  videoBitsPerSecond?: number;
}

/** Plays the soundtrack (audible + into the recorder) while drawing frames; returns the video. */
export async function recordVideo(o: RecordVideoOptions): Promise<{ blob: Blob; ext: string }> {
  if (o.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const type = videoType();
  const canvas = o.canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream };
  if (!type || typeof canvas.captureStream !== 'function') throw new Error('Video recording is not supported in this browser.');
  const ctx = await unlockAudio();
  let src: AudioBufferSourceNode | undefined, dest: MediaStreamAudioDestinationNode | undefined;
  let video: MediaStream | undefined, stream: MediaStream | undefined, rec: MediaRecorder | undefined;
  let started = false, finished = false, raf = 0, timer = 0;
  let rejectRun: ((error: Error) => void) | undefined;
  let stopped: Promise<void> | undefined;
  let bytes = 0;
  const chunks: Blob[] = [];
  const abort = (): void => rejectRun?.(new DOMException('Cancelled', 'AbortError'));
  const hidden = (): void => { if (document.hidden) rejectRun?.(new Error('Video recording was interrupted. Keep HUMM open and try again.')); };
  try {
    if (o.signal?.aborted || document.hidden) throw new DOMException('Cancelled', 'AbortError');
    dest = ctx.createMediaStreamDestination();
    src = ctx.createBufferSource();
    src.buffer = o.audio;
    src.connect(dest);
    src.connect(getMaster());
    video = canvas.captureStream(30);
    stream = new MediaStream([...video.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: o.videoBitsPerSecond ?? 3_500_000, audioBitsPerSecond: 192_000 });
    rec.ondataavailable = (e) => {
      bytes += e.data.size;
      if (bytes > 128 * 1024 * 1024) rejectRun?.(new Error('The video is too large. Try again with a shorter song.'));
      else if (e.data.size) chunks.push(e.data);
    };
    stopped = new Promise<void>((resolve) => {
      rec!.onstop = () => { resolve(); if (!finished) rejectRun?.(new Error('Video recording stopped early. Please try again.')); };
    });
    rec.onerror = () => rejectRun?.(new Error('The video recorder failed. Please try again.'));
    await new Promise<void>((resolve, reject) => {
      rejectRun = reject;
      o.signal?.addEventListener('abort', abort, { once: true });
      document.addEventListener('visibilitychange', hidden);
      timer = window.setTimeout(() => reject(new Error('Video recording took too long. Please try again.')), (o.audio.duration + 8) * 1000);
      try {
        o.draw(0);
        rec!.start(250);
        started = true;
        const t0 = ctx.currentTime + 0.2;
        src!.start(t0);
        const frame = (): void => {
          try {
            if (ctx.state !== 'running') throw new Error('Audio was interrupted. Keep HUMM open and try again.');
            const t = ctx.currentTime - t0;
            o.draw(Math.max(0, t));
            o.onProgress?.(Math.min(1, Math.max(0, t / o.audio.duration)));
            if (t >= o.audio.duration + 0.15) { finished = true; resolve(); }
            else raf = requestAnimationFrame(frame);
          } catch (error) { reject(error); }
        };
        raf = requestAnimationFrame(frame);
      } catch (error) { reject(error); }
    });
  } finally {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    o.signal?.removeEventListener('abort', abort);
    document.removeEventListener('visibilitychange', hidden);
    try { src?.stop(); } catch { /* not started or already ended */ }
    src?.disconnect();
    if (rec && started) {
      if (rec.state !== 'inactive') { try { rec.stop(); } catch { /* already stopped */ } }
      await new Promise<void>((resolve) => {
        const deadline = setTimeout(resolve, 2000);
        void stopped?.then(() => { clearTimeout(deadline); resolve(); });
      });
    }
    for (const tracks of [stream?.getTracks(), video?.getTracks(), dest?.stream.getTracks()]) tracks?.forEach((track) => track.stop());
    dest?.disconnect();
  }
  if (!bytes) throw new Error('The video recorder returned an empty file. Please try again.');
  return { blob: new Blob(chunks, { type: type.mime.split(';')[0] }), ext: type.ext };
}
