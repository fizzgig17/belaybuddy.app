import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { Link } from 'expo-router';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';

import { Button, ButtonIcon, Field, Segmented, SingleChoice } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/group';
import { HoldEditor } from '@/components/route-ai/hold-editor';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAiConsent } from '@/lib/ai-consent';
import { useAuth } from '@/lib/auth';
import { select } from '@/lib/haptics';
import {
  detectHolds,
  refineWithObjects,
  growHoldAt,
  routeArea,
  holdAt,
  isSimilarSeed,
  sampleSeed,
  type Hold,
  type Seed,
  type Sensitivity,
} from '@/lib/route-ai/detect';
import {
  checkPhoto,
  fetchRouteTips,
  reviewHolds,
  reportTips,
  TIP_REPORT_REASONS,
  type TipReportReason,
  type PhotoCheck,
  HOLD_TYPE_LABEL,
  MAX_TIP_HOLDS,
  numberHolds,
  type RouteTips,
} from '@/lib/route-ai/tips';
import { measureWall, type RawDepthCapture, type WallGeometry } from '@/lib/route-ai/depth';
import { captureWall, captureWallSections, canSegmentHolds, findObjects, segmenterReport, isLidarSupported, segmentHolds, type ObjectMask } from '@/lib/route-ai/lidar';
import { holdsFromSegments } from '@/lib/route-ai/segment';
import { stitchTallWall } from '@/lib/route-ai/tall-wall-photo';
import { chooseWallPhoto, loadWallPhoto, takeWallPhoto, type PickResult, type WallPhoto } from '@/lib/route-ai/photo';

const SENSITIVITY_OPTIONS: { value: Sensitivity; label: string }[] = [
  { value: 'low', label: 'Fewer' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'More' },
];

/** The photo the person picked, with a color pick and the holds found, all on-device. */
/** The AI describes the scene as a sentence ("An indoor wall..."); it reads better mid-sentence in lowercase. */
function lowerFirst(text: string) {
  const t = text.trim().replace(/\.$/, '');
  return /^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
}

