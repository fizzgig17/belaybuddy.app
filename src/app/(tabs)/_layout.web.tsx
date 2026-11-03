import { Redirect, Slot, usePathname } from 'expo-router';

/** Website: informational only. Only the home page lives here; app routes go back to it. */
export default function TabsLayout() {
  const path = usePathname();
  if (path !== '/') return <Redirect href="/" />;
  return <Slot />;
}
