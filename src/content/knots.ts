import { analyse, offset, openKnot, figureEight, trefoil, type Rope } from '@/lib/knots/geometry';

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

function overhand(): Knot {
  const rope = analyse(openKnot(trefoil, { cut: 1.18, gap: 0.2, tail: 50, scale: 28, cx: 150, cy: 150, spread: 0.9 }), 5);
  return {
    id: 'stopper',
    title: 'Stopper knot',
    summary: 'A simple overhand backup. Tie it in the tail after your tie-in knot.',
    rope,
    steps: [
      { caption: 'Lay the end of the rope across the standing part to start a loop.', to: 0.34 },
      { caption: 'Take the end behind the loop and bring it up through the middle.', to: 0.72 },
      { caption: 'Pull the end and the standing part apart to snug it down tight against your main knot.', to: 1 },
    ],
  };
}

function figureEightStopper(): Knot {
  const raw = openKnot(figureEight, { cut: 0, gap: 0.16, tail: 50, scale: 28, cx: 150, cy: 150, spread: 0.9 });
  return {
    id: 'figure-eight',
    title: 'Figure-eight knot',
    summary: 'The knot at the heart of the tie-in. Shown loose so you can follow the rope.',
    rope: analyse(raw, 5),
    steps: [
      { caption: 'Make a bend in the rope and cross the end over the standing part.', to: 0.3 },
      { caption: 'Wrap the end around the standing part, then pass it back through the loop.', to: 0.7 },
      { caption: 'Dress it so each strand lies flat beside the next, then pull it tight.', to: 1 },
    ],
  };
}

function figureEightFollowThrough(): Knot {
  const raw = openKnot(figureEight, { cut: 0, gap: 0.16, tail: 50, scale: 28, cx: 150, cy: 150, spread: 0.9 });
  const rope = analyse(raw, 5);
  // The tail returns along the same path, one rope-width beside it, running the other way.
  const back = analyse(offset([...raw].reverse(), 13), 5);
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

export const KNOTS: Knot[] = [figureEightFollowThrough(), figureEightStopper(), overhand()];
export const getKnot = (id?: string) => KNOTS.find((k) => k.id === id);
export const KNOT_VIEWBOX = VIEW;
