// Makes sure the App ID has the capabilities the app needs (Push
// Notifications, Sign in with Apple) and that there's a current App Store provisioning profile
// for it signed with our distribution certificate, then writes that profile
// to disk. Uses the App Store Connect API key the workflow already has.
//
//   node asc-profile.mjs <bundle id> <certificate serial (hex)> <output .mobileprovision>
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (path to the .p8)
//
// Changing an App ID's capabilities invalidates its profiles, so an invalid
// or outdated CI profile is deleted and recreated.

import { createSign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [bundleIdentifier, certSerial, outPath] = process.argv.slice(2);
const PROFILE_NAME = 'Belay Buddy CI App Store';
const CAPABILITIES = ['PUSH_NOTIFICATIONS', 'APPLE_ID_AUTH'];
const API = 'https://api.appstoreconnect.apple.com/v1';

function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' })}.${b64({
    iss: process.env.ASC_ISSUER_ID,
    iat: now,
    exp: now + 15 * 60,
    aud: 'appstoreconnect-v1',
  })}`;
  const sig = createSign('SHA256')
    .update(unsigned)
    .sign({ key: readFileSync(process.env.ASC_KEY_PATH, 'utf8'), dsaEncoding: 'ieee-p1363' });
  return `${unsigned}.${sig.toString('base64url')}`;
}

const jwt = token();
async function api(method, path, body) {
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (json.errors ?? []).map((e) => `${e.title}: ${e.detail}`).join('; ');
    throw new Error(`${method} ${path} -> HTTP ${res.status} ${detail}`);
  }
  return json;
}

const norm = (s) => String(s ?? '').toUpperCase().replace(/^0+/, '');

// 1. The App ID
const ids = await api('GET', `/bundleIds?filter[identifier]=${encodeURIComponent(bundleIdentifier)}&limit=5`);
const bundle = ids.data.find((b) => b.attributes.identifier === bundleIdentifier);
if (!bundle) throw new Error(`No App ID ${bundleIdentifier} in this team`);

// 2. Capabilities
const caps = await api('GET', `/bundleIds/${bundle.id}/bundleIdCapabilities`);
const have = new Set(caps.data.map((c) => c.attributes.capabilityType));
let changed = false;
for (const cap of CAPABILITIES) {
  if (have.has(cap)) continue;
  console.log(`Turning on ${cap} for ${bundleIdentifier}`);
  await api('POST', '/bundleIdCapabilities', {
    data: {
      type: 'bundleIdCapabilities',
      attributes: {
        capabilityType: cap,
        // Sign in with Apple must say which kind of app this is.
        ...(cap === 'APPLE_ID_AUTH' && {
          settings: [{ key: 'APPLE_ID_AUTH_APP_CONSENT', options: [{ key: 'PRIMARY_APP_CONSENT' }] }],
        }),
      },
      relationships: { bundleId: { data: { type: 'bundleIds', id: bundle.id } } },
    },
  });
  changed = true;
}

// 3. Our distribution certificate
const certs = await api('GET', '/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=200');
const cert = certs.data.find((c) => norm(c.attributes.serialNumber) === norm(certSerial));
if (!cert) {
  throw new Error(
    `The installed certificate (serial ${certSerial}) isn't among this team's distribution certificates: ` +
      certs.data.map((c) => `${c.attributes.name} ${c.attributes.serialNumber}`).join(', '),
  );
}

// 4. Reuse the CI profile if it's still good, else recreate it
const profiles = await api(
  'GET',
  `/profiles?filter[name]=${encodeURIComponent(PROFILE_NAME)}&include=bundleId,certificates&limit=20`,
);
let profile = null;
for (const p of profiles.data) {
  const ok =
    !changed &&
    p.attributes.profileState === 'ACTIVE' &&
    p.attributes.profileType === 'IOS_APP_STORE' &&
    p.relationships.bundleId.data?.id === bundle.id &&
    (p.relationships.certificates.data ?? []).some((c) => c.id === cert.id) &&
    new Date(p.attributes.expirationDate).getTime() > Date.now() + 7 * 86400e3;
  if (ok && !profile) {
    profile = p;
  } else {
    console.log(`Deleting outdated profile ${p.id} (${p.attributes.profileState})`);
    await api('DELETE', `/profiles/${p.id}`);
  }
}
if (!profile) {
  console.log(`Creating profile "${PROFILE_NAME}"`);
  profile = (
    await api('POST', '/profiles', {
      data: {
        type: 'profiles',
        attributes: { name: PROFILE_NAME, profileType: 'IOS_APP_STORE' },
        relationships: {
          bundleId: { data: { type: 'bundleIds', id: bundle.id } },
          certificates: { data: [{ type: 'certificates', id: cert.id }] },
        },
      },
    })
  ).data;
}

writeFileSync(outPath, Buffer.from(profile.attributes.profileContent, 'base64'));
console.log(`Profile "${profile.attributes.name}" (${profile.attributes.uuid}), expires ${profile.attributes.expirationDate}`);
