import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ silentContexts: 0, contexts: [] as any[], nodes: [] as any[], streams: [] as any[], reset: vi.fn(), unlock: vi.fn() }));
vi.mock('../src/audio/context', () => ({
  getCtx: () => fixture.contexts.at(-1),
  unlockAudio: async () => { fixture.unlock(); const ctx = fixture.contexts.at(-1); ctx.state = 'running'; return ctx; },
  setAudioSession: vi.fn(),
  resetAudioContext: () => { fixture.reset(); fixture.contexts.at(-1).state = 'closed'; fixture.contexts.push(makeContext()); },
}));
function makeContext(): any {
  const node = (): any => ({ disconnect: vi.fn(), connect: vi.fn(function(this: any, to: any) { return to; }), gain: { value: 1 } });
  return { state: 'running', currentTime: 0, sampleRate: 48000, destination: node(), audioWorklet: { addModule: vi.fn(async () => {}) }, createMediaStreamSource: node, createGain: node, createAnalyser: node };
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); fixture.silentContexts = 0; fixture.contexts = [makeContext()]; fixture.nodes = []; fixture.streams = [];
  const document = new EventTarget(); Object.assign(document, { hidden: false, visibilityState: 'visible' });
  vi.stubGlobal('document', document); vi.stubGlobal('window', { setTimeout, isSecureContext: true });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => {
    const track = { readyState: 'live', stop: vi.fn(function(this: any) { this.readyState = 'ended'; }) };
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] }; fixture.streams.push(stream); return stream;
  }) } });
  vi.stubGlobal('AudioWorkletNode', class {
    port = { onmessage: null as any, postMessage: (message: string) => {
      if (message === 'start' && fixture.contexts.length > fixture.silentContexts) setTimeout(() => this.port.onmessage?.({ data: { frame: 0, data: new Float32Array(2048) } }), 30);
    } };
    onprocessorerror: any;
    disconnect = vi.fn(); connect = vi.fn((to: any) => to);
    constructor() { fixture.nodes.push(this); }
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('waits for actual input frames, including silence, before opening', async () => {
  const { MicRecorder } = await import('../src/audio/recorder');
  let opened = false;
  const job = MicRecorder.open().then((mic) => { opened = true; return mic; });
  await vi.advanceTimersByTimeAsync(20); expect(opened).toBe(false);
  await vi.advanceTimersByTimeAsync(20); const mic = await job;
  expect(mic.receiving()).toBe(true); expect(fixture.unlock).toHaveBeenCalledTimes(2);
  mic.close(); expect(fixture.streams[0].getTracks()[0].stop).toHaveBeenCalledOnce();
});
it('recreates a stalled context once, closes the old mic, and captures on retry', async () => {
  fixture.silentContexts = 1;
  const { MicRecorder } = await import('../src/audio/recorder');
  const job = MicRecorder.open();
  await vi.advanceTimersByTimeAsync(2600); const mic = await job;
  expect(fixture.reset).toHaveBeenCalledOnce(); expect(fixture.contexts).toHaveLength(2);
  expect(fixture.streams[0].getTracks()[0].readyState).toBe('ended'); expect(mic.receiving()).toBe(true); mic.close();
});
it('reports a permanently stalled mic and releases both attempted streams', async () => {
  fixture.silentContexts = 2;
  const { MicRecorder } = await import('../src/audio/recorder');
  const outcome = MicRecorder.open().then(() => null, (error) => error);
  await vi.advanceTimersByTimeAsync(5100);
  expect((await outcome).message).toContain('isn’t receiving audio');
  expect(fixture.reset).toHaveBeenCalledOnce(); expect(fixture.streams.every((s) => s.getTracks()[0].readyState === 'ended')).toBe(true);
});
it('cancels startup without retrying or keeping the microphone active', async () => {
  fixture.silentContexts = 2;
  const { MicRecorder } = await import('../src/audio/recorder');
  const abort = new AbortController();
  const outcome = MicRecorder.open(abort.signal).then(() => null, (error) => error);
  await vi.advanceTimersByTimeAsync(5); abort.abort();
  await vi.advanceTimersByTimeAsync(5);
  expect((await outcome).name).toBe('AbortError'); expect(fixture.reset).not.toHaveBeenCalled();
  expect(fixture.streams[0].getTracks()[0].readyState).toBe('ended');
});
it('detects a disconnected stream after capture starts', async () => {
  const { MicRecorder } = await import('../src/audio/recorder');
  const job = MicRecorder.open(); await vi.advanceTimersByTimeAsync(40); const mic = await job;
  expect(mic.receiving()).toBe(true); fixture.streams[0].getTracks()[0].stop();
  expect(mic.receiving()).toBe(false); mic.close();
});
