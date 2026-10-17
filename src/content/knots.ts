import { analyse, offset, openKnot, figureEight, type Rope } from '@/lib/knots/geometry';

/**
 * Animated knot tutorials. The shapes come from true knot curves (an overhand knot is a
 * trefoil, a figure-eight is the four-crossing knot), so where the rope goes over and under
 * is correct by construction. The captions are drafts and must be checked against a real
 * rope by an instructor before release.
 */
export type KnotStep = { caption: string; /** Where this step ends: 0 to 1 draws the main rope, 1 to 2 then draws the returning strand. */ to: number };

export type Knot = {
  id: string;
  title: string;
  summary: string;
  /** Main rope, from the first tail through the knot to the second tail. */
  rope: Rope;
  /** Optional second strand that follows the first back through the knot (follow-through). */
  retrace?: Rope;
  steps: KnotStep[];
};

const VIEW = 300;

function figureEightFollowThrough(): Knot {
  const raw = openKnot(figureEight, { cut: 0, gap: 0.16, tail: 50, scale: 31, cx: 150, cy: 150, spread: 0.9 });
  const rope = analyse(raw, 9);
  // The tail returns along the same path, one rope-width beside it, running the other way.
  const back = analyse(offset([...raw].reverse(), 16), 9);
  return {
    id: 'figure-eight-follow-through',
    title: 'Figure-eight follow-through',
    summary: 'The standard tie-in: tie a figure-eight, then follow it back with the tail.',
    rope,
    retrace: back,
    steps: [
      { caption: 'Tie a loose figure-eight in the rope, leaving a long tail. (In real life, pass the tail through your harness tie-in points before you follow it back.)', to: 1 },
      { caption: 'Bring the tail back and start following the original strand, staying right beside it.', to: 1.5 },
      { caption: 'Follow the original strand through every bend, side by side with no crossings.', to: 2 },
      { caption: 'Pull every strand tight. Leave a tail of at least 6 inches (15 cm) and have a partner check it.', to: 2 },
    ],
  };
}

export const KNOTS: Knot[] = [figureEightFollowThrough()];
export const getKnot = (id?: string) => KNOTS.find((k) => k.id === id);
export const KNOT_VIEWBOX = VIEW;
