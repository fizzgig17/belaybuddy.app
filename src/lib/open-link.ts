import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/**
 * Opens an external page. On iOS it shows an in-app browser sheet with a Done button, so users
 * always have a way back to Belay Buddy. On the web it opens one shared tab and reuses it.
 */
export function openLink(url: string) {
  if (Platform.OS === 'web') {
    // A named target reuses the same tab on later taps instead of piling up new ones.
    const tab = window.open(url, 'belaybuddy-external');
    tab?.focus();
    return;
  }
  void WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    dismissButtonStyle: 'done',
  });
}
