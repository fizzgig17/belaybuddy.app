/**
 * Native apps have no tab title. Deliberately does not import expo-router/head:
 * on iOS it expects Handoff to be configured and shows an alert otherwise.
 */
export function PageTitle(_props: { title: string }) {
  return null;
}
