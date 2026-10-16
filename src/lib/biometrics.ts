import * as LocalAuthentication from 'expo-local-authentication';

/** "Face ID", "Touch ID" or "Fingerprint" if the device has one set up, else null. */
export async function biometricLabel(): Promise<string | null> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync()) || !(await LocalAuthentication.isEnrolledAsync())) return null;
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return process.env.EXPO_OS === 'ios' ? 'Face ID' : 'Face unlock';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return process.env.EXPO_OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    }
    return null;
  } catch {
    return null;
  }
}

/** Shows the system prompt. The device passcode works as a fallback. */
export async function confirmWithBiometrics(reason: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: reason });
    return result.success;
  } catch {
    return false;
  }
}
