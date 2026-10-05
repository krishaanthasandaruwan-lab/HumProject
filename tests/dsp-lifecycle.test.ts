import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let workers: { terminate: ReturnType<typeof vi.fn>; postMessage: ReturnType<typeof vi.fn>; onmessage?: (e: { data: unknown }) => void }[];
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); workers = [];
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('Worker', class { terminate = vi.fn(); postMessage = vi.fn(); constructor() { workers.push(this); } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const input = { audio: new Float32Array(10), sampleRate: 48000, kind: 'lead' as const };
it('terminates processing on cancellation and starts a fresh worker afterward', async () => {
  const { runDsp } = await import('../src/dsp/client');
  const cancel = new AbortController();
  const job = runDsp('free', input, { signal: cancel.signal });
  const rejected = expect(job).rejects.toMatchObject({ name: 'AbortError' });
  cancel.abort(); await rejected;
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  const next = runDsp('free', input);
  const id = workers[1].postMessage.mock.calls[0][0].id;
  workers[1].onmessage?.({ data: { id, result: { notes: [] } } });
  expect(await next).toEqual({ notes: [] });
  expect(vi.getTimerCount()).toBe(0);
});
it('has a deadline when a worker never responds', async () => {
  const { runDsp } = await import('../src/dsp/client');
  const job = runDsp('free', input, { timeoutMs: 50 });
  const rejected = expect(job).rejects.toThrow('too long');
  await vi.advanceTimersByTimeAsync(50); await rejected;
  expect(workers[0].terminate).toHaveBeenCalledOnce();
});
