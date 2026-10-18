/**
 * Core data model. These shapes are the contract between the app and whatever
 * backend we pick (Firebase or Supabase); keep them backend-agnostic.
 */

export type LatLng = { latitude: number; longitude: number };

export type ClimbingStyle = 'bouldering' | 'top-rope' | 'lead' | 'trad' | 'multipitch' | 'ice';

export type AreaSource = 'osm' | 'overture' | 'openbeta' | 'mapkit' | 'google-places' | 'user';

/** An indoor gym (from OpenStreetMap) or an outdoor crag (from OpenBeta). */
export type ClimbingArea = {
  /** Stable across sources, e.g. "osm:way/123" or "openbeta:<uuid>". */
  id: string;
  kind: 'gym' | 'crag';
  name: string;
  location: LatLng;
  address?: string;
  styles: ClimbingStyle[];
  /** Where the record came from, so we can attribute and refresh it. */
  source: AreaSource;
  sourceId?: string;
  website?: string;
  phone?: string;
  /** Raw OpenStreetMap opening_hours, e.g. "Mo-Fr 06:00-22:00; Sa,Su 09:00-20:00". */
  openingHours?: string;
  /** Crags: number of routes/problems recorded. */
  climbCount?: number;
  /** Crags: the parent area, e.g. "Pilot Mountain State Park". */
  region?: string;
  /** Crags: full location path, e.g. ["USA", "North Carolina", "Pilot Mountain"]. */
  path?: string[];
};

export type AuthProvider = 'email' | 'apple' | 'google' | 'facebook';

export type ClimberProfile = {
  userId: string;
  /** Empty until the user fills in their profile after first sign-in. */
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  /** City or area the user climbs in most, e.g. "Raleigh, NC". */
  homeArea?: string;
  styles: ClimbingStyle[];
  /** Free-text grades so users can use V-scale, Font, YDS, French, etc. */
  boulderGrade?: string;
  routeGrade?: string;
  yearsClimbing?: number;
  hasGear: { rope: boolean; quickdraws: boolean; rack: boolean; crashPad: boolean };
  /** Belay certifications the user self-reports (e.g. "top-rope", "lead"). */
  belayCertified: BelayCert[];
  /** Private. Rounded to 5 kg; only used for the lead weight-match hint. */
  weightKg?: number;
  /** Comfortable with an assisted-braking device (GriGri etc.). */
  assistedBraking: boolean;
};

export type BelayCert = 'top-rope' | 'lead';

/** A saved gym or crag. Stores a snapshot because areas come from outside sources. */
export type Favorite = {
  areaId: string;
  areaKind: ClimbingArea['kind'];
  source: ClimbingArea['source'];
  name: string;
  location: LatLng;
  createdAt: string;
};

/** A gym whose belay board the user follows. Snapshot like Favorite. */
export type HomeGym = {
  areaId: string;
  name: string;
  location: LatLng;
};

export type SessionGoal = 'projecting' | 'mileage' | 'learning-lead' | 'top-rope-laps' | 'bouldering';

/**
 * A post on a gym's belay board: who, which gym, and when. Never a position.
 * Posts disappear when the time window ends.
 */
export type BelayPost = {
  id: string;
  userId: string;
  areaId: string;
  areaName: string;
  startsAt: string;
  endsAt: string;
  hereNow: boolean;
  goal: SessionGoal;
  styles: ('bouldering' | 'top-rope' | 'lead')[];
  gradeLow?: string;
  gradeHigh?: string;
  /** Offering to mentor someone newer, so grade mismatches are welcome. */
  mentoring: boolean;
  note?: string;
};

export type WeightHint = 'similar' | 'some-difference' | 'large-difference';

/** What other signed-in climbers can see about someone. */
export type ClimberCard = {
  userId: string;
  displayName?: string;
  bio?: string;
  homeArea?: string;
  styles: ClimbingStyle[];
  boulderGrade?: string;
  routeGrade?: string;
  yearsClimbing?: number;
  /** Self-reported belay skills. */
  belayCertified: BelayCert[];
  assistedBraking: boolean;
  memberSince: string;
  /** Lead weight-compatibility hint with the viewer; never the weight itself. */
  weightHint?: WeightHint;
};

export type ChatMessage = {
  id: number;
  postId: string;
  responderId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

/** Output of the Route AI hold detector for one wall photo. */
export type HoldShape = 'jug' | 'crimp' | 'sloper' | 'pinch' | 'pocket' | 'edge' | 'volume' | 'foot' | 'unknown';

export type DetectedHold = {
  id: string;
  /** Polygon in normalized image coordinates (0–1). */
  outline: { x: number; y: number }[];
  color: string;
  shape: HoldShape;
  /** Model confidence 0–1; low-confidence holds are shown for the user to confirm. */
  confidence: number;
  isStart?: boolean;
  isFinish?: boolean;
};
