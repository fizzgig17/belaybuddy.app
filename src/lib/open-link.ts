import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/**
 * Opens an external page. On iOS it shows an in-app browser sheet with a Done button, so users
 * always have a way back to Belay Buddy. On the web it opens a new tab.
 */
export function openLink(url: string) {
  if (Platform.OS === 'web') {
    // Browsers won't bring an existing tab to the front from a page, so always open a new one.
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    dismissButtonStyle: 'done',
  });
}
