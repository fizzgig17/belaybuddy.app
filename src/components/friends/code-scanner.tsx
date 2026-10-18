import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Linking, Modal, StyleSheet, View } from 'react-native';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Pulls a friend code out of a scanned link ("…/friend/ABCD2345") or a bare code. */
export function parseFriendCode(text: string): string | null {
  const cleaned = text.trim().toUpperCase();
  const fromLink = /\/FRIEND\/([A-Z0-9]{8})(?:[/?#]|$)/.exec(cleaned);
  if (fromLink) return fromLink[1];
  const bare = cleaned.replace(/[\s-]/g, '');
  return /^[A-Z0-9]{8}$/.test(bare) ? bare : null;
}

/**
 * Full-screen camera that reads a friend's QR code. Calls onCode once with the
 * code, or onClose if cancelled. Only used in the app (the website has no scanner).
 */
export function CodeScanner({
  visible,
  onCode,
  onClose,
}: {
  visible: boolean;
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  function onScanned(data: string) {
    if (handled.current) return;
    const code = parseFriendCode(data);
    if (!code) return; // not one of ours; keep looking
    handled.current = true;
    onCode(code);
  }

  return (
    <Modal visible={visible} animationType="slide" onShow={() => (handled.current = false)} onRequestClose={onClose}>
      <View style={styles.container}>
        {permission?.granted ? (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => onScanned(data)}
            />
            <View style={styles.frameWrap} pointerEvents="none">
              <View style={styles.frame} />
              <ThemedText type="smallBold" style={styles.hint}>
                Point at your friend’s Belay Buddy QR code
              </ThemedText>
            </View>
          </>
        ) : (
          <View style={styles.permission}>
            <ThemedText type="smallBold" style={styles.permissionText}>
              {permission && !permission.canAskAgain
                ? 'Camera access is off for Belay Buddy. Turn it on in Settings to scan a code.'
                : 'Belay Buddy needs the camera to scan a friend’s code.'}
            </ThemedText>
            {permission && !permission.canAskAgain ? (
              <Button title="Open Settings" onPress={() => Linking.openSettings()} />
            ) : (
              <Button title="Allow camera" onPress={requestPermission} />
            )}
          </View>
        )}
        <View style={styles.close}>
          <Button title="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  frameWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  frame: { width: 240, height: 240, borderRadius: 24, borderWidth: 3, borderColor: '#FFFFFF' },
  hint: { color: '#FFFFFF', textAlign: 'center', paddingHorizontal: Spacing.four },
  permission: { flex: 1, alignItems: 'stretch', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  permissionText: { color: '#FFFFFF', textAlign: 'center' },
  close: { position: 'absolute', left: Spacing.four, right: Spacing.four, bottom: 48 },
});
