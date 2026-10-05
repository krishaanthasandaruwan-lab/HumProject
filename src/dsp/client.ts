// A classic bundled worker supports iOS 15 and keeps expensive DSP off the UI thread.
import type { DspApi } from './api';
type Kind = keyof DspApi;
type In<K extends Kind> = Parameters<DspApi[K]>[0];
type Out<K extends Kind> = ReturnType<DspApi[K]>;
interface Pending { resolve: (v: unknown) => void; reject: (e: Error) => void; cleanup: () => void }
let worker: Worker | undefined;
let seq = 0;
const pending = new Map<number, Pending>();
export interface DspOptions { signal?: AbortSignal; timeoutMs?: number }

function stopWorker(error: Error): void {
  worker?.terminate();
  worker = undefined;
  for (const job of pending.values()) { job.cleanup(); job.reject(error); }
  pending.clear();
}
function getWorker(): Worker {
  if (worker) return worker;
  const w = import.meta.env.DEV
    ? new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    : new Worker(new URL('./worker.ts', import.meta.url));
  w.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
    const job = pending.get(e.data.id);
    if (!job) return;
    pending.delete(e.data.id);
    job.cleanup();
    if (e.data.error) job.reject(new Error(e.data.error));
    else job.resolve(e.data.result);
  };
  w.onerror = (e) => stopWorker(new Error(e.message || 'Audio analysis failed. Please try again.'));
  w.onmessageerror = () => stopWorker(new Error('Audio analysis could not be received.'));
  return worker = w;
}
export function runDsp<K extends Kind>(kind: K, input: In<K>, options: DspOptions = {}): Promise<Out<K>> {
  if (options.signal?.aborted) return Promise.reject(new DOMException('Audio processing cancelled', 'AbortError'));
  return new Promise<Out<K>>((resolve, reject) => {
    let w: Worker;
    try { w = getWorker(); } catch { reject(new Error('This browser cannot process audio. Please use the HUMM app.')); return; }
    const id = ++seq;
    const abort = (): void => stopWorker(new DOMException('Audio processing cancelled', 'AbortError'));
    const timer = setTimeout(() => stopWorker(new Error('Audio processing took too long. Try a shorter recording.')), options.timeoutMs ?? (kind === 'voice' ? 90_000 : 60_000));
    const cleanup = (): void => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); };
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, cleanup });
    options.signal?.addEventListener('abort', abort, { once: true });
    try { w.postMessage({ id, kind, input }); } catch (error) {
      pending.delete(id); cleanup(); reject(error);
    }
  });
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') stopWorker(new DOMException('Audio processing interrupted', 'AbortError'));
});
