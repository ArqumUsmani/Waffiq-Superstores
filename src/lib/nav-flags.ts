/**
 * One-frame coordination between the launch transition and the root
 * layout's scroll reset.
 *
 * The transition scrolls to the top itself, while the flood is opaque and
 * before it commits the route — that ordering matters, because Home's
 * pin-spacer is what holds the document tall, and unmounting it at scroll
 * depth makes the browser clamp the position, a jump visible the instant
 * the flood lifts. The layout must then not scroll again on arrival.
 */
export const navFlags = {
  skipScrollReset: false,
};
