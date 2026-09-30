// Exports: WAV (OfflineAudioContext render), MIDI, and the before → after video
// (canvas.captureStream + a MediaStreamDestination, recorded with MediaRecorder).
import type { Project } from '../model/project';
import { getCtx, getMaster, unlockAudio } from './context';
import { projectToMidi } from './midi';
import { hasVoice, renderMix, voiceMix } from './render';
import { encodeWav } from './wav';

export async function exportWav(p: Project): Promise<Blob> {
  const buf = await renderMix(p, { loops: 2, sampleRate: 44100, tail: 1.5 });
  return new Blob([encodeWav([buf.getChannelData(0), buf.getChannelData(1)], buf.sampleRate)], { type: 'audio/wav' });
}

export function exportMidi(p: Project): Blob {
  return new Blob([projectToMidi(p)], { type: 'audio/midi' });
}

export interface VideoPlan {
  audio: AudioBuffer;
  rawDur: number;
  bars: number;
  wave: Float32Array<ArrayBuffer>;
}

/** Soundtrack: N bars of raw voice (if any), then N bars of the full band (N ≤ 4). */
export async function prepareVideo(p: Project): Promise<VideoPlan> {
  const ctx = getCtx();
  const sr = ctx.sampleRate;
  const bars = Math.min(p.bars, 4);
  const voice = hasVoice(p) ? voiceMix(p, bars, sr) : new Float32Array(0);
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
}

/** Plays the soundtrack (audible + into the recorder) while drawing frames; returns the video. */
export async function recordVideo(o: RecordVideoOptions): Promise<{ blob: Blob; ext: string }> {
  const type = videoType();
  const canvas = o.canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream };
  if (!type || typeof canvas.captureStream !== 'function') throw new Error('Video recording is not supported in this browser.');
  const ctx = await unlockAudio();
  const dest = ctx.createMediaStreamDestination();
  const src = ctx.createBufferSource();
  src.buffer = o.audio;
  src.connect(dest);
  src.connect(getMaster());
  const video = canvas.captureStream(30);
  const stream = new MediaStream([...video.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 3_500_000, audioBitsPerSecond: 160_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((r) => { rec.onstop = () => r(); });
  o.draw(0);
  rec.start(250);
  const t0 = ctx.currentTime + 0.2;
  src.start(t0);
  try {
    await new Promise<void>((resolve, reject) => {
      const loop = (): void => {
        if (o.signal?.aborted) return reject(new DOMException('Cancelled', 'AbortError'));
        const t = ctx.currentTime - t0;
        o.draw(Math.max(0, t));
        o.onProgress?.(Math.min(1, Math.max(0, t / o.audio.duration)));
        if (t >= o.audio.duration + 0.15) resolve();
        else requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
  } finally {
    try { src.stop(); } catch { /* already ended */ }
    src.disconnect();
    if (rec.state !== 'inactive') rec.stop();
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
  }
  return { blob: new Blob(chunks, { type: type.mime.split(';')[0] }), ext: type.ext };
}
