import type { CustomerInfo } from '@revenuecat/purchases-capacitor';

/** Informational verification does not block forged responses itself; HUMM does. */
export function verifiedPro(info: CustomerInfo, entitlement: string, product: string): boolean {
  const active = info.entitlements.active[entitlement];
  const verified = (v: string): boolean => v === 'VERIFIED' || v === 'VERIFIED_ON_DEVICE';
  return !!active?.isActive && active.productIdentifier === product
    && verified(info.entitlements.verification) && verified(active.verification);
}
