// Monthly subscriptions and Apple-managed introductory offers. Store data supplies all prices.
import { Capacitor } from '@capacitor/core';
import { currentTier, hasTier, setTier, type PaidTier } from './pro';
import { verifiedPro, verifiedTier } from './verification';

const PLATFORM = Capacitor.getPlatform();
const API_KEY = (PLATFORM === 'ios' ? import.meta.env.VITE_REVENUECAT_IOS_KEY : import.meta.env.VITE_REVENUECAT_ANDROID_KEY) ?? '';
const PLANS = {
  plus: { entitlement: import.meta.env.VITE_PLUS_ENTITLEMENT || 'plus', product: import.meta.env.VITE_PLUS_PRODUCT_ID || 'humm_plus_monthly' },
  pro: { entitlement: import.meta.env.VITE_PRO_ENTITLEMENT || 'pro', product: import.meta.env.VITE_PRO_PRODUCT_ID || 'humm_pro_monthly' },
};
export const PLAY_URL = import.meta.env.VITE_PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.krishanthasandaruwan.humm';
const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL || '';
export const PRIVACY_URL = import.meta.env.VITE_PRIVACY_POLICY_URL || '';
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const MANAGE_URL = PLATFORM === 'android' ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions';

export function storeUrl(): string {
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return apple ? APP_STORE_URL : PLAY_URL;
}
type PurchasesModule = typeof import('@revenuecat/purchases-capacitor');
type Pkg = import('@revenuecat/purchases-capacitor').PurchasesPackage;
type Info = import('@revenuecat/purchases-capacitor').CustomerInfo;
let mod: Promise<PurchasesModule> | null = null;
let initialization: Promise<void> | null = null;
let ready = false;
const load = (): Promise<PurchasesModule> => (mod ??= import('@revenuecat/purchases-capacitor'));
export const isNative = (): boolean => Capacitor.isNativePlatform();
export const canBuy = (): boolean => isNative() && API_KEY.length > 0;
const apply = (info: Info): void => setTier(verifiedTier(info, PLANS.plus, PLANS.pro));

export function initBilling(): Promise<void> {
  if (!canBuy()) return Promise.resolve();
  return initialization ??= (async () => {
    try {
      const { Purchases, ENTITLEMENT_VERIFICATION_MODE } = await load();
      await Purchases.configure({ apiKey: API_KEY, entitlementVerificationMode: ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL });
      ready = true;
      await Purchases.addCustomerInfoUpdateListener(apply);
      await refreshBilling();
    } catch (err) {
      ready = false; initialization = null;
      console.warn('Billing unavailable', err);
    }
  })();
}

/** The SDK manages its signed offline cache. Recheck before exporting and on foreground. */
export async function refreshBilling(): Promise<boolean> {
  if (!canBuy()) return false;
  if (!ready) { await initBilling(); return ready; }
  try {
    const { Purchases } = await load();
    let { customerInfo } = await Purchases.getCustomerInfo();
    apply(customerInfo);
    if (Object.values(PLANS).some(({ entitlement }) => customerInfo.entitlements.active[entitlement] &&
      (customerInfo.entitlements.verification === 'NOT_REQUESTED' || customerInfo.entitlements.active[entitlement].verification === 'NOT_REQUESTED'))) {
      await Purchases.invalidateCustomerInfoCache();
      customerInfo = (await Purchases.getCustomerInfo()).customerInfo;
      apply(customerInfo);
    }
    return true;
  } catch { return false; } // A temporary failure cannot erase already verified session access.
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void refreshBilling();
});

export interface StorePlan {
  tier: PaidTier;
  price: string;
  trial: boolean;
  package: Pkg;
  signature: string;
}

export async function subscriptionPlan(tier: PaidTier): Promise<StorePlan | null> {
  try {
    await initBilling();
    if (!ready) return null;
    const { Purchases, INTRO_ELIGIBILITY_STATUS } = await load();
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find((p) => p.product.identifier === PLANS[tier].product && p.product.subscriptionPeriod === 'P1M');
    if (!pkg || !Number.isFinite(pkg.product.price) || pkg.product.price <= 0 || !pkg.product.priceString) return null;
    const intro = pkg.product.introPrice;
    // Do not sell a differently configured introductory offer under this plan's disclosure.
    const threeMonthsFree = intro?.price === 0 && intro.periodUnit === 'MONTH' && intro.periodNumberOfUnits * intro.cycles === 3;
    if (intro && (tier !== 'pro' || !threeMonthsFree)) return null;
    let eligible = false;
    if (PLATFORM === 'ios' && tier === 'pro' && threeMonthsFree) {
      try {
        const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: [pkg.product.identifier] });
        eligible = eligibility[pkg.product.identifier]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
      } catch { /* Unknown eligibility shows the standard price, never an unverified free offer. */ }
    }
    return { tier, price: pkg.product.priceString, trial: eligible, package: pkg,
      signature: JSON.stringify([pkg.product.identifier, pkg.product.price, pkg.product.currencyCode, pkg.product.subscriptionPeriod, eligible]) };
  } catch { return null; }
}

export type BuyResult = 'ok' | 'cancelled' | 'pending' | 'unavailable' | 'changed' | 'error';
export async function buySubscription(quote: StorePlan): Promise<BuyResult> {
  try {
    const current = await subscriptionPlan(quote.tier);
    if (!current) return 'unavailable';
    if (current.signature !== quote.signature) return 'changed';
    const { Purchases } = await load();
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: current.package });
    apply(customerInfo);
    return hasTier(quote.tier) ? 'ok' : 'error';
  } catch (err) {
    const e = err as { userCancelled?: boolean; code?: string | number };
    if (e.userCancelled || String(e.code) === '1') return 'cancelled';
    return String(e.code) === '20' ? 'pending' : 'error';
  }
}

export type RestoreResult = 'ok' | 'not-found' | 'unavailable' | 'error';
export async function restorePro(): Promise<RestoreResult> {
  await initBilling();
  if (!ready) return 'unavailable';
  try {
    const { Purchases } = await load();
    const { customerInfo } = await Purchases.restorePurchases();
    if (customerInfo.entitlements.verification === 'FAILED' || Object.values(PLANS).some(({ entitlement, product }) =>
      customerInfo.entitlements.active[entitlement] && !verifiedPro(customerInfo, entitlement, product))) {
      setTier('free'); return 'error';
    }
    apply(customerInfo);
    return currentTier() !== 'free' ? 'ok' : 'not-found';
  } catch { return 'error'; }
}
export const restoreMessage = (result: RestoreResult): string => ({
  ok: `Welcome back to ${currentTier() === 'plus' ? 'Plus' : 'Pro'}`, 'not-found': 'No active subscription found.',
  unavailable: 'The store is unavailable. Please try again.',
  error: 'Couldn’t restore your subscription. Check your connection and try again.',
})[result];
