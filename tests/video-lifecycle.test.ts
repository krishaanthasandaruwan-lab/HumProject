import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const audio = vi.hoisted(() => ({ ctx: {} as Record<string, unknown>, source: { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }, dest: { stream: {}, disconnect: vi.fn() } }));
vi.mock('../src/audio/context', () => ({ unlockAudio: async () => audio.ctx, getCtx: () => audio.ctx, getMaster: () => ({}) }));
vi.mock('../src/audio/render', () => ({ hasVoice: vi.fn(), renderMix: vi.fn(), voiceMix: vi.fn() }));
type Track = { stop: ReturnType<typeof vi.fn>; kind: string };
let tracks: Track[];
let failConstruction = false;
class Stream {
  constructor(private readonly tracks: Track[]) {}
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter((t) => t.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter((t) => t.kind === 'audio'); }
}
class Recorder {
  static isTypeSupported() { return true; }
  state = 'inactive'; onstop?: () => void;
  constructor() { if (failConstruction) throw new Error('Recorder failed'); }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.onstop?.(); }
}
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers(); failConstruction = false;
  tracks = [{ kind: 'video', stop: vi.fn() }, { kind: 'audio', stop: vi.fn() }];
  audio.dest.stream = new Stream([tracks[1]]);
  audio.ctx = { currentTime: 0, state: 'running', createMediaStreamDestination: () => audio.dest, createBufferSource: () => audio.source };
  vi.stubGlobal('MediaStream', Stream); vi.stubGlobal('MediaRecorder', Recorder);
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
  vi.stubGlobal('window', { setTimeout });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const options = () => ({ canvas: { captureStream: () => new Stream([tracks[0]]) } as unknown as HTMLCanvasElement, draw: vi.fn(), audio: { duration: 1 } as AudioBuffer });
it('releases every stream and audio node if recorder construction fails', async () => {
  failConstruction = true;
  const { recordVideo } = await import('../src/audio/export');
  await expect(recordVideo(options())).rejects.toThrow('Recorder failed');
  expect(tracks.every((t) => t.stop.mock.calls.length > 0)).toBe(true);
  expect(audio.source.disconnect).toHaveBeenCalledOnce(); expect(audio.dest.disconnect).toHaveBeenCalledOnce();
});
it('cleans up a canvas drawing failure before recording starts', async () => {
  const { recordVideo } = await import('../src/audio/export'); const o = options();
  o.draw.mockImplementation(() => { throw new Error('Canvas failed'); });
  await expect(recordVideo(o)).rejects.toThrow('Canvas failed');
  expect(tracks.every((t) => t.stop.mock.calls.length > 0)).toBe(true); expect(vi.getTimerCount()).toBe(0);
});
it('cancels independently of animation frames and releases microphone-free audio streams', async () => {
  const { recordVideo } = await import('../src/audio/export'); const controller = new AbortController();
  const job = recordVideo({ ...options(), signal: controller.signal });
  const rejection = expect(job).rejects.toMatchObject({ name: 'AbortError' });
  await Promise.resolve(); await Promise.resolve(); controller.abort(); await rejection;
  expect(tracks.every((t) => t.stop.mock.calls.length > 0)).toBe(true); expect(vi.getTimerCount()).toBe(0);
});
it('times out when the audio clock and animation frames never advance', async () => {
  const { recordVideo } = await import('../src/audio/export');
  const rejection = expect(recordVideo(options())).rejects.toThrow('too long');
  await vi.advanceTimersByTimeAsync(9000); await rejection;
  expect(tracks.every((t) => t.stop.mock.calls.length > 0)).toBe(true); expect(vi.getTimerCount()).toBe(0);
});
