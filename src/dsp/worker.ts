// Web Worker: runs the heavy analysis off the UI thread.
import { DSP, type DspApi } from './api';

interface Req {
  id: number;
  kind: keyof DspApi;
  input: unknown;
}

/** Audio results (a Float32Array or a list of them) are moved to the UI thread, not copied. */
function transferables(v: unknown): Transferable[] {
  const out = new Set<ArrayBuffer>();
  for (const x of Array.isArray(v) ? v : [v]) if (ArrayBuffer.isView(x) && x.buffer instanceof ArrayBuffer) out.add(x.buffer);
  return [...out];
}

self.addEventListener('message', (e: MessageEvent<Req>) => {
  const { id, kind, input } = e.data;
  try {
    const run = DSP[kind] as (i: unknown) => unknown;
    const result = run(input);
    self.postMessage({ id, result }, { transfer: transferables(result) });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
});
