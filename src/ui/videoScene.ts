// The 9:16 "what I recorded → what came out" video, drawn frame by frame on a canvas.
import { keyName } from '../dsp/key';
import { STEPS_PER_BAR, stepDur, swingOffset, totalSteps, type Project } from '../model/project';

export type PadId = 'kick' | 'snare' | 'hat' | 'bass' | 'lead' | 'chords';
export interface SceneEvent { t: number; pad: PadId }
export const VIDEO_W = 720;
export const VIDEO_H = 1280;

const PADS: { id: PadId; label: string; color: string; emoji: string }[] = [
  { id: 'kick', label: 'KICK', color: '#ff7a45', emoji: '🥁' },
  { id: 'snare', label: 'SNARE', color: '#3ec5ff', emoji: '👏' },
  { id: 'hat', label: 'HI-HAT', color: '#ffd23f', emoji: '✨' },
  { id: 'bass', label: 'BASS', color: '#9b7bff', emoji: '🎸' },
  { id: 'lead', label: 'LEAD', color: '#ff4d9d', emoji: '🎹' },
  { id: 'chords', label: 'CHORDS', color: '#3ddc97', emoji: '🎶' },
];

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

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function createScene(canvas: HTMLCanvasElement, d: SceneData): { draw(t: number): void } {
  canvas.width = VIDEO_W;
  canvas.height = VIDEO_H;
  const g = canvas.getContext('2d') as CanvasRenderingContext2D;
  const p = d.project;
  const sd = stepDur(p.bpm);
  const bandDur = d.bars * STEPS_PER_BAR * sd;
  const COLS = 90;
  const env = new Float32Array(COLS);
  const per = Math.max(1, Math.floor(d.wave.length / COLS));
  for (let c = 0; c < COLS; c++) {
    let m = 0;
    for (let i = c * per; i < Math.min(d.wave.length, (c + 1) * per); i++) m = Math.max(m, Math.abs(d.wave[i]));
    env[c] = m;
  }
  const present = new Set<PadId>(d.events.map((e) => e.pad));
  const chords = p.tracks.find((t) => t.kind === 'chords')?.labels ?? [];
  const sub = `${Math.round(p.bpm)} BPM${p.key ? ` · ${keyName(p.key)}` : ''}`;
  const font = (px: number, weight = 800): string => `${weight} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  function level(t: number): number {
    const c = Math.round(t * d.sampleRate);
    let s = 0;
    const n = Math.round(0.04 * d.sampleRate);
    for (let i = Math.max(0, c - n); i < Math.min(d.wave.length, c + n); i++) s += d.wave[i] * d.wave[i];
    return Math.min(1, Math.sqrt(s / (2 * n)) * 3);
  }

  function header(title: string, frac: number, accent: string): void {
    g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    g.font = font(52);
    g.fillText(title, VIDEO_W / 2, 170);
    g.font = font(30, 600);
    g.fillStyle = 'rgba(255,255,255,.6)';
    g.fillText(`${p.name} · ${sub}`, VIDEO_W / 2, 225);
    g.fillStyle = 'rgba(255,255,255,.12)';
    roundRect(g, 60, 270, VIDEO_W - 120, 12, 6);
    g.fill();
    g.fillStyle = accent;
    roundRect(g, 60, 270, Math.max(12, (VIDEO_W - 120) * frac), 12, 6);
    g.fill();
  }

  function before(t: number): void {
    header('🎤 What I recorded', t / d.rawDur, '#ff4d6d');
    const x0 = 60;
    const colW = (VIDEO_W - 120) / COLS;
    const head = (t / d.rawDur) * COLS;
    for (let c = 0; c < COLS; c++) {
      const hgt = Math.max(6, env[c] * 380);
      g.fillStyle = c <= head ? '#ff4d6d' : '#3a3f58';
      roundRect(g, x0 + c * colW + 1, 680 - hgt / 2, Math.max(2, colW - 2), hgt, 2);
      g.fill();
    }
    const lv = level(t);
    g.beginPath();
    g.arc(VIDEO_W / 2, 1040, 80 + 70 * lv, 0, Math.PI * 2);
    g.fillStyle = `rgba(255,77,109,${0.18 + 0.3 * lv})`;
    g.fill();
    g.font = font(96, 400);
    g.fillText('🎤', VIDEO_W / 2, 1075);
  }

  function after(t: number, bt: number): void {
    header('🔥 What MouthBand made', bt / bandDur, '#3ddc97');
    const size = 190;
    const gap = 24;
    const x0 = (VIDEO_W - (size * 3 + gap * 2)) / 2;
    PADS.forEach((pad, i) => {
      let last = -Infinity;
      for (const e of d.events) {
        if (e.t > t) break;
        if (e.pad === pad.id) last = e.t;
      }
      const glow = Number.isFinite(last) ? Math.exp(-(t - last) / 0.18) : 0;
      const x = x0 + (i % 3) * (size + gap);
      const y = 400 + Math.floor(i / 3) * (size + gap);
      const s = 1 + 0.06 * glow;
      g.save();
      g.globalAlpha = present.has(pad.id) ? 1 : 0.3;
      g.translate(x + size / 2, y + size / 2);
      g.scale(s, s);
      g.fillStyle = '#1f2333';
      roundRect(g, -size / 2, -size / 2, size, size, 34);
      g.fill();
      g.globalAlpha *= 0.15 + 0.85 * glow;
      g.fillStyle = pad.color;
      roundRect(g, -size / 2, -size / 2, size, size, 34);
      g.fill();
      g.globalAlpha = present.has(pad.id) ? 1 : 0.3;
      g.textAlign = 'center';
      g.font = font(64, 400);
      g.fillText(pad.emoji, 0, 10);
      g.font = font(26);
      g.fillStyle = glow > 0.5 ? '#111' : '#fff';
      g.fillText(pad.label, 0, 70);
      g.restore();
    });
    const step = Math.floor(bt / sd);
    const bar = Math.min(d.bars - 1, Math.floor(step / STEPS_PER_BAR));
    for (let s = 0; s < 16; s++) {
      g.beginPath();
      g.arc(120 + s * 32, 900, s % 4 === 0 ? 9 : 6, 0, Math.PI * 2);
      g.fillStyle = s === step % 16 ? '#ffffff' : 'rgba(255,255,255,.18)';
      g.fill();
    }
    g.textAlign = 'center';
    g.font = font(28, 600);
    g.fillStyle = 'rgba(255,255,255,.6)';
    g.fillText(`Bar ${bar + 1} of ${d.bars}`, VIDEO_W / 2, 965);
    if (chords[bar]) {
      g.font = font(88);
      g.fillStyle = '#3ddc97';
      g.fillText(chords[bar], VIDEO_W / 2, 1090);
    }
  }

  function draw(t: number): void {
    const grad = g.createLinearGradient(0, 0, 0, VIDEO_H);
    const isBefore = t < d.rawDur;
    grad.addColorStop(0, isBefore ? '#251427' : '#10202a');
    grad.addColorStop(1, '#0b0c12');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIDEO_W, VIDEO_H);
    if (isBefore) before(t);
    else after(t, Math.min(bandDur, t - d.rawDur));
    if (d.rawDur > 0 && t >= d.rawDur && t < d.rawDur + 0.35) {
      g.fillStyle = `rgba(255,255,255,${0.55 * (1 - (t - d.rawDur) / 0.35)})`;
      g.fillRect(0, 0, VIDEO_W, VIDEO_H);
    }
    if (d.watermark) {
      g.textAlign = 'center';
      g.font = font(30, 700);
      g.fillStyle = 'rgba(255,255,255,.75)';
      g.fillText('Made with MouthBand 🎤', VIDEO_W / 2, 1215);
    }
  }

  return { draw };
}
