import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';
import { syncPurchasesUser } from '@/lib/purchases';

/** Keeps RevenueCat's idea of who is signed in matching the app. Renders nothing. */
export function PurchasesBridge() {
  const { user, loading } = useAuth();
  const id = user?.id ?? null;
  useEffect(() => {
    if (!loading) void syncPurchasesUser(id);
  }, [id, loading]);
  return null;
}
