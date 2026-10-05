import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerInfo } from '@revenuecat/purchases-capacitor';
import { verifiedPro } from '../src/pro/verification';
import { releaseProblems } from '../scripts/release-config';
const info = (verification = 'VERIFIED', product = 'humm_pro', active = true): CustomerInfo => ({
  entitlements: { verification, active: { pro: { isActive: active, productIdentifier: product, verification } }, all: {} },
}) as unknown as CustomerInfo;

describe('store entitlement trust', () => {
  it('accepts a verified active Pro product', () => expect(verifiedPro(info(), 'pro', 'humm_pro')).toBe(true));
  it('accepts StoreKit on-device verification', () => expect(verifiedPro(info('VERIFIED_ON_DEVICE'), 'pro', 'humm_pro')).toBe(true));
  it.each(['FAILED', 'NOT_REQUESTED', 'UNEXPECTED'])('rejects %s responses', (status) => expect(verifiedPro(info(status), 'pro', 'humm_pro')).toBe(false));
  it('rejects a failed entitlement even inside verified CustomerInfo', () => {
    const value = info();
    const changed = { ...value, entitlements: { ...value.entitlements, active: { pro: { ...value.entitlements.active.pro, verification: 'FAILED' } } } } as unknown as CustomerInfo;
    expect(verifiedPro(changed, 'pro', 'humm_pro')).toBe(false);
  });
  it('rejects inactive and unrelated products', () => {
    expect(verifiedPro(info('VERIFIED', 'humm_pro', false), 'pro', 'humm_pro')).toBe(false);
    expect(verifiedPro(info('VERIFIED', 'monthly'), 'pro', 'humm_pro')).toBe(false);
  });
});
describe('release configuration', () => {
  const env = { VITE_REVENUECAT_IOS_KEY: 'appl_1234567890abcdef', VITE_SUPPORT_EMAIL: 'support@hummmusic.app', VITE_PRIVACY_POLICY_URL: 'https://hummmusic.app/privacy', VITE_DEV_PRO: 'false' };
  it('accepts complete configuration syntax', () => expect(releaseProblems(env)).toEqual([]));
  it('rejects missing owner details, fake keys, and test unlock flags', () => {
    expect(releaseProblems({})).toHaveLength(3);
    expect(releaseProblems({ ...env, VITE_REVENUECAT_IOS_KEY: 'appl_xxxxxxxxxxxx', VITE_DEV_PRO: 'true' })).toHaveLength(2);
  });
  it('rejects local or insecure policy addresses', () => {
    expect(releaseProblems({ ...env, VITE_PRIVACY_POLICY_URL: 'http://hummmusic.app/privacy' })).not.toEqual([]);
    expect(releaseProblems({ ...env, VITE_PRIVACY_POLICY_URL: 'https://localhost/privacy' })).not.toEqual([]);
  });
});
describe('production local unlocks', () => {
  beforeEach(() => { vi.resetModules(); vi.stubEnv('DEV', false); vi.stubEnv('MODE', 'production'); });
  it('ignores forged tester and developer storage values', async () => {
    vi.stubGlobal('localStorage', { getItem: () => '1', setItem: vi.fn(), removeItem: vi.fn() });
    const pro = await import('../src/pro/pro');
    expect(pro.isPro()).toBe(false);
    expect(pro.redeemTesterCode('HUMM-7KQ2-PRO')).toBe(false);
    expect(pro.TESTER_BUILD).toBe(false);
    pro.setDevPro(true);
    expect(localStorage.setItem).not.toHaveBeenCalled();
    vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });
});
