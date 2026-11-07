import { router } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Linking, Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

/**
 * Belay Buddy Plus, sold through RevenueCat (which talks to the App Store and Google Play).
 *
 * It is switched off unless the build has EXPO_PUBLIC_PLUS_ENABLED=1 and the RevenueCat public SDK key for the
 * platform (EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY). While it is off, `isPlus` is
 * reported as true so every feature behaves exactly as it does today and no upgrade prompt is ever shown.
 */
export const ENTITLEMENT = 'plus';

const apiKey = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
export const plusEnabled = process.env.EXPO_PUBLIC_PLUS_ENABLED === '1' && !!apiKey;

type State = { ready: boolean; active: boolean; packages: PurchasesPackage[]; managementURL: string | null; problem: string | null };
let state: State = { ready: false, active: false, packages: [], managementURL: null, problem: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

let configured = false;
let currentUser: string | null = null;

function apply(info: CustomerInfo) {
  set({ active: !!info.entitlements.active[ENTITLEMENT], managementURL: info.managementURL ?? null, ready: true });
}

/** Call whenever the signed-in person changes. Safe to call before purchases are enabled (it does nothing). */
export async function syncPurchasesUser(userId: string | null) {
  if (!plusEnabled || !apiKey) return;
  try {
    if (!configured) {
      Purchases.configure({ apiKey, appUserID: userId ?? undefined });
      Purchases.addCustomerInfoUpdateListener(apply);
      configured = true;
    } else if (userId && userId !== currentUser) {
      apply((await Purchases.logIn(userId)).customerInfo);
    } else if (!userId && currentUser) {
      apply(await Purchases.logOut());
    }
    currentUser = userId;
    apply(await Purchases.getCustomerInfo());
  } catch {
    set({ ready: true });
  }
}

/** Fetch the prices to show on the paywall. If there are none, `problem` says why. */
export async function loadPackages() {
  if (!plusEnabled) return;
  if (!configured) {
    set({ packages: [], problem: 'Purchases have not started yet.' });
    return;
  }
  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    set({
      packages,
      problem: packages.length
        ? null
        : offerings.current
          ? 'The current offering has no packages for this store.'
          : 'No offering is marked current in RevenueCat.',
    });
  } catch (e) {
    set({ packages: [], problem: e instanceof Error ? e.message : 'Could not reach the store.' });
  }
}

export type BuyResult = 'bought' | 'cancelled' | 'failed';

export async function buyPlus(pkg: PurchasesPackage): Promise<BuyResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    apply(customerInfo);
    return customerInfo.entitlements.active[ENTITLEMENT] ? 'bought' : 'failed';
  } catch (e) {
    return (e as { code?: unknown })?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ? 'cancelled' : 'failed';
  }
}

export async function restorePlus(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    apply(info);
    return !!info.entitlements.active[ENTITLEMENT];
  } catch {
    return false;
  }
}

/** Open the store's own subscription page, where a person can change or cancel. */
export function manageSubscription() {
  const url =
    state.managementURL ??
    (Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions');
  void Linking.openURL(url);
}

/** Plus status for the screen. `isPlus` is true when purchases are off, so nothing is locked. */
export function usePlus() {
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  return { enabled: plusEnabled, ready: s.ready, isPlus: !plusEnabled || s.active, packages: s.packages, problem: s.problem };
}

/** For a tap on a Plus feature: true if it may go ahead, otherwise opens the paywall and returns false. */
export function requirePlus(): boolean {
  if (!plusEnabled || state.active) return true;
  router.push('/paywall');
  return false;
}

/** Plus status right now, outside a component. True when purchases are switched off. */
export const isPlusNow = () => !plusEnabled || state.active;
