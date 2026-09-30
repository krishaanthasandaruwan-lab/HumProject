// Standard MIDI File, format 1, written by hand: a tempo track + one track per part.
import { totalSteps, type Project, type Track } from '../model/project';

const PPQ = 96; // ticks per quarter note -> 24 per 16th
const TICKS_PER_STEP = PPQ / 4;
const GM_DRUM: Record<string, number> = { kick: 36, snare: 38, hat: 42 };
const GM_PROGRAM: Record<string, number> = { bass: 38, lead: 80, keys: 4, pad: 88 }; // Synth Bass 1, Square Lead, E-Piano, New Age Pad

/** Variable-length quantity. */
export function vlq(n: number): number[] {
  let v = Math.max(0, Math.round(n));
  const bytes = [v & 0x7f];
  while ((v >>= 7) > 0) bytes.unshift((v & 0x7f) | 0x80);
  return bytes;
}

function chunk(id: string, data: number[]): number[] {
  const len = data.length;
  return [...id].map((c) => c.charCodeAt(0)).concat([(len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255], data);
}

function text(type: number, s: string): number[] {
  const bytes = [...new TextEncoder().encode(s)];
  return [0xff, type, ...vlq(bytes.length), ...bytes];
}

interface Ev { tick: number; data: number[]; order: number }

function trackChunk(name: string, events: Ev[]): number[] {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const out: number[] = [0, ...text(0x03, name)];
  let last = 0;
  for (const e of events) {
    out.push(...vlq(e.tick - last), ...e.data);
    last = e.tick;
  }
  out.push(0, 0xff, 0x2f, 0x00);
  return chunk('MTrk', out);
}

function partEvents(t: Track, channel: number, steps: number): Ev[] {
  const ev: Ev[] = [];
  const vel = (v: number): number => Math.max(1, Math.min(127, Math.round(v * 127)));
  if (t.kind === 'drums') {
    for (const h of t.hits ?? []) {
      if (h.step >= steps) continue;
      const tick = h.step * TICKS_PER_STEP;
      ev.push({ tick, data: [0x99, GM_DRUM[h.type], vel(h.velocity)], order: 1 });
      ev.push({ tick: tick + TICKS_PER_STEP / 2, data: [0x89, GM_DRUM[h.type], 0], order: 0 });
    }
  } else {
    ev.push({ tick: 0, data: [0xc0 | channel, GM_PROGRAM[t.preset] ?? 80], order: -1 });
    for (const n of t.notes ?? []) {
      if (n.start >= steps) continue;
      const on = n.start * TICKS_PER_STEP;
      const off = Math.min(steps, n.start + n.length) * TICKS_PER_STEP - 1;
      ev.push({ tick: on, data: [0x90 | channel, n.midi, vel(n.velocity)], order: 1 });
      ev.push({ tick: Math.max(on + 1, off), data: [0x80 | channel, n.midi, 0], order: 0 });
    }
  }
  return ev;
}

export function projectToMidi(p: Project): Uint8Array<ArrayBuffer> {
  const steps = totalSteps(p);
  const usPerQuarter = Math.round(60_000_000 / p.bpm);
  const tempo: Ev[] = [
    { tick: 0, data: [0xff, 0x51, 0x03, (usPerQuarter >> 16) & 255, (usPerQuarter >> 8) & 255, usPerQuarter & 255], order: 0 },
    { tick: 0, data: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08], order: 0 },
    { tick: steps * TICKS_PER_STEP, data: [0xff, 0x06, 0x03, 0x45, 0x6e, 0x64], order: 0 }, // marker "End"
  ];
  const parts = p.tracks.filter((t) => (t.hits?.length ?? 0) + (t.notes?.length ?? 0) > 0);
  let ch = 0;
  const chunks = [trackChunk(p.name, tempo)];
  for (const t of parts) {
    const channel = t.kind === 'drums' ? 9 : ch++;
    if (ch === 9) ch++;
    chunks.push(trackChunk(t.kind, partEvents(t, channel, steps)));
  }
  const header = chunk('MThd', [0, 1, 0, chunks.length, (PPQ >> 8) & 255, PPQ & 255]);
  return new Uint8Array([...header, ...chunks.flat()]);
}
