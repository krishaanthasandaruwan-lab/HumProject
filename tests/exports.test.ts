import { beforeEach, describe, expect, it } from 'vitest';
import { setTier } from '../src/pro/pro';
import { canExport, lockedIn, markTool, unmarkTool } from '../src/pro/exports';
import { newProject, newTrack, type Project } from '../src/model/project';

function song(): Project {
  const p = newProject('Song 1');
  const drums = newTrack('drums', 'trap'); // a Pro kit that came with the generated version
  drums.hits = [{ step: 0, type: 'kick', velocity: 1 }];
  const lead = newTrack('lead', 'piano');
  lead.notes = [{ start: 0, length: 4, midi: 60, velocity: 0.8 }];
  p.tracks = [drums, lead];
  return p;
}

beforeEach(() => setTier('free'));
describe('free exports', () => {
  it('exports one of the three free versions, Pro sounds that came with it included', () => {
    expect(canExport(song())).toEqual({ ok: true });
  });

  it('needs Plus for an extra version from More', () => {
    const p = song();
    p.proTools = ['more'];
    const r = canExport(p);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toContain('Extra version'); expect(r.tier).toBe('plus'); }
  });

  it('needs Plus once the person picks a premium sound, not for a free one they pick', () => {
    const p = song();
    p.tracks[1].picked = true; // piano is free
    expect(canExport(p).ok).toBe(true);
    p.tracks[1].preset = 'flute'; // Pro
    expect(lockedIn(p)).toEqual(['Flute']);
    expect(canExport(p).ok).toBe(false);
  });

  it('needs Pro after Tracks or Fix, and not after Undo', () => {
    const p = song();
    expect(markTool(p, 'fix')).toBe(true);
    expect(markTool(p, 'fix')).toBe(false);
    markTool(p, 'tracks');
    const r = canExport(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('Pro is needed to export this song: it uses Tracks and Fix.');
    unmarkTool(p, 'fix');
    unmarkTool(p, 'tracks');
    expect(canExport(p).ok).toBe(true);
  });
});

it('Plus covers creative exports but preserves Pro production locks, including after a downgrade', () => {
  const p = song();
  p.tracks[1].picked = true; p.tracks[1].preset = 'flute';
  p.proTools = ['more', 'fx'];
  setTier('plus');
  expect(canExport(p)).toEqual({ ok: true });
  markTool(p, 'tracks'); markTool(p, 'fix');
  expect(canExport(p)).toMatchObject({ ok: false, tier: 'pro' });
  setTier('pro'); expect(canExport(p)).toEqual({ ok: true });
  setTier('plus'); expect(canExport(p)).toMatchObject({ ok: false, tier: 'pro' });
  unmarkTool(p, 'tracks'); unmarkTool(p, 'fix');
  setTier('free'); expect(canExport(p)).toMatchObject({ ok: false, tier: 'plus' });
});