export function WallScanner() {
  const theme = useTheme();
  const [photo, setPhoto] = useState<WallPhoto | null>(null);
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const seed = seeds[0] ?? null;
  const [seedRgb, setSeedRgb] = useState<string>('#FFD400');
  // Where the first tap landed: the route is in one area of the wall, around this hold.
  const [anchor, setAnchor] = useState<[number, number] | null>(null);
  const [oneArea, setOneArea] = useState<'area' | 'wall'>('area');
  const [sensitivity, setSensitivity] = useState<Sensitivity>('normal');
  const [auto, setAuto] = useState<Hold[]>([]);
  const [removedPts, setRemovedPts] = useState<[number, number][]>([]);
  const [manual, setManual] = useState<Hold[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const imageRef = useRef<View>(null);
  const autoCount = useRef(0);
  // Apple Vision's separate objects for the current photo: looked up once, then reused for every re-detect.
  const objects = useRef<{ uri: string; mask: ObjectMask | null } | null>(null);
  const [wall, setWall] = useState<WallGeometry | null>(null);
  const [checking, setChecking] = useState(false);
  const [look, setLook] = useState<PhotoCheck | null>(null);
  const lidar = useMemo(() => isLidarSupported(), []);
  const { user } = useAuth();
  const { consent, set: setConsent, acknowledged, acknowledge } = useAiConsent();
  const [pending, setPending] = useState<'lidar' | 'tall' | 'camera' | 'library' | null>(null);
  const [stitching, setStitching] = useState(false);
  const [editing, setEditing] = useState(false);
  const [segNote, setSegNote] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [tips, setTips] = useState<RouteTips | null>(null);
  const [tipsBusy, setTipsBusy] = useState(false);
  const [tipsError, setTipsError] = useState<string | null>(null);

  // With a LiDAR scan, detections that the depth says are not on the wall (floor, mats, other walls, people) are skipped.
  const offWall = useMemo(() => auto.filter((h) => wall?.onWall?.(h.x, h.y) === false), [auto, wall]);
  const kept = useMemo(
    () =>
      auto.filter(
        (h) =>
          !offWall.includes(h) && !removedPts.some(([x, y]) => Math.abs(x - h.x) <= h.w / 2 && Math.abs(y - h.y) <= h.h / 2),
      ),
    [auto, offWall, removedPts],
  );
  // One route sits in one area: holds of the same color far from the tapped one belong to other routes.
  const inArea = useMemo(
    () => (oneArea === 'area' && anchor && photo ? routeArea(kept, anchor, photo.width, photo.height) : null),
    [kept, oneArea, anchor, photo],
  );
  const farAway = inArea ? kept.length - inArea.length : 0;
  const holds = useMemo(() => {
    const base = inArea ?? kept;
    // A hand-added hold that detection now finds on its own isn't drawn twice.
    const extra = manual.filter((m) => !holdAt(base, m.x, m.y, 0.005));
    return [...base, ...extra];
  }, [inArea, kept, manual]);
  const numbered = useMemo(() => numberHolds(holds), [holds]);
  const signature = numbered.map((h) => `${h.x.toFixed(3)},${h.y.toFixed(3)}`).join('|');
  // Tips describe a particular set of holds; editing the holds makes them stale.
  useEffect(() => {
    setTips(null);
    setTipsError(null);
  }, [signature]);
  const height = photo ? (width * photo.height) / photo.width : 0;
  const dw = width;
  const dh = height;

  /** Removes every hold whose center is inside the box (0..1 coordinates) and says how many went. */
  const removeInBox = useCallback(
    (x0: number, y0: number, x1: number, y1: number) => {
      const inBox = (h: Hold) => h.x >= x0 && h.x <= x1 && h.y >= y0 && h.y <= y1;
      const gone = holds.filter(inBox);
      if (gone.length === 0) return 0;
      setManual((m) => m.filter((h) => !inBox(h)));
      setRemovedPts((r) => [...r, ...gone.filter((h) => !h.manual).map((h) => [h.x, h.y] as [number, number])]);
      select();
      return gone.length;
    },
    [holds],
  );

  const reset = useCallback(() => {
    setReviewNote(null);
    setEditing(false);
    setPhoto(null);
    setSeeds([]); setAnchor(null);
    setAuto([]);
    setRemovedPts([]);
    setManual([]);
    setWall(null);
    setLook(null);
    setError(null);
  }, []);

  /**
   * Takes a loaded photo into the screen. Signed-in people get a quick check first: it says what the
   * photo shows, and a photo that isn't suitable for all ages is dropped without ever being displayed.
   */
  const accept = useCallback(
    async (loaded: WallPhoto, geometry: WallGeometry | null) => {
      setLook(null);
      if (user && consent === 'allowed') {
        setChecking(true);
        const result = await checkPhoto(loaded);
        setChecking(false);
        if (result.kind === 'unsafe') {
          setError("That photo can't be used in Route AI. Please choose a different one.");
          return false;
        }
        setLook(result);
      }
      setPhoto(loaded);
      setWall(geometry);
      setSeeds([]); setAnchor(null);
      setAuto([]);
      setRemovedPts([]);
      setManual([]);
      return true;
    },
    [user, consent],
  );

  /** Measures one LiDAR capture and uses its photo like any other. */
  const useSingleCapture = useCallback(
    async (cap: RawDepthCapture) => {
      const loaded = await loadWallPhoto(cap.uri);
      const measured = measureWall(cap);
      const geometry = 'wall' in measured ? measured.wall : null;
      if (!(await accept(loaded, geometry))) return;
      if ('failure' in measured) {
        setError(
          measured.failure === 'floor-or-ceiling'
            ? 'That scan was mostly floor or ceiling, so there is no wall angle. Tips will use the photo only. Aim at the wall to measure it.'
            : 'Not enough depth to measure the wall. Stand 2 to 4 m back and try again. Tips will use the photo only.',
        );
      }
    },
    [accept],
  );

  /** LiDAR path: capture, then measure the wall and use the photo like any other. */
  const scanWithLidar = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const cap = await captureWall();
      if (!cap) return;
      await useSingleCapture(cap);
    } catch {
      setError('The LiDAR scan did not work. You can still take a regular photo.');
    } finally {
      setBusy(false);
    }
  }, [useSingleCapture]);

  /** Tall walls: several shots from the bottom up, stitched into one straight picture of the wall. */
  const scanTallWall = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const caps = await captureWallSections();
      if (!caps) return;
      if (caps.length === 1) {
        await useSingleCapture(caps[0]);
        return;
      }
      setStitching(true);
      const stitched = await stitchTallWall(caps);
      if (!stitched.ok) {
        setError(
          stitched.failure === 'floor-or-ceiling'
            ? 'Those shots were mostly floor or ceiling. Aim at the wall, start at the bottom, and try again.'
            : 'Not enough depth to line the shots up. Start with the bottom of the wall in view, 3 to 5 m back, and try again.',
        );
        return;
      }
      const loaded = await loadWallPhoto(stitched.uri);
      await accept(loaded, stitched.geometry);
    } catch {
      setError('The tall wall scan did not work. You can still scan one section, or take a regular photo.');
    } finally {
      setStitching(false);
      setBusy(false);
    }
  }, [accept, useSingleCapture]);

  const pick = useCallback(async (run: () => Promise<PickResult>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await run();
      if (!result) return;
      if ('error' in result) {
        setError(result.error);
        return;
      }
      await accept(result.photo, null);
    } finally {
      setBusy(false);
    }
  }, [accept]);

  /** Runs detection after letting the spinner paint, since it takes a moment on a phone. */
  const runDetect = useCallback((p: WallPhoto, s: Seed[], level: Sensitivity, previous?: Seed[]) => {
    setBusy(true);
    setTimeout(async () => {
      // The color match only proposes spots. On an iPhone, a "segment anything" model then cuts out the object at each
      // spot, and a spot counts as a hold only if that object itself is the route's color. Without the model (or if it
      // fails), the color match stands on its own.
      const strict = detectHolds(p.pixels, s, level);
      let found = strict;
      let cutOut = false;
      setSegNote(null);
      if (!canSegmentHolds()) {
        setSegNote(Platform.OS === 'ios' ? 'Segmentation model: not in this build.' : null);
      } else {
        const proposals = detectHolds(p.pixels, s, level === 'low' ? 'normal' : 'high', { maxArea: 0.08, maxSpan: 0.3 }).slice(0, 150);
        const segments = await segmentHolds(
          p.uri,
          proposals.map((h) => [h.x, h.y] as [number, number]),
        );
        if (segments) {
          const real = holdsFromSegments(segments, p.pixels, s, level);
          if (real.length > 0) {
            found = real;
            cutOut = true;
            setSegNote(`Segmentation model: checked ${proposals.length} spots, kept ${real.length}.`);
          }
        }
        if (!cutOut) setSegNote(`Segmentation model did not give holds (${proposals.length} spots).\n${await segmenterReport(p.uri)}`);
      }
      if (!cutOut) {
        if (objects.current?.uri !== p.uri) objects.current = { uri: p.uri, mask: await findObjects(p.uri) };
        const mask = objects.current.mask;
        if (mask) found = refineWithObjects(found, mask);
      }
      // Adding a color that makes the count balloon means it matched the wall: undo that color.
      if (previous && previous.length && found.length > autoCount.current * 1.5 + 6) {
        found = detectHolds(p.pixels, previous, level);
        setSeeds(previous);
      }
      autoCount.current = found.length;
      setAuto(found);
      setBusy(false);
    }, 30);
  }, [accept]);

  const onTap = useCallback(
    (nx: number, ny: number) => {
      if (!photo || busy) return;
      if (!seed) {
        const s = sampleSeed(photo.pixels, nx, ny);
        const { width: w, height: h, data } = photo.pixels;
        const i = (Math.round(ny * (h - 1)) * w + Math.round(nx * (w - 1))) * 4;
        setSeedRgb(`rgb(${data[i]},${data[i + 1]},${data[i + 2]})`);
        setSeeds([s]);
        setAnchor([nx, ny]);
        setRemovedPts([]);
        setManual([]);
        select();
        runDetect(photo, [s], sensitivity);
        return;
      }
      const hit = holdAt(holds, nx, ny);
      select();
      if (hit) {
        if (hit.manual) setManual((m) => m.filter((x) => x.id !== hit.id));
        else setRemovedPts((r) => [...r, [hit.x, hit.y]]);
      } else {
        const id = 10000 + manual.length;
        void (async () => {
          // On an iPhone the segmentation model cuts out the exact outline of the tapped hold.
          let added: Hold | null = null;
          if (canSegmentHolds()) {
            const cut = (await segmentHolds(photo.uri, [[nx, ny]]))?.[0];
            if (cut && cut.area < 0.06 && cut.x1 - cut.x0 < 0.3 && cut.y1 - cut.y0 < 0.3) {
              added = {
                id,
                x: (cut.x0 + cut.x1) / 2,
                y: (cut.y0 + cut.y1) / 2,
                w: cut.x1 - cut.x0,
                h: cut.y1 - cut.y0,
                manual: true,
              };
            }
          }
          if (!added) added = growHoldAt(photo.pixels, nx, ny, id);
          const hold = added;
          setManual((m) => [...m, hold]);
          // A missed hold teaches the match its color (e.g. a lit hold after picking a shaded one).
          const tapped = sampleSeed(photo.pixels, nx, ny, 2);
          if (!hold.guessed && isSimilarSeed(seeds[0], tapped)) {
            const next = [...seeds, tapped].slice(0, 6);
            setSeeds(next);
            runDetect(photo, next, sensitivity, seeds);
          }
        })();
      }
    },
    [photo, seed, seeds, busy, holds, manual.length, sensitivity, runDetect],
  );

  /** The AI looks at the photo with the boxes drawn on it: drops wrong ones and adds holds that were missed. */
  const checkWithAi = useCallback(async () => {
    if (!photo || reviewing) return;
    setReviewing(true);
    setReviewNote(null);
    try {
      const review = await reviewHolds(photo, numbered, seedRgb, oneArea === 'area' ? anchor : null);
      if (review.unsafe) {
        reset();
        setError("That photo can't be used in Route AI. Please choose a different one.");
        return;
      }
      const gone = numbered.filter((h) => review.remove.includes(h.n));
      const keptHolds = numbered.filter((h) => !review.remove.includes(h.n));
      const added: Hold[] = [];
      review.missed.forEach((p, i) => {
        if (holdAt([...keptHolds, ...added], p.x, p.y, 0.01)) return;
        added.push(growHoldAt(photo.pixels, p.x, p.y, 20000 + manual.length + i));
      });
      if (gone.length) {
        const goneManual = new Set(gone.filter((h) => h.manual).map((h) => h.id));
        setManual((m) => m.filter((h) => !goneManual.has(h.id)));
        setRemovedPts((r) => [...r, ...gone.filter((h) => !h.manual).map((h) => [h.x, h.y] as [number, number])]);
      }
      if (added.length) setManual((m) => [...m, ...added]);
      select();
      setReviewNote(
        gone.length === 0 && added.length === 0
          ? 'The AI agrees with these holds.'
          : `The AI removed ${gone.length} and added ${added.length}.`,
      );
    } catch (e) {
      setReviewNote(e instanceof Error ? e.message : 'Could not check the holds.');
    } finally {
      setReviewing(false);
    }
  }, [photo, numbered, seedRgb, anchor, oneArea, manual.length, reviewing, reset]);

  const getTips = useCallback(async () => {
    if (!photo) return;
    setTipsBusy(true);
    setTipsError(null);
    try {
      const result = await fetchRouteTips(photo, numbered, wall);
      if (result.unsafe) {
        reset();
        setError("That photo can't be used in Route AI. Please choose a different one.");
        return;
      }
      setTips(result);
    } catch (e) {
      setTipsError(e instanceof Error ? e.message : 'Could not get tips.');
    } finally {
      setTipsBusy(false);
    }
  }, [photo, numbered, wall, reset]);

  /** Where a press landed on the photo, as 0..1. The web doesn't report locationX/Y, so measure the element. */
  const locate = (e: GestureResponderEvent): [number, number] | null => {
    const ne = e.nativeEvent as unknown as { locationX?: number; locationY?: number; clientX?: number; clientY?: number };
    if (Platform.OS === 'web') {
      const el = imageRef.current as unknown as HTMLElement | null;
      if (!el?.getBoundingClientRect || ne.clientX == null || ne.clientY == null) return null;
      const r = el.getBoundingClientRect();
      return [(ne.clientX - r.left) / r.width, (ne.clientY - r.top) / r.height];
    }
    if (ne.locationX == null || ne.locationY == null) return null;
    return [ne.locationX / dw, ne.locationY / dh];
  };

  const runAction = (action: 'lidar' | 'tall' | 'camera' | 'library') => {
    if (action === 'lidar') void scanWithLidar();
    else if (action === 'tall') void scanTallWall();
    else void pick(action === 'camera' ? takeWallPhoto : chooseWallPhoto);
  };

  /** Asks about AI the first time a signed-in person picks a photo, then carries on either way. */
  const gate = (action: 'lidar' | 'tall' | 'camera' | 'library') => {
    if (user && (consent === 'unset' || consent === 'loading')) setPending(action);
    else runAction(action);
  };

  // Once they answer, start what they asked for, with the new choice in effect.
  useEffect(() => {
    if (pending && consent !== 'unset' && consent !== 'loading') {
      const action = pending;
      setPending(null);
      runAction(action);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent, pending]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (!photo) {
    return (
      <Card style={styles.pad}>
        <ThemedText type="smallBold">Scan a wall</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Take or choose a photo of a wall, then tap one hold on your route. Photos stay on your device.
        </ThemedText>
        {pending && consent === 'unset' && (
          <View style={styles.gap}>
            <ThemedText type="smallBold">Use AI for this photo?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Route AI can send your photo to an AI service (Anthropic’s Claude) to say what it shows and write
              technique tips. We don’t store it. Finding holds works on your phone either way. You can change this
              any time in Settings.
            </ThemedText>
            <Link href="/privacy" asChild>
              <Pressable accessibilityRole="link">
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  Privacy policy
                </ThemedText>
              </Pressable>
            </Link>
            <Button title="Allow AI" onPress={() => setConsent('allowed')} />
            <Button title="Not now" variant="secondary" onPress={() => setConsent('denied')} />
          </View>
        )}
        {checking && (
          <ThemedText type="small" themeColor="textSecondary">
            Checking the photo…
          </ThemedText>
        )}
        {stitching && (
          <ThemedText type="small" themeColor="textSecondary">
            Putting the shots together… this takes a few seconds.
          </ThemedText>
        )}
        {lidar && <Button title="Scan with LiDAR" onPress={() => gate('lidar')} loading={busy} />}
        {lidar && (
          <Button title="Scan a tall wall" variant="secondary" onPress={() => gate('tall')} loading={busy} />
        )}
        {lidar && (
          <ThemedText type="small" themeColor="textSecondary">
            Tall wall: take several shots from the bottom up, and we line them up into one picture with real distances.
          </ThemedText>
        )}
        {Platform.OS !== 'web' && (
          <Button
            title="Take a photo"
            icon={<ButtonIcon name="camera" variant={lidar ? 'secondary' : 'primary'} />}
            variant={lidar ? 'secondary' : 'primary'}
            onPress={() => gate('camera')}
            loading={busy}
          />
        )}
        <Button
          title="Choose a photo"
          variant={Platform.OS === 'web' ? 'primary' : 'secondary'}
          onPress={() => gate('library')}
          loading={busy}
        />
        {error && (
          <ThemedText type="small" style={{ color: '#C0392B' }}>
            {error}
          </ThemedText>
        )}
      </Card>
    );
  }

  return (
    <View style={styles.gap}>
      <ThemedText type="small" themeColor="textSecondary">
        {!seed
          ? 'Tap one hold on your route to pick its color.'
          : 'Tap a highlighted hold to remove it. Tap one that was missed to add it, and similar holds will be found too.'}
      </ThemedText>
      {look && look.what !== '' && (
        <ThemedText type="small" themeColor="textSecondary">
          {look.kind === 'other'
            ? `This looks like ${lowerFirst(look.what)}, not a climbing wall. Route AI works on climbing walls.`
            : `This looks like ${lowerFirst(look.what)}.`}
        </ThemedText>
      )}
      {error && (
        <ThemedText type="small" style={{ color: '#C0392B' }}>
          {error}
        </ThemedText>
      )}

      <Button title="Open full screen to zoom and select" variant="secondary" onPress={() => setEditing(true)} />

      <View onLayout={onLayout} style={styles.imageWrap}>
        {width > 0 && (
          <>
          <Pressable
            accessibilityLabel="Wall photo. Tap a hold."
            ref={imageRef}
            onPress={(e) => {
              const at = locate(e);
              if (at) onTap(Math.min(1, Math.max(0, at[0])), Math.min(1, Math.max(0, at[1])));
            }}
            style={{ width: dw, height: dh }}>
            <Image source={{ uri: photo.uri }} style={{ width: dw, height: dh, borderRadius: Spacing.three }} />
            <Svg width={dw} height={dh} style={StyleSheet.absoluteFill} pointerEvents="none">
              {holds.map((h) => {
                const pad = 5;
                const x = (h.x - h.w / 2) * dw - pad;
                const y = (h.y - h.h / 2) * dh - pad;
                const w = h.w * dw + pad * 2;
                const hh = h.h * dh + pad * 2;
                return (
                  <Rect
                    key={h.id}
                    x={x}
                    y={y}
                    width={w}
                    height={hh}
                    rx={8}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={h.manual ? 4.5 : 4.5}
                    strokeDasharray={h.manual ? '6 4' : undefined}
                  />
                );
              })}
              {holds.map((h) => {
                const pad = 5;
                return (
                  <Rect
                    key={`i${h.id}`}
                    x={(h.x - h.w / 2) * dw - pad}
                    y={(h.y - h.h / 2) * dh - pad}
                    width={h.w * dw + pad * 2}
                    height={h.h * dh + pad * 2}
                    rx={8}
                    fill="none"
                    stroke={theme.accent}
                    strokeWidth={2.5}
                    strokeDasharray={h.manual ? '6 4' : undefined}
                  />
                );
              })}
              {tips &&
                numbered.map((h) => {
                  const cx = (h.x - h.w / 2) * dw - 5;
                  const cy = (h.y - h.h / 2) * dh - 5;
                  return [
                    <Circle key={`c${h.n}`} cx={cx} cy={cy} r={9} fill={theme.accent} stroke="#FFFFFF" strokeWidth={1.5} />,
                    <SvgText key={`t${h.n}`} x={cx} y={cy + 3.5} fontSize={10} fontWeight="bold" fill="#FFFFFF" textAnchor="middle">
                      {String(h.n)}
                    </SvgText>,
                  ];
                })}
            </Svg>
            {busy && (
              <View style={[StyleSheet.absoluteFill, styles.busy]}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            )}
          </Pressable>
          </>
        )}
      </View>

      {seed && (
        <Card style={styles.pad}>
          <View style={styles.countRow}>
            <View style={[styles.swatch, { backgroundColor: seedRgb }]} />
            <ThemedText type="smallBold">
              {holds.length} {holds.length === 1 ? 'hold' : 'holds'} found
            </ThemedText>
          </View>
          {segNote && (
            <ThemedText type="small" themeColor="textSecondary">
              {segNote}
            </ThemedText>
          )}
          {wall && (
            <ThemedText type="small" themeColor="textSecondary">
              LiDAR: {wallLabel(wall.overhangDeg)}. Tips will use real distances.
              {offWall.length > 0
                ? ` Skipped ${offWall.length} ${offWall.length === 1 ? 'spot' : 'spots'} that ${offWall.length === 1 ? 'was' : 'were'} not on the wall.`
                : ''}
            </ThemedText>
          )}
          <Segmented
            label="Which holds"
            options={[
              { value: 'area', label: 'Route near my tap' },
              { value: 'wall', label: 'Whole wall' },
            ]}
            value={oneArea}
            onChange={setOneArea}
          />
          {farAway > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Left out {farAway} {farAway === 1 ? 'hold' : 'holds'} of this color far from your route. Choose “Whole wall” to see them.
            </ThemedText>
          )}
          <Segmented
            label="How many holds to find"
            options={SENSITIVITY_OPTIONS}
            value={sensitivity}
            onChange={(level) => {
              setSensitivity(level);
              runDetect(photo, seeds, level);
            }}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Missing holds? Tap one of them, or try "More". Too many? Try "Fewer", or tap the extras to remove them.
          </ThemedText>
          {!user ? (
            <Link href="/profile" asChild>
              <Pressable accessibilityRole="link">
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  Sign in to check holds with AI
                </ThemedText>
              </Pressable>
            </Link>
          ) : consent !== 'allowed' ? (
            <Button title="Turn on AI to check holds" variant="secondary" onPress={() => setConsent('allowed')} />
          ) : (
            holds.length >= 1 && (
              <Button
                title="Check with AI"
                variant="secondary"
                onPress={checkWithAi}
                loading={reviewing}
                disabled={holds.length > 150}
              />
            )
          )}
          {user && consent === 'allowed' && holds.length >= 1 && (
            <ThemedText type="small" themeColor="textSecondary">
              The AI check sends the photo, with the boxes drawn on it, to an AI service (Anthropic’s Claude) and is not
              kept by us.
            </ThemedText>
          )}
          {reviewNote && (
            <ThemedText type="small" themeColor="textSecondary">
              {reviewNote}
            </ThemedText>
          )}
        </Card>
      )}

      {seed && holds.length >= 1 && (
        <Card style={styles.pad}>
          <ThemedText type="smallBold">Technique tips</ThemedText>
          {!tips && (
            <ThemedText type="small" themeColor="textSecondary">
              Once the highlighted holds are your route, get a hold-by-hold read and one possible way to climb it. The
              photo is sent to an AI service (Anthropic’s Claude) for this and is not kept by us.
            </ThemedText>
          )}
          {!user ? (
            <Link href="/profile" asChild>
              <Pressable accessibilityRole="link">
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  Sign in to get technique tips
                </ThemedText>
              </Pressable>
            </Link>
          ) : holds.length > MAX_TIP_HOLDS ? (
            <ThemedText type="small" themeColor="textSecondary">
              That's a lot of holds. Remove the extras (the most is {MAX_TIP_HOLDS}) to get tips.
            </ThemedText>
          ) : consent !== 'allowed' ? (
            <Button title="Turn on AI for tips" variant="secondary" onPress={() => setConsent('allowed')} />
          ) : !acknowledged ? (
            <View style={styles.gap}>
              <ThemedText type="small">
                Tips are AI-generated suggestions about grip and body position, not instruction. They can be wrong.
                Climbing is dangerous. You climb at your own risk and judgment, and should ask a gym staff member or
                instructor about anything that feels unsafe.
              </ThemedText>
              <Button title="I understand" onPress={acknowledge} />
            </View>
          ) : (
            !tips && <Button title="Get technique tips" onPress={getTips} loading={tipsBusy} />
          )}
          {tipsError && (
            <ThemedText type="small" style={{ color: '#C0392B' }}>
              {tipsError}
            </ThemedText>
          )}
          {tips && (
            <ThemedText type="small" style={{ color: theme.accent }}>
              AI-generated tips
            </ThemedText>
          )}
          {tips && <TipsList tips={tips} />}
          {tips && <ReportTips tips={tips} />}
        </Card>
      )}

      <View style={styles.row}>
        {seed && (
          <View style={styles.flex}>
            <Button
              title="Pick another color"
              variant="secondary"
              onPress={() => {
                setSeeds([]); setAnchor(null);
                setAuto([]);
                setRemovedPts([]);
                setManual([]);
              }}
            />
          </View>
        )}
        <View style={styles.flex}>
          <Button title="New photo" variant="secondary" onPress={reset} />
        </View>
      </View>

      <HoldEditor
        visible={editing}
        uri={photo.uri}
        photoWidth={photo.width}
        photoHeight={photo.height}
        holds={holds}
        hasColor={!!seed}
        busy={busy}
        onTap={onTap}
        onRemoveBox={removeInBox}
        onPickAnotherColor={() => {
          setSeeds([]); setAnchor(null);
          setAuto([]);
          setRemovedPts([]);
          setManual([]);
        }}
        onClose={() => setEditing(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: Spacing.three },
  pad: { padding: Spacing.three, gap: Spacing.three, borderRadius: Spacing.three },
  imageWrap: { width: '100%' },
  busy: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: Spacing.three },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' },
  row: { flexDirection: 'row', gap: Spacing.two },
  tipRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  badge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});

