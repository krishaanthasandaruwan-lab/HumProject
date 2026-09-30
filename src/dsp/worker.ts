// Web Worker: runs the heavy analysis off the UI thread.
import { DSP, type DspApi } from './api';

interface Req {
  id: number;
  kind: keyof DspApi;
  input: unknown;
}

self.addEventListener('message', (e: MessageEvent<Req>) => {
  const { id, kind, input } = e.data;
  try {
    const run = DSP[kind] as (i: unknown) => unknown;
    self.postMessage({ id, result: run(input) });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
});
