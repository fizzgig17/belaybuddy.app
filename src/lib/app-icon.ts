import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons } from 'expo-alternate-app-icons';

export type AppIconChoice = 'A' | 'B' | 'C';

export const appIconsSupported = supportsAlternateIcons;

// "A" is the icon the app ships with; the others are alternates (see the
// expo-alternate-app-icons entry in app.json).
const NAMES: Record<AppIconChoice, string | null> = { A: null, B: 'IconB', C: 'IconC' };

export function currentAppIcon(): AppIconChoice {
  const name = getAppIconName();
  return (Object.keys(NAMES) as AppIconChoice[]).find((k) => NAMES[k] === name) ?? 'A';
}

export async function chooseAppIcon(choice: AppIconChoice) {
  await setAlternateAppIcon(NAMES[choice]);
}
