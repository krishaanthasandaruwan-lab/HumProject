import type { CustomerInfo } from '@revenuecat/purchases-capacitor';
import type { Tier } from './pro';

/** Informational verification does not block forged responses itself; HUMM does. */
export function verifiedPro(info: CustomerInfo, entitlement: string, product: string): boolean {
  const active = info.entitlements.active[entitlement];
  const verified = (v: string): boolean => v === 'VERIFIED' || v === 'VERIFIED_ON_DEVICE';
  return !!active?.isActive && active.productIdentifier === product
    && verified(info.entitlements.verification) && verified(active.verification);
}

/** Highest verified active subscription wins; Plus never grants Pro production exports. */
export function verifiedTier(info: CustomerInfo, plus: { entitlement: string; product: string }, pro: { entitlement: string; product: string }): Tier {
  if (verifiedPro(info, pro.entitlement, pro.product)) return 'pro';
  return verifiedPro(info, plus.entitlement, plus.product) ? 'plus' : 'free';
}
