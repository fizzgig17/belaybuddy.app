import { Redirect } from 'expo-router';

/** Settings is a tab on the Profile sheet. Old links land on Profile. */
export default function SettingsRedirect() {
  return <Redirect href="/profile" />;
}
