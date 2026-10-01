// What a part looks like in its timeline lane: drum hits in three rows (hat, snare, kick), notes as
// bars by pitch, chord names per bar, and your own voice as a waveform. Drawn on one canvas per lane.
import { STEPS_PER_BAR, type Track } from '../model/project';
import { GRAPHITE, INK, MIST, RED, STONE } from './colors';

export interface LaneGeom {
  bars: number;
  barW: number; // css px per bar
  height: number; // css px
}

function grid(g: CanvasRenderingContext2D, o: LaneGeom): void {
  for (let b = 0; b <= o.bars; b++) {
    g.fillStyle = STONE;
    g.fillRect(Math.round(b * o.barW), 0, 1, o.height);
    if (b < o.bars) for (let q = 1; q < 4; q++) {
      g.fillStyle = MIST;
      g.fillRect(Math.round(b * o.barW + (q * o.barW) / 4), 0, 1, o.height);
    }
  }
}

function drums(g: CanvasRenderingContext2D, t: Track, o: LaneGeom): void {
  const stepW = o.barW / STEPS_PER_BAR;
  const row = (o.height - 12) / 3;
  const s = Math.max(3, Math.min(7, stepW - 1));
  for (const h of t.hits ?? []) {
    const x = h.step * stepW + (stepW - s) / 2;
    if (h.type === 'hat') {
      g.fillStyle = GRAPHITE;
      g.fillRect(x, 6 + row / 2 - s / 4, s, s / 2);
    } else {
      g.fillStyle = h.type === 'kick' ? INK : RED;
      g.fillRect(x, 6 + (h.type === 'snare' ? row : 2 * row) + (row - s) / 2, s, s);
    }
  }
}

function notes(g: CanvasRenderingContext2D, t: Track, o: LaneGeom): void {
  const ns = t.notes ?? [];
  if (!ns.length) return;
  const stepW = o.barW / STEPS_PER_BAR;
  let lo = Math.min(...ns.map((n) => n.midi));
  let hi = Math.max(...ns.map((n) => n.midi));
  if (hi - lo < 12) { lo -= (12 - (hi - lo)) / 2; hi = lo + 12; }
  const pad = 8;
  const h = Math.max(3, Math.min(6, (o.height - 2 * pad) / (hi - lo + 1)));
  g.fillStyle = t.generated ? GRAPHITE : INK;
  for (const n of ns) {
    const y = pad + ((hi - n.midi) / (hi - lo)) * (o.height - 2 * pad - h);
    g.fillRect(n.start * stepW + 0.5, y, Math.max(2, n.length * stepW - 1), h);
  }
}

function chords(g: CanvasRenderingContext2D, t: Track, o: LaneGeom): void {
  notes(g, t, o);
  if (o.barW < 30) return;
  g.font = `400 ${o.barW < 48 ? 11 : 14}px Anton, Impact, sans-serif`;
  g.textBaseline = 'top';
  (t.labels ?? []).forEach((label, b) => {
    if (b >= o.bars) return;
    const w = g.measureText(label).width + 8;
    g.fillStyle = RED;
    g.fillRect(b * o.barW + 4, 4, w, 18);
    g.fillStyle = INK;
    g.fillText(label, b * o.barW + 8, 6);
  });
}

/** Your voice: the recording's loudness across the loop. */
function voice(g: CanvasRenderingContext2D, t: Track, o: LaneGeom): void {
  const a = t.rawVoice;
  if (!a?.length) return;
  const w = o.bars * o.barW;
  const cols = Math.max(1, Math.floor(w / 3));
  const per = Math.max(1, Math.floor(a.length / cols));
  let peak = 1e-4;
  for (let i = 0; i < a.length; i += 64) peak = Math.max(peak, Math.abs(a[i]));
  g.fillStyle = RED;
  for (let c = 0; c < cols; c++) {
    let m = 0;
    for (let i = c * per; i < Math.min(a.length, (c + 1) * per); i += 8) m = Math.max(m, Math.abs(a[i]));
    const hgt = Math.max(1, (m / peak) * (o.height - 12));
    g.fillRect(c * 3, (o.height - hgt) / 2, 2, hgt);
  }
}

export function drawLane(canvas: HTMLCanvasElement, t: Track, o: LaneGeom, asVoice = false): void {
  const w = o.bars * o.barW;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${o.height}px`;
  // Sharp on any screen, but never wider than phones allow a canvas to be.
  const dpr = Math.min(window.devicePixelRatio || 1, 3, 16000 / Math.max(1, w));
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(o.height * dpr));
  const g = canvas.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, o.bars * o.barW, o.height);
  grid(g, o);
  g.globalAlpha = t.muted || (asVoice && !t.voice?.on) ? 0.3 : 1;
  if (asVoice) voice(g, t, o);
  else if (t.kind === 'drums') drums(g, t, o);
  else if (t.kind === 'chords') chords(g, t, o);
  else notes(g, t, o);
  g.globalAlpha = 1;
}
