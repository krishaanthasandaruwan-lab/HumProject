// Microphone -> Float32Array via an AudioWorklet. Every chunk is stamped with the
// audio-clock frame it was captured on, so takes can be cut exactly on the beat grid.
import { getCtx, resetAudioContext, setAudioSession, unlockAudio } from './context';

/** Same code as public/recorder-worklet.js (a test keeps them identical); used if that file can't load. */
export const WORKLET_SRC = `
class MBRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = false; this.size = 2048; this.buf = new Float32Array(this.size); this.n = 0; this.first = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'start') { this.on = true; this.n = 0; }
      else if (e.data === 'stop') { this.flush(); this.on = false; this.port.postMessage({ done: true }); }
    };
  }
  flush() {
    if (this.n === 0) return;
    const data = this.buf.slice(0, this.n);
    this.port.postMessage({ frame: this.first, data }, [data.buffer]);
    this.n = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (this.on && input && input.length > 0) {
      const a = input[0], b = input.length > 1 ? input[1] : null;
      for (let i = 0; i < a.length; i++) {
        if (this.n === 0) this.first = currentFrame + i;
        this.buf[this.n++] = b ? (a[i] + b[i]) * 0.5 : a[i];
        if (this.n === this.size) this.flush();
      }
    }
    return true;
  }
}
registerProcessor('mb-recorder', MBRecorder);
`;

export interface Chunk {
  frame: number;
  data: Float32Array;
}

/** Copy the captured chunks that overlap [startFrame, startFrame+length) into one buffer (gaps = silence). */
export function stitch(chunks: Chunk[], startFrame: number, length: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.max(0, Math.round(length)));
  const end = startFrame + out.length;
  for (const c of chunks) {
    const s = Math.max(startFrame, c.frame);
    const e = Math.min(end, c.frame + c.data.length);
    if (e > s) out.set(c.data.subarray(s - c.frame, e - c.frame), s - startFrame);
  }
  return out;
}

