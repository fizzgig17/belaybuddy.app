// No Face ID on the website.
export async function biometricLabel(): Promise<string | null> {
  return null;
}

export async function confirmWithBiometrics(_reason: string): Promise<boolean> {
  return true;
}
