// Humming accuracy. `BENCH=1 npx vitest run tests/humBench.test.ts` prints the note error rate per
// kind of singer; the normal run checks a smaller set stays under the limits.
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { bench } from './humBench';

describe('humming accuracy', () => {
  it('gets nearly every note right, whatever kind of singer', () => {
    const r = bench(3, 40);
    for (const [kind, err] of Object.entries(r)) expect(err, kind).toBeLessThan(0.15);
  }, 120000);

  it.skipIf(!process.env.BENCH)('benchmark', () => {
    const r = bench(Number(process.env.BENCH_RUNS ?? 12));
    console.log(JSON.stringify(r));
    if (process.env.BENCH_OUT) writeFileSync(process.env.BENCH_OUT, JSON.stringify(r));
  }, 900000);
});
