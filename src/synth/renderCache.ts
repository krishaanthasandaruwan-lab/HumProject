// Rendered voices on the main thread. Buffers are rendered ahead of time in the DSP worker
// (prepareSounds) and cached per instrument + pitch; a single audition note may render inline.
// If a note is needed before its buffer exists, the caller plays a stand-in voice instead, so the
// scheduler never stalls.
import { monoBuffer } from '../audio/context';
import { runDsp } from '../dsp/client';
import { RENDERED } from './rendered';
import { mtof } from './fx';

const MAX = 160;
const cache = new Map<string, AudioBuffer>();
const inFlight = new Map<string, Promise<void>>();
const key = (id: string, midi: number): string => `${id}:${midi}`;

function store(id: string, midi: number, data: Float32Array, sampleRate: number): AudioBuffer {
  const buf = monoBuffer(data, sampleRate);
  cache.set(key(id, midi), buf);
  while (cache.size > MAX) cache.delete(cache.keys().next().value as string);
  return buf;
}

/** Forget every rendered note (they are made again when needed). */
export function clearRenderCache(): void {
  cache.clear();
}

export function cachedBuffer(id: string, midi: number): AudioBuffer | null {
  const k = key(id, midi);
  const b = cache.get(k);
  if (b) {
    cache.delete(k); // keep recently used entries at the end (LRU)
    cache.set(k, b);
  }
  return b ?? null;
}

/** Render one note right here (≈10 ms) — for tapping an instrument to hear it. */
export function renderNow(id: string, midi: number, sampleRate: number): AudioBuffer | null {
  const spec = RENDERED[id];
  if (!spec) return null;
  return cachedBuffer(id, midi) ?? store(id, midi, spec.render(sampleRate, mtof(midi)), sampleRate);
}

/** Make sure every (instrument, pitch) pair has a buffer; renders the missing ones in the worker. */
export async function prepareSounds(items: { id: string; midi: number }[], sampleRate: number): Promise<void> {
  const want = new Map<string, { id: string; midi: number }>();
  const waits: Promise<void>[] = [];
  for (const it of items) {
    if (!RENDERED[it.id]) continue;
    const k = key(it.id, it.midi);
    if (cache.has(k)) continue;
    const busy = inFlight.get(k);
    if (busy) waits.push(busy);
    else want.set(k, it);
  }
  if (want.size) {
    const list = [...want.values()];
    const job = runDsp('render', { items: list, sampleRate }).then((datas) => {
      datas.forEach((d, i) => store(list[i].id, list[i].midi, d, sampleRate));
    });
    const done = job.finally(() => list.forEach((it) => inFlight.delete(key(it.id, it.midi))));
    list.forEach((it) => inFlight.set(key(it.id, it.midi), done));
    waits.push(done);
  }
  await Promise.all(waits);
}
