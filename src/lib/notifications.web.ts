// The website gets email notifications only.
export type PushStatus = 'on' | 'off' | 'blocked' | 'unsupported';
export const pushSupported = false;
export async function getPushStatus(): Promise<PushStatus> {
  return 'unsupported';
}
export async function enablePush(): Promise<PushStatus> {
  return 'unsupported';
}
export async function syncPushToken() {}
export async function unregisterPushToken() {}
export function useNotificationTaps() {}
