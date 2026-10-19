import { Redirect } from 'expo-router';

/** Settings now lives next to Profile (swipe left from Profile). Old links land on Profile. */
export default function SettingsRedirect() {
  return <Redirect href="/profile" />;
}
