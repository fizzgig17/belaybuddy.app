# Belay Buddy

An iOS app for climbers: find indoor gyms and outdoor crags, find climbing partners at home or while traveling, learn safety, gear and knots, and use Route AI to map the holds of a gym route from a photo.

Built with Expo (SDK 57), Expo Router and TypeScript.

## Status

Working: email sign-in, climbing profile, and the Find tab (nearby gyms and crags, place search, favorites). The other tabs are placeholders.

| Tab | Planned features |
| --- | --- |
| Find | Indoor gyms (OpenStreetMap), outdoor crags (OpenBeta), place search, favorites; map view next |
| Partners | Nearby listings with coarse location only, travel posts, block/report |
| Route AI | Wall photo → pick hold color → highlighted hold map → per-hold technique tips |
| Learn | Climbing safety, gear, knots (content must be reviewed by a qualified instructor) |
| Profile | Sign in with Apple, Google, Facebook or email; climbing profile; settings |

## Roadmap

1. Auth (Sign in with Apple is required by the App Store when Google/Facebook login is offered) and climbing profile
2. Gym and crag map with favorites
3. Learn content
4. Partner finder, with blocking, reporting and moderation in place before launch
5. Route AI hold map
6. Route AI technique suggestions

## Development

```bash
npm install
npx expo start          # dev server
npm run typecheck       # tsc --noEmit
```

Native code (location, camera, auth SDKs) needs a development build rather than Expo Go: `npx expo run:ios` on a Mac, or a cloud build.

`ios/` and `android/` are generated from `app.json` (Continuous Native Generation) and are not committed.

## Project layout

```
src/app/            routes (Expo Router); every file is a screen
  index.tsx         Find tab
  partners.tsx      Partners tab
  route-ai.tsx      Route AI tab
  learn/            Learn tab (stack: topic list → topic)
  profile.tsx       Profile tab
src/components/     shared UI (Screen, FeatureCard, themed primitives, tab bar)
src/content/        static Learn content
src/types/models.ts data model shared with the backend
```

Bundle IDs: iOS `app.belaybuddy.ios`, Android `app.belaybuddy.android`. Domain: belaybuddy.app.
