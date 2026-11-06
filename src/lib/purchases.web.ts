import type { PurchasesPackage } from 'react-native-purchases';

/** The website is informational: no purchases, and nothing is locked. */
export const ENTITLEMENT = 'plus';
export const plusEnabled = false;
export async function syncPurchasesUser(_userId: string | null) {}
export async function loadPackages() {}
export type BuyResult = 'bought' | 'cancelled' | 'failed';
export async function buyPlus(_pkg: PurchasesPackage): Promise<BuyResult> {
  return 'failed';
}
export async function restorePlus() {
  return false;
}
export function manageSubscription() {}
export function usePlus() {
  return { enabled: false, ready: true, isPlus: true, packages: [] as PurchasesPackage[] };
}
export function requirePlus() {
  return true;
}
