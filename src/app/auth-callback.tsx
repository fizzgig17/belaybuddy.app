import { Redirect } from 'expo-router';

/**
 * Google and Facebook sign-in on Android send the browser back to
 * belaybuddy://auth-callback. The sign-in code reads the session from that link;
 * this screen only keeps the router from showing "Unmatched route".
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
