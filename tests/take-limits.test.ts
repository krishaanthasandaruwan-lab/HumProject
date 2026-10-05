import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const capture = vi.hoisted(() => ({ ctx: { currentTime: 0, sampleRate: 48000 }, mic: { start: vi.fn(), stop: vi.fn(), close: vi.fn(), inputLatency: () => 0, extract: vi.fn(() => new Float32Array(1)) } }));
vi.mock('../src/audio/context', () => ({ unlockAudio: async () => capture.ctx, getMaster: vi.fn(), outputLatency: () => 0, setAudioSession: vi.fn() }));
vi.mock('../src/audio/recorder', () => ({ MicRecorder: { open: async () => capture.mic } }));
vi.mock('../src/audio/metronome', () => ({ CLICK_HZ: {}, planTake: () => ({ recStart: 1, recEnd: 400 }), Metronome: class { schedule() {} stop() {} } }));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('document', { visibilityState: 'visible' }); capture.ctx.currentTime = 0; });
afterEach(() => vi.unstubAllGlobals());
it.each([60, 180])('stops Studio recording at the %s second product limit', async (maxSeconds) => {
  const { captureTake } = await import('../src/audio/take');
  let duration = 0;
  await captureTake({ bpm: 50, bars: 96, clickDuringTake: false, manualLatencyMs: 0, maxSeconds,
    onPlan: (plan) => { duration = plan.recEnd - plan.recStart; capture.ctx.currentTime = plan.recEnd + 1; },
  });
  expect(duration).toBe(maxSeconds); expect(capture.mic.close).toHaveBeenCalledOnce();
});