function TipsList({ tips }: { tips: RouteTips }) {
  const theme = useTheme();
  const byN = new Map(tips.holds.map((h) => [h.n, h]));
  const ordered = [...tips.order.filter((n) => byN.has(n)), ...tips.holds.map((h) => h.n).filter((n) => !tips.order.includes(n))];
  const rows = ordered.map((n) => byN.get(n)!).filter((h) => h.type !== 'not_a_hold');
  const skipped = tips.holds.filter((h) => h.type === 'not_a_hold').map((h) => h.n);
  return (
    <View style={styles.gap}>
      {!!tips.overview && <ThemedText type="small">{tips.overview}</ThemedText>}
      {rows.map((h, i) => (
        <View key={h.n} style={styles.tipRow}>
          <View style={[styles.badge, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              {h.n}
            </ThemedText>
          </View>
          <View style={styles.flex}>
            <ThemedText type="smallBold">
              {i + 1}. {HOLD_TYPE_LABEL[h.type]}
              {h.foot ? ' (likely a foothold)' : ''}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {h.tip}
            </ThemedText>
          </View>
        </View>
      ))}
      {skipped.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Not climbing holds: {skipped.join(', ')}. Tap those on the photo to remove them.
        </ThemedText>
      )}
      {!!tips.caveats && (
        <ThemedText type="small" themeColor="textSecondary">
          {tips.caveats}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        This is one possible way to climb it, not the only way, and it's no substitute for instruction from a
        qualified climbing instructor. Numbers match the circles on the photo.
      </ThemedText>
    </View>
  );
}

function wallLabel(deg: number) {
  const a = Math.round(deg);
  if (Math.abs(a) < 5) return 'wall is about vertical';
  return a > 0 ? `wall overhangs about ${a}°` : `wall is a slab, leaning back about ${-a}°`;
}

/** "Report this tip": lets people flag AI-generated tips that are wrong, unsafe or inappropriate. */
function ReportTips({ tips }: { tips: RouteTips }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<TipReportReason>('wrong-or-unsafe');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await reportTips(tips, reason, details);
      setDone(true);
      setOpen(false);
    } catch {
      setError('Could not send the report. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Thanks. We'll review that tip.
      </ThemedText>
    );
  }
  if (!open) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          Report this tip
        </ThemedText>
      </Pressable>
    );
  }
  return (
    <View style={styles.gap}>
      <ThemedText type="smallBold">What's wrong with this tip?</ThemedText>
      <SingleChoice label="Reason" options={TIP_REPORT_REASONS} value={reason} onChange={setReason} />
      <Field label="Details (optional)" value={details} onChangeText={setDetails} multiline maxLength={1000} />
      {error && (
        <ThemedText type="small" style={{ color: '#C0392B' }}>
          {error}
        </ThemedText>
      )}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button title="Cancel" variant="secondary" onPress={() => setOpen(false)} />
        </View>
        <View style={styles.flex}>
          <Button title="Send report" onPress={send} loading={busy} />
        </View>
      </View>
    </View>
  );
}
