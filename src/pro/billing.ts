// Google Play Billing through RevenueCat's Capacitor plugin — only inside the Android app.
// The plugin is loaded lazily, so the web build never touches it.
import { Capacitor } from '@capacitor/core';
import { setOwned } from './pro';

const API_KEY = import.meta.env.VITE_REVENUECAT_ANDROID_KEY ?? '';
const ENTITLEMENT = import.meta.env.VITE_PRO_ENTITLEMENT || 'pro';
export const PLAY_URL = import.meta.env.VITE_PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.mouthband.app';

type PurchasesModule = typeof import('@revenuecat/purchases-capacitor');
type Pkg = import('@revenuecat/purchases-capacitor').PurchasesPackage;
let mod: Promise<PurchasesModule> | null = null;
let ready = false;

const load = (): Promise<PurchasesModule> => (mod ??= import('@revenuecat/purchases-capacitor'));

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const canBuy = (): boolean => isNative() && API_KEY.length > 0;

export async function initBilling(): Promise<void> {
  if (!canBuy()) return;
  try {
    const { Purchases } = await load();
    await Purchases.configure({ apiKey: API_KEY });
    ready = true;
    const { customerInfo } = await Purchases.getCustomerInfo();
    setOwned(!!customerInfo.entitlements.active[ENTITLEMENT]);
  } catch (err) {
    console.warn('Billing unavailable', err);
  }
}

async function proPackage(): Promise<Pkg | null> {
  const { Purchases } = await load();
  const o = await Purchases.getOfferings();
  return o.current?.lifetime ?? o.current?.availablePackages[0] ?? null;
}

/** Localised price from the store, e.g. "$0.99" or "Rs 300.00". */
export async function proPrice(): Promise<string | null> {
  if (!ready) return null;
  try {
    return (await proPackage())?.product.priceString ?? null;
  } catch {
    return null;
  }
}

export type BuyResult = 'ok' | 'cancelled' | 'unavailable' | 'error';

export async function buyPro(): Promise<BuyResult> {
  if (!ready) return 'unavailable';
  try {
    const pkg = await proPackage();
    if (!pkg) return 'unavailable';
    const { Purchases } = await load();
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    const ok = !!customerInfo.entitlements.active[ENTITLEMENT];
    setOwned(ok);
    return ok ? 'ok' : 'error';
  } catch (err) {
    const e = err as { userCancelled?: boolean; code?: string | number };
    return e.userCancelled || String(e.code) === '1' ? 'cancelled' : 'error';
  }
}

export async function restorePro(): Promise<boolean> {
  if (!ready) return false;
  try {
    const { Purchases } = await load();
    const { customerInfo } = await Purchases.restorePurchases();
    const ok = !!customerInfo.entitlements.active[ENTITLEMENT];
    setOwned(ok);
    return ok;
  } catch {
    return false;
  }
}
