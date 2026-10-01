import { describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } });

const { endTesterPro, isPro, redeemTesterCode, STORE_READY } = await import('../src/pro/pro');

describe('tester code', () => {
  it('unlocks Pro with the right code only (while the store is not set up)', () => {
    expect(STORE_READY).toBe(false);
    expect(redeemTesterCode('HUMM-0000-PRO')).toBe(false);
    expect(isPro()).toBe(false);
    expect(redeemTesterCode(' humm 7kq2 pro ')).toBe(true);
    expect(isPro()).toBe(true);
    endTesterPro();
    expect(isPro()).toBe(false);
  });
});
