// Main-thread handle to the DSP worker. Falls back to running inline (after a yield) if
// module workers are unavailable.
import type { DspApi } from './api';

type Kind = keyof DspApi;
type In<K extends Kind> = Parameters<DspApi[K]>[0];
type Out<K extends Kind> = ReturnType<DspApi[K]>;

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

let worker: Worker | null | undefined;
let seq = 0;
const pending = new Map<number, Pending>();

function failAll(message: string): void {
  for (const p of pending.values()) p.reject(new Error(message));
  pending.clear();
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(e.data.result);
    };
    w.onerror = (e) => {
      failAll(e.message || 'Audio analysis failed');
      w.terminate();
      worker = null;
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

export async function runDsp<K extends Kind>(kind: K, input: In<K>): Promise<Out<K>> {
  const w = getWorker();
  if (!w) {
    const { DSP } = await import('./api');
    await new Promise((r) => setTimeout(r, 0));
    return (DSP[kind] as (i: In<K>) => Out<K>)(input);
  }
  return new Promise<Out<K>>((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ id, kind, input });
  });
}
