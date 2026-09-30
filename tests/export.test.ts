import { describe, expect, it } from 'vitest';
import { projectToMidi, vlq } from '../src/audio/midi';
import { encodeWav } from '../src/audio/wav';
import { demoProject } from '../src/model/demo';

const str = (b: Uint8Array, o: number, n: number): string => String.fromCharCode(...b.slice(o, o + n));

describe('WAV export', () => {
  it('writes a valid 16-bit stereo header and samples', () => {
    const l = new Float32Array([0, 1, -1, 0.5]);
    const r = new Float32Array([0, -1, 1, -0.5]);
    const buf = encodeWav([l, r], 44100);
    const v = new DataView(buf);
    const b = new Uint8Array(buf);
    expect(str(b, 0, 4)).toBe('RIFF');
    expect(str(b, 8, 4)).toBe('WAVE');
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(16);
    expect(v.getInt16(44 + 4, true)).toBe(32767); // l[1]
    expect(v.getInt16(44 + 6, true)).toBe(-32768); // r[1]
    expect(buf.byteLength).toBe(44 + 16);
  });
});

describe('MIDI export', () => {
  it('encodes variable-length quantities', () => {
    expect(vlq(0)).toEqual([0]);
    expect(vlq(127)).toEqual([0x7f]);
    expect(vlq(128)).toEqual([0x81, 0x00]);
    expect(vlq(0x3fff)).toEqual([0xff, 0x7f]);
  });

  it('writes a format-1 file with a tempo track and one track per part', () => {
    const p = demoProject();
    const b = projectToMidi(p);
    expect(str(b, 0, 4)).toBe('MThd');
    const format = (b[8] << 8) | b[9];
    const tracks = (b[10] << 8) | b[11];
    const ppq = (b[12] << 8) | b[13];
    expect(format).toBe(1);
    expect(tracks).toBe(1 + p.tracks.length);
    expect(ppq).toBe(96);
    // walk the chunks
    let o = 14;
    let count = 0;
    while (o < b.length) {
      expect(str(b, o, 4)).toBe('MTrk');
      const len = (b[o + 4] << 24) | (b[o + 5] << 16) | (b[o + 6] << 8) | b[o + 7];
      const end = b.slice(o + 8 + len - 3, o + 8 + len);
      expect(Array.from(end)).toEqual([0xff, 0x2f, 0x00]);
      o += 8 + len;
      count++;
    }
    expect(count).toBe(tracks);
    // tempo: 90 BPM = 666667 µs per quarter
    const i = b.findIndex((x, k) => x === 0xff && b[k + 1] === 0x51);
    expect((b[i + 3] << 16) | (b[i + 4] << 8) | b[i + 5]).toBe(666667);
    // drum notes on channel 10
    expect(b.some((x, k) => x === 0x99 && b[k + 1] === 36)).toBe(true);
  });
});
