// Only native, verified store entitlements grant Pro. RevenueCat owns the signed offline cache.
import { Capacitor } from '@capacitor/core';
import { setOwned } from './pro';
import { verifiedPro } from './verification';

const PLATFORM = Capacitor.getPlatform();
const API_KEY = (PLATFORM === 'ios' ? import.meta.env.VITE_REVENUECAT_IOS_KEY : import.meta.env.VITE_REVENUECAT_ANDROID_KEY) ?? '';
const ENTITLEMENT = import.meta.env.VITE_PRO_ENTITLEMENT || 'pro';
const PRODUCT = import.meta.env.VITE_PRO_PRODUCT_ID || 'humm_pro';
export const PLAY_URL = import.meta.env.VITE_PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.krishanthasandaruwan.humm';
const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL || '';

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
const apply = (info: Info): boolean => {
  const ok = verifiedPro(info, ENTITLEMENT, PRODUCT);
  setOwned(ok);
  return ok;
};

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
      ready = false;
      initialization = null;
      console.warn('Billing unavailable', err);
    }
  })();
}

/** Recheck before exports and when returning to the app; offline responses use the SDK's signed cache. */
export async function refreshBilling(): Promise<boolean> {
  if (!canBuy()) return false;
  if (!ready) { await initBilling(); return ready; }
  try {
    const { Purchases } = await load();
    let { customerInfo } = await Purchases.getCustomerInfo();
    apply(customerInfo);
    // A cache written before verification was enabled must be fetched again before it grants Pro.
    if (customerInfo.entitlements.active[ENTITLEMENT] &&
      (customerInfo.entitlements.verification === 'NOT_REQUESTED' || customerInfo.entitlements.active[ENTITLEMENT].verification === 'NOT_REQUESTED')) {
      await Purchases.invalidateCustomerInfoCache();
      customerInfo = (await Purchases.getCustomerInfo()).customerInfo;
      apply(customerInfo);
    }
    return true;
  } catch {
    // A network error does not revoke an entitlement already verified in this session.
    return false;
  }
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void refreshBilling();
});

async function proPackage(): Promise<Pkg | null> {
  await initBilling();
  if (!ready) return null;
  const { Purchases } = await load();
  const o = await Purchases.getOfferings();
  const pkg = o.current?.lifetime;
  return pkg && pkg.product.identifier === PRODUCT ? pkg : null;
}
export async function proPrice(): Promise<string | null> {
  try { return (await proPackage())?.product.priceString ?? null; } catch { return null; }
}
export type BuyResult = 'ok' | 'cancelled' | 'pending' | 'unavailable' | 'error';
export async function buyPro(): Promise<BuyResult> {
  try {
    const pkg = await proPackage();
    if (!pkg) return 'unavailable';
    const { Purchases } = await load();
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return apply(customerInfo) ? 'ok' : 'error';
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
    if (customerInfo.entitlements.verification === 'FAILED' ||
      (customerInfo.entitlements.active[ENTITLEMENT] && !verifiedPro(customerInfo, ENTITLEMENT, PRODUCT))) {
      setOwned(false); return 'error';
    }
    return apply(customerInfo) ? 'ok' : 'not-found';
  } catch { return 'error'; }
}
export const restoreMessage = (result: RestoreResult): string => ({
  ok: 'Welcome back to Pro', 'not-found': 'No earlier purchase found.',
  unavailable: 'The store is unavailable. Please try again.',
  error: 'Couldn’t restore your purchase. Check your connection and try again.',
})[result];
