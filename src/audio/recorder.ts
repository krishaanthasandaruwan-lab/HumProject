// Microphone -> Float32Array via an AudioWorklet. Every chunk is stamped with the
// audio-clock frame it was captured on, so takes can be cut exactly on the beat grid.
import { getCtx } from './context';

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
        this.chunks.push({ frame: m.frame, data: m.data });
      }
    };
  }

  static async open(): Promise<MicRecorder> {
    const ctx = getCtx();
    if (!navigator.mediaDevices?.getUserMedia) {
      // Browsers hide the mic API on insecure pages; the iOS / Android apps always have it.
      throw new Error(window.isSecureContext ? 'This browser cannot record audio.' : 'The microphone needs HTTPS. Open the https:// address.');
    }
    if (!ctx.audioWorklet) throw new Error('This browser does not support AudioWorklet.');
    const stream = await navigator.mediaDevices.getUserMedia({
      // Voice processing OFF — AGC/noise suppression destroy beatbox transients.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    try {
      await loadWorklet(ctx);
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, 'mb-recorder', { numberOfOutputs: 1, outputChannelCount: [1] });
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      const sink = ctx.createGain();
      sink.gain.value = 0; // keep the worklet pulled by the graph without monitoring the mic
      source.connect(node);
      source.connect(analyser);
      node.connect(sink).connect(ctx.destination);
      return new MicRecorder(ctx, stream, source, node, sink, analyser);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      throw err;
    }
  }

  /** Input-side latency, when the browser reports it (Chrome does). */
  inputLatency(): number {
    const s = this.stream.getAudioTracks()[0]?.getSettings() as (MediaTrackSettings & { latency?: number }) | undefined;
    return typeof s?.latency === 'number' && isFinite(s.latency) ? s.latency : 0;
  }

  start(): void {
    this.chunks = [];
    this.node.port.postMessage('start');
  }

  stop(): Promise<void> {
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
  }
}
