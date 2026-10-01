// The 9:16 "what I recorded → what came out" video, drawn frame by frame on a canvas, in the app's look:
// paper, ink and Stage Red, Anton titles, square pads with hard shadows.
import { keyName } from '../dsp/key';
import { STEPS_PER_BAR, stepDur, swingOffset, totalSteps, type Project } from '../model/project';
import { GRAPHITE, INK, MIST, PAPER, RED, WHITE } from './colors';

export type PadId = 'kick' | 'snare' | 'hat' | 'bass' | 'lead' | 'chords';
export interface SceneEvent { t: number; pad: PadId }
export const VIDEO_W = 720;
export const VIDEO_H = 1280;

const PADS: { id: PadId; label: string }[] = [
  { id: 'kick', label: 'KICK' }, { id: 'snare', label: 'SNARE' }, { id: 'hat', label: 'HAT' },
  { id: 'bass', label: 'BASS' }, { id: 'lead', label: 'MELODY' }, { id: 'chords', label: 'CHORDS' },
];
const DISPLAY = (px: number): string => `400 ${px}px Anton, Impact, "Arial Narrow", sans-serif`;
const LABEL = (px: number): string => `700 ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;

/** Load the title fonts before drawing text on a canvas. */
export function loadSceneFonts(): Promise<unknown> {
  return Promise.all([document.fonts.load(DISPLAY(48)), document.fonts.load(LABEL(30))]).catch(() => undefined);
}

/** When each pad fires during the band part (seconds, starting at `offset`), sorted by time. */
export function sceneEvents(p: Project, bars: number, offset: number): SceneEvent[] {
  const sd = stepDur(p.bpm);
  const steps = Math.min(totalSteps(p), bars * STEPS_PER_BAR);
  const at = (s: number): number => offset + (s + swingOffset(s, p.swing)) * sd;
  const out: SceneEvent[] = [];
  for (const t of p.tracks) {
    if (t.muted) continue;
    if (t.kind === 'drums') {
      for (const hit of t.hits ?? []) if (hit.step < steps) out.push({ t: at(hit.step), pad: hit.type });
    } else {
      const starts = new Set((t.notes ?? []).filter((n) => n.start < steps).map((n) => n.start));
      for (const s of starts) out.push({ t: at(s), pad: t.kind });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

export interface SceneData {
  project: Project;
  bars: number;
  rawDur: number; // 0 = no voice recorded: the video is "after" only
  wave: Float32Array;
  sampleRate: number;
  events: SceneEvent[];
  watermark: boolean;
}

export function createScene(canvas: HTMLCanvasElement, d: SceneData): { draw(t: number): void } {
  canvas.width = VIDEO_W;
  canvas.height = VIDEO_H;
  const g = canvas.getContext('2d') as CanvasRenderingContext2D;
  const p = d.project;
  const sd = stepDur(p.bpm);
  const bandDur = d.bars * STEPS_PER_BAR * sd;
  const COLS = 48;
  const env = new Float32Array(COLS);
  const per = Math.max(1, Math.floor(d.wave.length / COLS));
  for (let c = 0; c < COLS; c++) {
    let m = 0;
    for (let i = c * per; i < Math.min(d.wave.length, (c + 1) * per); i++) m = Math.max(m, Math.abs(d.wave[i]));
    env[c] = m;
  }
  const peak = Math.max(1e-4, ...env);
  // The poster frame has no events yet: show every pad as present.
  const present = new Set<PadId>(d.events.length ? d.events.map((e) => e.pad) : PADS.map((x) => x.id));
  const chords = p.tracks.find((t) => t.kind === 'chords')?.labels ?? [];
  const sub = `${Math.round(p.bpm)} BPM${p.key ? ` · ${keyName(p.key)}` : ''}`.toUpperCase();

  const box = (x: number, y: number, w: number, h: number, fill: string, shadow = 0): void => {
    if (shadow) { g.fillStyle = INK; g.fillRect(x + shadow, y + shadow, w, h); }
    g.fillStyle = INK;
    g.fillRect(x, y, w, h);
    g.fillStyle = fill;
    g.fillRect(x + 4, y + 4, w - 8, h - 8);
  };

  function level(t: number): number {
    const c = Math.round(t * d.sampleRate);
    let s = 0;
    const n = Math.round(0.04 * d.sampleRate);
    for (let i = Math.max(0, c - n); i < Math.min(d.wave.length, c + n); i++) s += d.wave[i] * d.wave[i];
    return Math.min(1, Math.sqrt(s / (2 * n)) * 3);
  }

  /** Two-line Anton title, left-aligned; the second line sits on the red highlight block. */
  function title(a: string, b: string, frac: number): void {
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = DISPLAY(112);
    g.fillStyle = INK;
    g.fillText(a, 56, 250);
    const w = g.measureText(b).width;
    g.fillStyle = RED;
    g.fillRect(48, 272, w + 22, 122);
    g.fillStyle = INK;
    g.fillText(b, 59, 380);
    g.font = LABEL(30);
    g.fillStyle = GRAPHITE;
    g.fillText(`${p.name.toUpperCase()} · ${sub}`, 58, 450, VIDEO_W - 116);
    g.fillStyle = INK;
    g.fillRect(56, 478, VIDEO_W - 112, 14);
    g.fillStyle = MIST;
    g.fillRect(60, 482, VIDEO_W - 120, 6);
    g.fillStyle = RED;
    g.fillRect(60, 482, (VIDEO_W - 120) * Math.min(1, frac), 6);
  }

  function before(t: number): void {
    title('WHAT I', 'RECORDED', t / d.rawDur);
    const colW = (VIDEO_W - 112) / COLS;
    const head = (t / d.rawDur) * COLS;
    for (let c = 0; c < COLS; c++) {
      const hgt = Math.max(8, (env[c] / peak) * 260);
      g.fillStyle = c <= head ? RED : INK;
      g.fillRect(56 + c * colW + 2, 690 - hgt / 2, Math.max(3, colW - 5), hgt);
    }
    const lv = level(t);
    const r = 110;
    const cx = VIDEO_W / 2;
    const cy = 1010;
    for (let k = 1; k <= 3; k++) {
      g.setLineDash([10, 9]);
      g.lineWidth = 4;
      g.strokeStyle = `rgba(17,17,17,${0.6 - k * 0.15})`;
      g.beginPath();
      g.arc(cx, cy, r + k * 26 * (1 + lv * 0.5), 0, Math.PI * 2);
      g.stroke();
    }
    g.setLineDash([]);
    g.fillStyle = INK;
    g.beginPath(); g.arc(cx + 10, cy + 10, r, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = RED;
    g.beginPath(); g.arc(cx, cy, r - 5, 0, Math.PI * 2); g.fill();
    // mic glyph
    g.fillStyle = INK;
    g.fillRect(cx - 18, cy - 52, 36, 66);
    g.lineWidth = 9;
    g.strokeStyle = INK;
    g.beginPath(); g.arc(cx, cy - 4, 40, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.fillRect(cx - 4, cy + 34, 8, 22);
  }

  function after(t: number, bt: number): void {
    title('WHAT CAME', 'OUT', bt / bandDur);
    const size = 184;
    const gap = 28;
    const x0 = (VIDEO_W - (size * 3 + gap * 2)) / 2;
    PADS.forEach((pad, i) => {
      let last = -Infinity;
      for (const e of d.events) {
        if (e.t > t) break;
        if (e.pad === pad.id) last = e.t;
      }
      const glow = Number.isFinite(last) ? Math.exp(-(t - last) / 0.16) : 0;
      const on = present.has(pad.id);
      const x = x0 + (i % 3) * (size + gap);
      const y = 560 + Math.floor(i / 3) * (size + gap);
      g.globalAlpha = on ? 1 : 0.3;
      box(x, y, size, size, glow > 0.35 ? RED : WHITE, on ? 10 * Math.max(0.3, glow) : 0);
      g.globalAlpha = 1;
      g.textAlign = 'center';
      g.font = LABEL(34);
      g.fillStyle = on ? INK : GRAPHITE;
      g.fillText(pad.label, x + size / 2, y + size / 2 + 12);
    });
    const step = Math.floor(bt / sd);
    const bar = Math.min(d.bars - 1, Math.floor(step / STEPS_PER_BAR));
    for (let s = 0; s < 16; s++) {
      const x = 64 + s * 37.5;
      g.fillStyle = INK;
      g.fillRect(x, 1022, 26, 26);
      g.fillStyle = s === step % 16 ? RED : s % 4 === 0 ? MIST : WHITE;
      g.fillRect(x + 3, 1025, 20, 20);
    }
    g.textAlign = 'left';
    g.font = LABEL(30);
    g.fillStyle = GRAPHITE;
    g.fillText(`BAR ${bar + 1} OF ${d.bars}`, 64, 1096);
    if (chords[bar]) {
      g.textAlign = 'right';
      g.font = DISPLAY(72);
      g.fillStyle = INK;
      g.fillText(chords[bar], VIDEO_W - 64, 1110);
    }
  }

  function draw(t: number): void {
    g.fillStyle = PAPER;
    g.fillRect(0, 0, VIDEO_W, VIDEO_H);
    // grille + drum-pad squares in the corners
    g.fillStyle = INK;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { g.beginPath(); g.arc(70 + i * 16, 70 + j * 16, 3, 0, Math.PI * 2); g.fill(); }
    g.fillRect(VIDEO_W - 112, 64, 28, 28);
    g.fillStyle = RED;
    g.fillRect(VIDEO_W - 84, 92, 28, 28);
    const isBefore = t < d.rawDur;
    if (isBefore) before(t);
    else after(t, Math.min(bandDur, t - d.rawDur));
    if (d.rawDur > 0 && t >= d.rawDur && t < d.rawDur + 0.4) {
      // a red slab sweeps across at the switch
      const k = (t - d.rawDur) / 0.4;
      g.fillStyle = RED;
      g.beginPath();
      const x = -400 + k * (VIDEO_W + 800);
      g.moveTo(x, 0); g.lineTo(x + 300, 0); g.lineTo(x + 100, VIDEO_H); g.lineTo(x - 200, VIDEO_H);
      g.fill();
    }
    if (d.watermark) {
      g.textAlign = 'center';
      g.font = LABEL(30);
      g.fillStyle = INK;
      g.fillText('MADE WITH MOUTHBAND', VIDEO_W / 2, 1222);
    }
  }

  return { draw };
}
