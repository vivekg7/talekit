/**
 * The shape of the frame. A film is landscape; a reel is portrait (taller than wide), for a
 * phone held upright, and the apps that play reels (Instagram, YouTube Shorts) draw their
 * own caption, buttons and progress bar over its edges, so a reel keeps its text and its
 * action inside a safe area. Pure.
 */

interface Size {
  width: number;
  height: number;
}

/** Taller than it is wide: a reel. */
export const isPortrait = ({ width, height }: Size): boolean => height > width;

/**
 * How large text, bubbles and drawn effects are, 1 at 720 pixels: by the frame's short side,
 * so a 720 × 1280 reel's text is the size a 1280 × 720 film's is, set against the same width
 * of phone screen.
 */
export const uiScale = ({ width, height }: Size): number => Math.min(width, height) / 720;

/** The longest reel the apps take: three minutes. */
export const REEL_SECONDS = 180;

/**
 * What the reel apps cover, in pixels from each edge: the account name and caption along the
 * bottom, the like and share buttons down the right, the camera and search icons at the top.
 * A landscape film has none.
 */
export function safeInsets(size: Size): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (!isPortrait(size)) return { top: 0, right: 0, bottom: 0, left: 0 };
  const { width: W, height: H } = size;
  return { top: H * 0.1, right: W * 0.14, bottom: H * 0.22, left: W * 0.06 };
}

/**
 * Where the floor is in a scene that does not say: near the bottom of a film's frame, and in
 * a reel just above what its app covers, so feet are not under the caption.
 */
export const defaultGround = (size: Size): number =>
  isPortrait(size) ? size.height * 0.78 : size.height * 0.9;

/**
 * The stage shortcuts left and right, as a share of the width: well apart in a film, and in
 * a reel's narrow frame drawn in from the buttons down its right edge.
 */
export const stageSides = (size: Size): [number, number] =>
  isPortrait(size) ? [0.26, 0.72] : [0.22, 0.78];
