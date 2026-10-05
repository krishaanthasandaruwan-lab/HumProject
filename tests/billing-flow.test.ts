import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CustomerInfo, PurchasesPackage } from '@revenuecat/purchases-capacitor';
const sdk = vi.hoisted(() => ({ configure: vi.fn(), addCustomerInfoUpdateListener: vi.fn(), getCustomerInfo: vi.fn(), invalidateCustomerInfoCache: vi.fn(), getOfferings: vi.fn(), purchasePackage: vi.fn(), restorePurchases: vi.fn(), checkTrialOrIntroductoryPriceEligibility: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios', isNativePlatform: () => true } }));
vi.mock('@revenuecat/purchases-capacitor', () => ({ Purchases: sdk, ENTITLEMENT_VERIFICATION_MODE: { INFORMATIONAL: 'INFORMATIONAL' }, INTRO_ELIGIBILITY_STATUS: { INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2 } }));
const info = (verification = 'VERIFIED', tier: 'free' | 'plus' | 'pro' = 'pro'): CustomerInfo => ({ entitlements: {
  verification, active: tier === 'free' ? {} : { [tier]: { verification, isActive: true, productIdentifier: `humm_${tier}_monthly` } }, all: {},
} }) as unknown as CustomerInfo;
const pkg = (tier = 'pro', trial = false, price = tier === 'plus' ? 1.99 : 4.99): PurchasesPackage => ({
  identifier: tier, product: { identifier: `humm_${tier}_monthly`, subscriptionPeriod: 'P1M', price, priceString: `$${price.toFixed(2)}`, currencyCode: 'USD',
    introPrice: trial ? { price: 0, periodUnit: 'MONTH', periodNumberOfUnits: 3, cycles: 1 } : null },
}) as unknown as PurchasesPackage;
const offerings = (...packages: PurchasesPackage[]) => ({ current: { availablePackages: packages } });
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.stubEnv('VITE_REVENUECAT_IOS_KEY', 'appl_unit_test');
  vi.stubEnv('DEV', false); vi.stubEnv('MODE', 'production');
  vi.stubGlobal('document', new EventTarget());
  sdk.getCustomerInfo.mockResolvedValue({ customerInfo: info('VERIFIED', 'free') });
  sdk.getOfferings.mockResolvedValue(offerings(pkg('plus'), pkg('pro', true)));
  sdk.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({ humm_pro_monthly: { status: 2 } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('configures once, handles Plus/Pro/downgrade, and revokes failed signed updates', async () => {
  sdk.getCustomerInfo.mockResolvedValue({ customerInfo: info() });
  const billing = await import('../src/pro/billing'); const pro = await import('../src/pro/pro');
  await Promise.all([billing.initBilling(), billing.initBilling()]);
  expect(sdk.configure).toHaveBeenCalledExactlyOnceWith({ apiKey: 'appl_unit_test', entitlementVerificationMode: 'INFORMATIONAL' });
  expect(pro.isPro()).toBe(true); expect(pro.isPlus()).toBe(true);
  const update = sdk.addCustomerInfoUpdateListener.mock.calls[0][0];
  update(info('VERIFIED', 'plus'));
  expect(pro.isPro()).toBe(false); expect(pro.isPlus()).toBe(true);
  update(info('VERIFIED', 'free')); expect(pro.currentTier()).toBe('free');
  update(info('FAILED')); expect(pro.currentTier()).toBe('free');
});
it('refreshes a legacy unverified cache before granting access', async () => {
  sdk.getCustomerInfo.mockResolvedValueOnce({ customerInfo: info('NOT_REQUESTED') }).mockResolvedValueOnce({ customerInfo: info() });
  const billing = await import('../src/pro/billing'); await billing.initBilling();
  expect(sdk.invalidateCustomerInfoCache).toHaveBeenCalledOnce();
  expect((await import('../src/pro/pro')).isPro()).toBe(true);
});
it('preserves verified session access during temporary network failure', async () => {
  sdk.getCustomerInfo.mockResolvedValue({ customerInfo: info() });
  const billing = await import('../src/pro/billing'); await billing.initBilling();
  sdk.getCustomerInfo.mockRejectedValueOnce(new Error('Offline'));
  expect(await billing.refreshBilling()).toBe(false);
  expect((await import('../src/pro/pro')).isPro()).toBe(true);
});
it('uses exact monthly products and never substitutes another or a lifetime package', async () => {
  sdk.getOfferings.mockResolvedValue(offerings(pkg('other'), { ...pkg(), product: { ...pkg().product, subscriptionPeriod: null } }));
  const billing = await import('../src/pro/billing');
  expect(await billing.subscriptionPlan('pro')).toBeNull(); expect(await billing.subscriptionPlan('plus')).toBeNull();
  expect(sdk.purchasePackage).not.toHaveBeenCalled();
});
it('uses localized store prices, and only offers the trial to confirmed eligible Pro users', async () => {
  const billing = await import('../src/pro/billing');
  expect(await billing.subscriptionPlan('plus')).toMatchObject({ price: '$1.99', trial: false });
  expect(await billing.subscriptionPlan('pro')).toMatchObject({ price: '$4.99', trial: true });
  sdk.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({ humm_pro_monthly: { status: 1 } });
  expect(await billing.subscriptionPlan('pro')).toMatchObject({ trial: false });
  sdk.checkTrialOrIntroductoryPriceEligibility.mockRejectedValue(new Error('Unknown'));
  expect(await billing.subscriptionPlan('pro')).toMatchObject({ trial: false });
});
it('rejects misconfigured introductory offers instead of showing incorrect purchase terms', async () => {
  const bad = pkg('pro', true);
  sdk.getOfferings.mockResolvedValue(offerings({ ...bad, product: { ...bad.product, introPrice: { ...bad.product.introPrice!, periodNumberOfUnits: 1 } } }));
  const billing = await import('../src/pro/billing'); expect(await billing.subscriptionPlan('pro')).toBeNull();
  sdk.getOfferings.mockResolvedValue(offerings(pkg('plus', true)));
  expect(await billing.subscriptionPlan('plus')).toBeNull();
});
it('requires another explicit confirmation if the price or eligibility changes', async () => {
  const billing = await import('../src/pro/billing');
  const quote = (await billing.subscriptionPlan('pro'))!;
  sdk.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({ humm_pro_monthly: { status: 1 } });
  expect(await billing.buySubscription(quote)).toBe('changed');
  sdk.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({ humm_pro_monthly: { status: 2 } });
  sdk.getOfferings.mockResolvedValue(offerings(pkg('pro', true, 5.99)));
  expect(await billing.buySubscription(quote)).toBe('changed');
  expect(sdk.purchasePackage).not.toHaveBeenCalled();
});
it('purchases the selected package and grants only the verified tier', async () => {
  const billing = await import('../src/pro/billing'); const pro = await import('../src/pro/pro');
  sdk.purchasePackage.mockResolvedValue({ customerInfo: info('VERIFIED', 'plus') });
  const quote = (await billing.subscriptionPlan('plus'))!;
  expect(await billing.buySubscription(quote)).toBe('ok');
  expect(sdk.purchasePackage).toHaveBeenCalledWith({ aPackage: quote.package });
  expect(pro.currentTier()).toBe('plus');
  sdk.purchasePackage.mockResolvedValue({ customerInfo: info('FAILED') });
  expect(await billing.buySubscription((await billing.subscriptionPlan('pro'))!)).toBe('error');
  expect(pro.currentTier()).toBe('free');
});
it('restores either tier and distinguishes missing purchases, errors and failed verification', async () => {
  const billing = await import('../src/pro/billing');
  for (const tier of ['plus', 'pro'] as const) {
    sdk.restorePurchases.mockResolvedValue({ customerInfo: info('VERIFIED', tier) });
    expect(await billing.restorePro()).toBe('ok');
    expect((await import('../src/pro/pro')).currentTier()).toBe(tier);
  }
  sdk.restorePurchases.mockResolvedValueOnce({ customerInfo: info('VERIFIED', 'free') });
  expect(await billing.restorePro()).toBe('not-found');
  sdk.restorePurchases.mockResolvedValueOnce({ customerInfo: info('FAILED') });
  expect(await billing.restorePro()).toBe('error');
  sdk.restorePurchases.mockRejectedValueOnce(new Error('Offline'));
  expect(await billing.restorePro()).toBe('error');
});
it('reports Ask to Buy and cancellation without granting access', async () => {
  const billing = await import('../src/pro/billing'); const quote = (await billing.subscriptionPlan('pro'))!;
  sdk.purchasePackage.mockRejectedValue({ code: '20' });
  expect(await billing.buySubscription(quote)).toBe('pending');
  expect((await import('../src/pro/pro')).isPro()).toBe(false);
  sdk.purchasePackage.mockRejectedValue({ userCancelled: true });
  expect(await billing.buySubscription(quote)).toBe('cancelled');
});
