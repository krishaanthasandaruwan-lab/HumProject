import { describe, expect, it } from 'vitest';
import { boostQuiet, LevelGate } from '../src/dsp/level';

const SR = 16000;
const tone = (amp: number, sec: number): Float32Array => Float32Array.from({ length: SR * sec }, (_, i) => amp * Math.sin((2 * Math.PI * 220 * i) / SR));
const rms = (x: Float32Array): number => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);

describe('boostQuiet', () => {
  it('lifts soft humming to a level the analysis hears', () => {
    const out = boostQuiet(tone(0.004, 1), SR);
    expect(rms(out)).toBeGreaterThan(0.05);
    expect(Math.max(...out.map(Math.abs))).toBeLessThan(0.99);
  });
  it('leaves a loud take alone', () => {
    const x = tone(0.5, 1);
    expect(boostQuiet(x, SR)).toEqual(x);
  });
  it('never clips a take with one loud spike', () => {
    const x = tone(0.003, 1);
    x[100] = 0.6;
    expect(Math.max(...boostQuiet(x, SR).map(Math.abs))).toBeLessThanOrEqual(0.98 + 1e-6);
  });
});

describe('LevelGate', () => {
  it('hears soft humming over a quiet room, and not the room itself', () => {
    const g = new LevelGate();
    const dt = 1 / 60;
    for (let i = 0; i < 60; i++) g.update(0.0006, dt); // room noise
    expect(g.update(0.0006, dt).loud).toBe(false);
    let heard = 0;
    for (let i = 0; i < 120; i++) if (g.update(0.004, dt).loud) heard++; // soft hum, ~16 dB over the room
    expect(heard).toBeGreaterThan(100);
    expect(g.update(0.0007, dt).loud).toBe(false); // back to the room
  });
});
