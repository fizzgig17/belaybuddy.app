export type AppIconChoice = 'A' | 'B' | 'C';

export const appIconsSupported = false;

export function currentAppIcon(): AppIconChoice {
  return 'A';
}

export async function chooseAppIcon(_choice: AppIconChoice) {}
