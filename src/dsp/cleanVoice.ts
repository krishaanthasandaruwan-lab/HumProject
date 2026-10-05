// Gentle cleanup for recorded singing. No gate, pitch change, or broadband suppression.
function tonePower(x: Float32Array, start: number, length: number, sr: number, hz: number): number {
  const coefficient = 2 * Math.cos(2 * Math.PI * hz / sr);
  let a = 0, b = 0;
  for (let k = 0; k < length; k++) {
    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * k / (length - 1));
    const next = x[start + k] * window + coefficient * a - b;
    b = a; a = next;
  }
  return Math.max(0, a * a + b * b - coefficient * a * b) / (length * length);
}

/** Only notch a narrow mains tone if it persists in the quieter sections of the take. */
function mainsTone(x: Float32Array, sr: number, hz: number): boolean {
  const size = Math.round(sr * 0.5);
  if (x.length < size * 3) return false;
  const windows: { start: number; energy: number }[] = [];
  const count = Math.min(12, Math.floor(x.length / size));
  for (let k = 0; k < count; k++) {
    const start = Math.floor(k * (x.length - size) / (count - 1));
    let energy = 0;
    for (let j = start; j < start + size; j++) energy += x[j] * x[j];
    windows.push({ start, energy: energy / size });
  }
  windows.sort((a, b) => a.energy - b.energy);
  const quiet = windows.slice(0, Math.max(3, Math.floor(count / 2)));
  return quiet.every(({ start, energy }) => {
    const power = tonePower(x, start, size, sr, hz);
    const nearby = Math.max(tonePower(x, start, size, sr, hz - 6), tonePower(x, start, size, sr, hz + 6));
    return power > 1e-8 && power > energy * 0.003 && power > nearby * 8;
  });
}

function notch(x: Float32Array, sr: number, hz: number): void {
  const omega = 2 * Math.PI * hz / sr;
  const alpha = Math.sin(omega) / (2 * 35);
  const b0 = 1 / (1 + alpha), b1 = -2 * Math.cos(omega) / (1 + alpha);
  const a2 = (1 - alpha) / (1 + alpha);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let k = 0; k < x.length; k++) {
    const input = x[k];
    const y = b0 * input + b1 * x1 + b0 * x2 - b1 * y1 - a2 * y2;
    x[k] = y; x2 = x1; x1 = input; y2 = y1; y1 = y;
  }
}

export function cleanVoice({ audio, sampleRate }: { audio: Float32Array; sampleRate: number }): Float32Array<ArrayBuffer> {
  const out = new Float32Array(audio.length);
  const pole = Math.exp(-2 * Math.PI * 25 / sampleRate);
  let previous = 0, filtered = 0;
  for (let k = 0; k < audio.length; k++) {
    filtered = (audio[k] - previous) * (1 + pole) / 2 + pole * filtered;
    previous = audio[k]; out[k] = filtered;
  }
  for (const hz of [50, 60]) if (mainsTone(out, sampleRate, hz)) notch(out, sampleRate, hz);
  return out;
}
