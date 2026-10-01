import { describe, expect, it } from 'vitest';
import { beatIndex, beatMatch, beatTime, makeStepMap, type TimedEvent } from '../src/dsp/tempo';

/** Events at given 16th steps (repeated per bar) for a tempo curve bpmAt(beat). */
function performance(stepsPerBar: [number, number][], bars: number, start: number, bpmAt: (beat: number) => number): { events: TimedEvent[]; steps: number[] } {
  const times: number[] = [];
  let t = start;
  for (let s = 0; s <= bars * 16; s++) {
    times.push(t);
    t += 60 / bpmAt(s / 4) / 4;
  }
  const events: TimedEvent[] = [];
  const steps: number[] = [];
  for (let b = 0; b < bars; b++) {
    for (const [s, w] of stepsPerBar) {
      events.push({ time: times[b * 16 + s], weight: w });
      steps.push(b * 16 + s);
    }
  }
  return { events, steps };
}

const DRUMS: [number, number][] = [[0, 1], [2, 0.4], [4, 0.9], [6, 0.4], [8, 1], [10, 0.4], [12, 0.9], [14, 0.4]];
const TUNE: [number, number][] = [[0, 1], [3, 0.5], [4, 0.8], [6, 0.6], [8, 1], [12, 0.7], [14, 0.4]];

function expectOnGrid(events: TimedEvent[], steps: number[], map: (t: number) => number, tol = 0.3): void {
  events.forEach((e, i) => {
    expect(Math.abs(map(e.time) - steps[i]), `event ${i} at step ${steps[i]}`).toBeLessThan(tol);
  });
}

describe('beat matching', () => {
  it('finds a steady 95 BPM groove and its downbeat', () => {
    const { events, steps } = performance(DRUMS, 4, 0.43, () => 95);
    const g = beatMatch(events, 11);
    expect(g.bpm).toBeGreaterThan(93.5);
    expect(g.bpm).toBeLessThan(96.5);
    expectOnGrid(events, steps, makeStepMap(g));
  });

  it('finds the tempo of a hummed rhythm (120 BPM)', () => {
    const { events, steps } = performance(TUNE, 4, 1.1, () => 120);
    const g = beatMatch(events, 10);
    expect(g.bpm).toBeGreaterThan(117);
    expect(g.bpm).toBeLessThan(123);
    expectOnGrid(events, steps, makeStepMap(g));
  });

  it('follows a performer who speeds up from 86 to 100 BPM', () => {
    const { events, steps } = performance(DRUMS, 8, 0.2, (beat) => 86 + (14 * beat) / 32);
    const g = beatMatch(events, 22);
    expect(g.bpm).toBeGreaterThan(86);
    expect(g.bpm).toBeLessThan(100);
    expectOnGrid(events, steps, makeStepMap(g), 0.35);
  });

  it('copes with human timing jitter (±25 ms)', () => {
    const { events, steps } = performance(TUNE, 4, 0.6, () => 100);
    let s = 99;
    const jitter = (): number => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 0.05;
    const loose = events.map((e) => ({ ...e, time: e.time + jitter() }));
    const g = beatMatch(loose, 11);
    expect(Math.abs(g.bpm - 100)).toBeLessThan(3);
    expectOnGrid(loose, steps, makeStepMap(g), 0.4);
  });

  it('keeps a slow 72 BPM melody at 72, not double or half', () => {
    const { events } = performance([[0, 1], [4, 0.8], [8, 1], [12, 0.6]], 4, 0.3, () => 72);
    const g = beatMatch(events, 14);
    expect(g.bpm).toBeGreaterThan(70);
    expect(g.bpm).toBeLessThan(74);
  });

  it('falls back to a default tempo when there is almost nothing to go on', () => {
    const g = beatMatch([{ time: 0.5, weight: 1 }], 4);
    expect(g.bpm).toBe(90);
    expect(g.confidence).toBe(0);
    expect(makeStepMap(g)(0.5)).toBeCloseTo(0);
  });

  it('maps beat index and time back and forth, extrapolating past the ends', () => {
    const beats = [1, 1.5, 2.1, 2.6];
    for (const i of [-1.5, 0, 0.25, 1.5, 2.9, 4.2]) expect(beatIndex(beats, beatTime(beats, i))).toBeCloseTo(i, 6);
  });
});
