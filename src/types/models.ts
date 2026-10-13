/**
 * Core data model. These shapes are the contract between the app and whatever
 * backend we pick (Firebase or Supabase); keep them backend-agnostic.
 */

export type LatLng = { latitude: number; longitude: number };

export type ClimbingStyle = 'bouldering' | 'top-rope' | 'lead' | 'trad' | 'multipitch' | 'ice';

export type AreaSource = 'osm' | 'openbeta' | 'mapkit' | 'google-places' | 'user';

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

/**
 * A partner-finder listing. Location is deliberately coarse (a city/area name
 * plus a rounded point) so we never expose anyone's exact position.
 */
export type PartnerListing = {
  id: string;
  userId: string;
  areaName: string;
  approxLocation: LatLng;
  /** Set when someone is posting for a trip rather than their home area. */
  travel?: { from: string; to: string };
  styles: ClimbingStyle[];
  note?: string;
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
