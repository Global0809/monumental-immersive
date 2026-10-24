/** Fixed document coordinates: scroll never rescales a chapter's travel distance. */
export function transitionAnchor(top: number, viewport: number, extent: number, maxScroll: number, previousAnchor = -Infinity) {
  const first = viewport + extent + 24;
  const last = maxScroll - extent;
  if (last < first) return null;
  const anchor = Math.max(first, Math.min(last, top));
  // Adjacent chapters may share a viewport; near-identical boundaries do not
  // deserve another change of palette. Never move a boundary to make it fit.
  if (anchor - previousAnchor < viewport * .36) return null;
  return { anchor, startY: anchor - viewport - extent, endY: anchor + extent };
}
