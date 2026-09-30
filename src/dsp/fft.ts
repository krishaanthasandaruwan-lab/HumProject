// Iterative radix-2 FFT + a reusable windowed magnitude-spectrum helper. Pure, no deps.
interface Tables { cos: Float64Array; sin: Float64Array; rev: Uint32Array }
const tables = new Map<number, Tables>();

function getTables(n: number): Tables {
  let t = tables.get(n);
  if (!t) {
    const bits = Math.log2(n);
    if (!Number.isInteger(bits)) throw new Error(`FFT size must be a power of two, got ${n}`);
    const cos = new Float64Array(n / 2);
    const sin = new Float64Array(n / 2);
    for (let k = 0; k < n / 2; k++) {
      cos[k] = Math.cos((2 * Math.PI * k) / n);
      sin[k] = Math.sin((2 * Math.PI * k) / n);
    }
    const rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1);
      rev[i] = r;
    }
    t = { cos, sin, rev };
    tables.set(n, t);
  }
  return t;
}

/** In-place complex FFT (forward). */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  const { cos, sin, rev } = getTables(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let tmp = re[i]; re[i] = re[j]; re[j] = tmp;
      tmp = im[i]; im[i] = im[j]; im[j] = tmp;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const a = i + j;
        const b = a + half;
        const tre = re[b] * cos[k] + im[b] * sin[k];
        const tim = im[b] * cos[k] - re[b] * sin[k];
        re[b] = re[a] - tre;
        im[b] = im[a] - tim;
        re[a] += tre;
        im[a] += tim;
      }
    }
  }
}

const hannCache = new Map<number, Float64Array>();
export function hann(n: number): Float64Array {
  let w = hannCache.get(n);
  if (!w) {
    w = new Float64Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
    hannCache.set(n, w);
  }
  return w;
}

/** Windowed magnitude spectra of fixed-size frames (zero-padded outside the signal). */
export class FrameAnalyzer {
  private readonly re: Float64Array;
  private readonly im: Float64Array;
  private readonly win: Float64Array;
  readonly bins: number;

  constructor(readonly size: number) {
    this.re = new Float64Array(size);
    this.im = new Float64Array(size);
    this.win = hann(size);
    this.bins = size / 2 + 1;
  }

  /** |X[k]| for the frame starting at `start`, normalised so a full-scale sine peaks near 1. */
  magnitudes(signal: ArrayLike<number>, start: number, out: Float32Array): void {
    const { re, im, win, size } = this;
    const n = signal.length;
    for (let i = 0; i < size; i++) {
      const s = start + i;
      re[i] = s >= 0 && s < n ? signal[s] * win[i] : 0;
      im[i] = 0;
    }
    fft(re, im);
    const norm = 4 / size;
    for (let k = 0; k < this.bins; k++) out[k] = Math.hypot(re[k], im[k]) * norm;
  }
}

export const nextPow2 = (n: number): number => Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));