const loaded = new WeakMap<BaseAudioContext, Promise<void>>();
function loadWorklet(ctx: AudioContext): Promise<void> {
  let p = loaded.get(ctx);
  if (!p) {
    // A real same-origin file is the most compatible (older Safari is picky about blob: modules).
    p = ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}recorder-worklet.js`).catch(() => {
      const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
      return ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    });
    p.catch(() => loaded.delete(ctx));
    loaded.set(ctx, p);
  }
  return p;
}

export class MicRecorder {
  private chunks: Chunk[] = [];
  private onDone: (() => void) | null = null;
  private closed = false;
  private frames = 0;
  private watchdog = 0;
  private releaseAbort: (() => void) | undefined;
  private ready: (() => void) | null = null;
  private failed: ((error: Error) => void) | null = null;
  private lastInput = 0;
  private readonly hidden = (): void => { if (document.visibilityState === 'hidden') this.close(); };

  private constructor(
    readonly ctx: AudioContext,
    private readonly stream: MediaStream,
    private readonly source: MediaStreamAudioSourceNode,
    private readonly node: AudioWorkletNode,
    private readonly sink: GainNode,
    readonly analyser: AnalyserNode,
  ) {
    node.port.onmessage = (e: MessageEvent<{ frame?: number; data?: Float32Array; done?: boolean }>) => {
      const m = e.data;
      if (m.done) {
        this.onDone?.();
        this.onDone = null;
      } else if (m.data && typeof m.frame === 'number') {
        this.lastInput = performance.now();
        if (this.stream.getAudioTracks().some((t) => t.readyState === 'live' && !t.muted)) this.ready?.();
        this.frames += m.data.length;
        if (this.frames > this.ctx.sampleRate * 200) { this.close(); return; }
        this.chunks.push({ frame: m.frame, data: m.data });
      }
    };
    node.onprocessorerror = () => this.close();
    document.addEventListener('visibilitychange', this.hidden);
  }

  static async open(signal?: AbortSignal, retry = true): Promise<MicRecorder> {
    if (signal?.aborted) throw new DOMException('Recording cancelled', 'AbortError');
    setAudioSession('play-and-record');
    const ctx = getCtx();
    // Start the resume in the tap, then resume again after the mic changes the audio route.
    void unlockAudio().catch(() => undefined);
    if (!navigator.mediaDevices?.getUserMedia) {
      // Browsers hide the mic API on insecure pages; the iOS / Android apps always have it.
      throw new Error(window.isSecureContext ? 'This browser cannot record audio.' : 'The microphone needs HTTPS. Open the https:// address.');
    }
    if (!ctx.audioWorklet) throw new Error('This browser does not support AudioWorklet.');
    const stream = await navigator.mediaDevices.getUserMedia({
      // Voice processing OFF — AGC/noise suppression destroy beatbox transients.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    const connected: AudioNode[] = [];
    try {
      if (signal?.aborted || document.hidden) throw new DOMException('Recording cancelled', 'AbortError');
      await loadWorklet(ctx);
      if (signal?.aborted || document.hidden) throw new DOMException('Recording cancelled', 'AbortError');
      const source = ctx.createMediaStreamSource(stream);
      connected.push(source);
      const node = new AudioWorkletNode(ctx, 'mb-recorder', { numberOfOutputs: 1, outputChannelCount: [1] });
      connected.push(node);
      const analyser = ctx.createAnalyser();
      connected.push(analyser);
      analyser.fftSize = 2048;
      const sink = ctx.createGain();
      connected.push(sink);
      sink.gain.value = 0; // keep the worklet pulled by the graph without monitoring the mic
      source.connect(node);
      source.connect(analyser);
      node.connect(sink).connect(ctx.destination);
      const recorder = new MicRecorder(ctx, stream, source, node, sink, analyser);
      const close = (): void => recorder.close();
      signal?.addEventListener('abort', close, { once: true });
      recorder.releaseAbort = () => signal?.removeEventListener('abort', close);
      try {
        await unlockAudio();
        await recorder.start();
        if (signal?.aborted || document.hidden) throw new DOMException('Recording cancelled', 'AbortError');
      } catch (error) { recorder.close(); throw error; }
      return recorder;
    } catch (err) {
      for (const node of connected) { try { node.disconnect(); } catch { /* setup never completed */ } }
      stream.getTracks().forEach((t) => t.stop());
      if (retry && !signal?.aborted && !document.hidden && (err as Error).name !== 'AbortError') {
        resetAudioContext();
        return MicRecorder.open(signal, false);
      }
      throw err;
    }
  }

  /** Input-side latency, when the browser reports it (Chrome does). */
  inputLatency(): number {
    const s = this.stream.getAudioTracks()[0]?.getSettings() as (MediaTrackSettings & { latency?: number }) | undefined;
    return typeof s?.latency === 'number' && isFinite(s.latency) ? s.latency : 0;
  }

  private start(): Promise<void> {
    if (this.closed) throw new DOMException('Recording interrupted', 'AbortError');
    this.chunks = [];
    this.frames = 0;
    clearTimeout(this.watchdog);
    this.watchdog = window.setTimeout(() => this.close(), 200_000);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ready = this.failed = null;
        reject(new Error('The microphone isn’t receiving audio. Tap again to retry.'));
      }, 2500);
      this.ready = () => { clearTimeout(timer); this.ready = this.failed = null; resolve(); };
      this.failed = (error) => { clearTimeout(timer); this.ready = this.failed = null; reject(error); };
      this.node.port.postMessage('start');
    });
  }

  /** Silence still has frames. A stalled audio clock or disconnected mic does not. */
  receiving(): boolean { return !this.closed && this.stream.getAudioTracks().some((t) => t.readyState === 'live' && !t.muted) && performance.now() - this.lastInput < 2500; }

  stop(): Promise<void> {
    if (this.closed) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, 600);
      this.onDone = () => {
        clearTimeout(timer);
        resolve();
      };
      this.node.port.postMessage('stop');
    });
  }

  /** Audio captured between two audio-clock times (seconds). */
  extract(t0: number, t1: number): Float32Array<ArrayBuffer> {
    const sr = this.ctx.sampleRate;
    return stitch(this.chunks, Math.round(t0 * sr), Math.round((t1 - t0) * sr));
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.watchdog);
    this.failed?.(new DOMException('Recording interrupted', 'AbortError'));
    this.releaseAbort?.();
    document.removeEventListener('visibilitychange', this.hidden);
    this.onDone?.();
    this.onDone = null;
    this.stream.getTracks().forEach((t) => t.stop());
    try {
      this.source.disconnect();
      this.node.disconnect();
      this.sink.disconnect();
      this.analyser.disconnect();
    } catch {
      /* already disconnected */
    }
    this.node.port.onmessage = null;
    this.node.onprocessorerror = null;
  }
}
