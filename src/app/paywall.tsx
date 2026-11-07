import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { SymbolView } from 'expo-symbols';

import { Button } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { Icons } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { PLUS_FEATURES, PLUS_NAME } from '@/content/plus';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { buyPlus, loadPackages, manageSubscription, restorePlus, usePlus } from '@/lib/purchases';

const periodWord = (pkg: PurchasesPackage) =>
  pkg.packageType === 'ANNUAL' ? 'year' : pkg.packageType === 'MONTHLY' ? 'month' : pkg.packageType === 'WEEKLY' ? 'week' : '';

function trialText(pkg: PurchasesPackage): string | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const n = intro.periodNumberOfUnits;
  const unit = intro.periodUnit.toLowerCase();
  return `${n}-${unit} free trial`;
}

/** The Plus paywall. Prices come from the store through RevenueCat; nothing here is hard-coded. */
export default function Paywall() {
  const theme = useTheme();
  const { enabled, isPlus, packages, problem } = usePlus();
  const { user } = useAuth();
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadPackages();
  }, []);

  const options = [...packages].sort((a, b) => (a.packageType === 'ANNUAL' ? -1 : 0) - (b.packageType === 'ANNUAL' ? -1 : 0));
  const chosen = options.find((p) => p.identifier === picked) ?? options[0];

  // Plus belongs to an account, so it follows you to a new phone and the server can see it.
  function signInFirst() {
    router.back();
    router.push('/profile');
  }

  async function subscribe() {
    if (!user) return signInFirst();
    if (!chosen || busy) return;
    setBusy(true);
    const r = await buyPlus(chosen);
    setBusy(false);
    if (r === 'bought') router.back();
    else if (r === 'failed') Alert.alert('That did not go through', 'You have not been charged. Please try again in a moment.');
  }

  async function restore() {
    if (!user) return signInFirst();
    setBusy(true);
    const ok = await restorePlus();
    setBusy(false);
    if (ok) router.back();
    else Alert.alert('Nothing to restore', `We did not find a ${PLUS_NAME} subscription on this account.`);
  }

  return (
    <Screen title={PLUS_NAME} readable action={<View />}>
      {isPlus && enabled ? (
        <>
          <ThemedText>You have {PLUS_NAME}. Thank you for supporting Belay Buddy.</ThemedText>
          <Button title="Manage subscription" variant="secondary" onPress={manageSubscription} />
        </>
      ) : (
        <>
          <ThemedText themeColor="textSecondary">
            Finding gyms and partners, chat, safety guides and logging your climbs stay free. Plus adds:
          </ThemedText>
          {PLUS_FEATURES.map((f) => (
            <Card key={f.title} style={styles.feature}>
              <SymbolView name={Icons[f.icon]} size={24} tintColor={theme.accent} />
              <View style={styles.flex}>
                <ThemedText type="smallBold">{f.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {f.body}
                </ThemedText>
              </View>
            </Card>
          ))}
          {options.length === 0 ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {enabled ? 'Prices are not available right now. Please try again in a moment.' : 'Plus is not available yet.'}
              </ThemedText>
              {enabled && problem && (
                <ThemedText type="small" themeColor="textSecondary">
                  ({problem})
                </ThemedText>
              )}
              {enabled && <Button title="Try again" variant="secondary" onPress={() => void loadPackages()} />}
            </>
          ) : (
            options.map((p) => {
              const on = p.identifier === chosen?.identifier;
              const trial = trialText(p);
              return (
                <Pressable
                  key={p.identifier}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => setPicked(p.identifier)}
                  style={[styles.option, { borderColor: on ? theme.accent : theme.border, backgroundColor: theme.surface }]}>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold">{p.packageType === 'ANNUAL' ? 'Yearly' : p.packageType === 'MONTHLY' ? 'Monthly' : p.product.title}</ThemedText>
                    {trial && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {trial}, then {p.product.priceString}
                      </ThemedText>
                    )}
                  </View>
                  <ThemedText type="smallBold">
                    {p.product.priceString}
                    {periodWord(p) ? ` / ${periodWord(p)}` : ''}
                  </ThemedText>
                </Pressable>
              );
            })
          )}
          {chosen && !user && (
            <ThemedText type="small" themeColor="textSecondary">
              Sign in first: Plus is tied to your account, so it follows you to a new phone.
            </ThemedText>
          )}
          {chosen && (
            <Button
              title={!user ? 'Sign in to continue' : trialText(chosen) ? 'Start free trial' : 'Subscribe'}
              onPress={subscribe}
              loading={busy}
            />
          )}
          <Button title="Restore purchases" variant="secondary" onPress={restore} disabled={busy || !enabled} />
          <Button title="Not now" variant="secondary" onPress={() => router.back()} />
          <ThemedText type="small" themeColor="textSecondary">
            Payment is charged to your store account at confirmation. The subscription renews automatically unless it is
            cancelled at least 24 hours before the end of the current period, and you can manage or cancel it in your
            store account settings at any time. See our Terms of Use and Privacy Policy on belaybuddy.app.
          </ThemedText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 2, borderRadius: Spacing.three, padding: Spacing.three },
});
