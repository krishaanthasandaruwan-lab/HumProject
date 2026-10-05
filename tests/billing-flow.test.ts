import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CustomerInfo } from '@revenuecat/purchases-capacitor';
const sdk = vi.hoisted(() => ({ configure: vi.fn(), addCustomerInfoUpdateListener: vi.fn(), getCustomerInfo: vi.fn(), invalidateCustomerInfoCache: vi.fn(), getOfferings: vi.fn(), purchasePackage: vi.fn(), restorePurchases: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios', isNativePlatform: () => true } }));
vi.mock('@revenuecat/purchases-capacitor', () => ({ Purchases: sdk, ENTITLEMENT_VERIFICATION_MODE: { INFORMATIONAL: 'INFORMATIONAL' } }));
const info = (verification = 'VERIFIED', active = true): CustomerInfo => ({ entitlements: {
  verification, active: active ? { pro: { verification, isActive: true, productIdentifier: 'humm_pro' } } : {}, all: {},
} }) as unknown as CustomerInfo;
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.stubEnv('VITE_REVENUECAT_IOS_KEY', 'appl_unit_test');
  vi.stubEnv('DEV', false); vi.stubEnv('MODE', 'production');
  vi.stubGlobal('document', new EventTarget());
  sdk.getCustomerInfo.mockResolvedValue({ customerInfo: info() });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('configures verification once and revokes Pro on a failed signed update', async () => {
  const billing = await import('../src/pro/billing'); const pro = await import('../src/pro/pro');
  await Promise.all([billing.initBilling(), billing.initBilling()]);
  expect(sdk.configure).toHaveBeenCalledExactlyOnceWith({ apiKey: 'appl_unit_test', entitlementVerificationMode: 'INFORMATIONAL' });
  expect(pro.isPro()).toBe(true);
  sdk.addCustomerInfoUpdateListener.mock.calls[0][0](info('FAILED'));
  expect(pro.isPro()).toBe(false);
});
it('refreshes a legacy unverified cache before granting access', async () => {
  sdk.getCustomerInfo.mockResolvedValueOnce({ customerInfo: info('NOT_REQUESTED') }).mockResolvedValueOnce({ customerInfo: info() });
  const billing = await import('../src/pro/billing'); await billing.initBilling();
  expect(sdk.invalidateCustomerInfoCache).toHaveBeenCalledOnce();
  expect((await import('../src/pro/pro')).isPro()).toBe(true);
});
it('preserves already verified session access during a temporary network failure', async () => {
  const billing = await import('../src/pro/billing'); await billing.initBilling();
  sdk.getCustomerInfo.mockRejectedValueOnce(new Error('Offline'));
  expect(await billing.refreshBilling()).toBe(false);
  expect((await import('../src/pro/pro')).isPro()).toBe(true);
});
it('does not sell a different lifetime product or fall back to another package', async () => {
  sdk.getOfferings.mockResolvedValue({ current: { lifetime: { product: { identifier: 'other_product', priceString: '$99.00' } }, availablePackages: [{ product: { identifier: 'humm_pro' } }] } });
  const billing = await import('../src/pro/billing');
  expect(await billing.proPrice()).toBeNull(); expect(await billing.buyPro()).toBe('unavailable');
  expect(sdk.purchasePackage).not.toHaveBeenCalled();
});
it('distinguishes missing purchases from restore errors and failed verification', async () => {
  const billing = await import('../src/pro/billing');
  sdk.restorePurchases.mockResolvedValueOnce({ customerInfo: info('VERIFIED', false) });
  expect(await billing.restorePro()).toBe('not-found');
  sdk.restorePurchases.mockResolvedValueOnce({ customerInfo: info('FAILED') });
  expect(await billing.restorePro()).toBe('error');
  sdk.restorePurchases.mockRejectedValueOnce(new Error('Offline'));
  expect(await billing.restorePro()).toBe('error');
});
it('reports Ask to Buy as pending rather than owned', async () => {
  sdk.getOfferings.mockResolvedValue({ current: { lifetime: { product: { identifier: 'humm_pro', priceString: '$0.99' } } } });
  sdk.getCustomerInfo.mockResolvedValue({ customerInfo: info('VERIFIED', false) });
  sdk.purchasePackage.mockRejectedValue({ code: '20' });
  const billing = await import('../src/pro/billing'); expect(await billing.buyPro()).toBe('pending');
  expect((await import('../src/pro/pro')).isPro()).toBe(false);
});
