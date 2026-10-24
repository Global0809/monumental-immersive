import type { ErosionContour } from './erosionContour';

export type TransitionVariant = 'ink' | 'silk' | 'rift' | 'facet' | 'bloom';
export interface TransitionContourOptions {
  width: number;
  height: number;
  /** The chapter's document anchor minus the actual scroll offset, in pixels. */
  frontY: number;
  seed: number | string;
  variant: TransitionVariant;
}
type Point = { x: number; y: number };
type Polygon = { points: readonly Point[]; left: number; top: number; right: number; bottom: number };
type Shape = { polygons: readonly Polygon[]; pointCount: number };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const finite = (n: number, fallback: number) => Number.isFinite(n) ? n : fallback;
const dimension = (n: number) => clamp(finite(n, 1), 1, 32768);
const smooth = (n: number) => n * n * n * (n * (n * 6 - 15) + 10);
const round = (n: number) => Math.round(n * 1000) / 1000;
const cache = new Map<string, Shape>();
const CACHE_SIZE = 12;

/** A common, conservative margin for all five materials, including their islands. */
export function transitionExtent(width: number, height: number) {
  return Math.max(24, Math.min(dimension(height) * .34, dimension(width) * .42, 360));
}

function seedHash(seed: number | string) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 2147483647.5 - 1;
}
function noise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), u = smooth(x - ix), v = smooth(y - iy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a + (a - b - c + d) * u) * v;
}
function softUnion(a: number, b: number, radius: number) {
  const h = Math.max(radius - Math.abs(a - b), 0) / radius;
  return Math.max(a, b) + h * h * radius * .25;
}
function ellipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  return (1 - Math.hypot((x - cx) / rx, (y - cy) / ry)) * ry;
}
function material(variant: Exclude<TransitionVariant, 'facet'>, seed: number) {
  const shift = hash(8, 15, seed) * .08, lean = hash(12, 6, seed) * .12;
  const base = (x: number) => .1 + lean * (x - .5) + noise(x * 2.2 + 4, 2, seed) * .20;
  const pools = Array.from({ length: 5 }, (_, i) => ({
    x: .07 + i * .22 + hash(i, 13, seed) * .022,
    y: -.03 + hash(i, 17, seed) * .1,
    rx: .105 + (hash(i, 23, seed) + 1) * .022,
    ry: .32 + (hash(i, 29, seed) + 1) * .09,
  }));
  return (x: number, y: number) => {
    let value: number;
    if (variant === 'silk') {
      // A long, taut S-fold: a quiet edge with one generous curved recession.
      const fold = -.32 + .55 * smooth(clamp(x + shift, 0, 1))
        + .31 * Math.exp(-(((x - .29 - shift) / .23) ** 2))
        - .46 * Math.exp(-(((x - .80 + shift) / .21) ** 2))
        + lean * (x - .5);
      value = y - fold;
    } else if (variant === 'bloom') {
      // Large coalescing pools, plus a few separate droplets immediately ahead.
      value = y - base(x) - .16;
      for (const pool of pools) value = softUnion(value, ellipse(x, y, pool.x, pool.y, pool.rx, pool.ry), .075);
      value = Math.max(value, ellipse(x, y, .315 + shift, -.68, .017, .055));
      value = Math.max(value, ellipse(x, y, .755 - shift, -.66, .024, .073));
      value = Math.min(value, -ellipse(x, y, .54 + shift, .28, .017, .055));
    } else if (variant === 'rift') {
      // A diagonal tear. Directional fingers and thin slits share its grain.
      const diagonal = .31 - .71 * x + lean + noise(x * 3 + 7, 3, seed) * .12;
      const grainX = x * 25 + y * 9;
      value = y - diagonal + noise(grainX, y * 3, seed + 19) * .15
        + noise(x * 92 + y * 29, y * 8, seed + 23) * .025;
      for (const cx of [.22 + shift, .56 - shift, .85 + shift]) {
        const cy = .31 - .71 * cx + lean;
        const skewX = x - (y - cy) * .30;
        value = Math.max(value, ellipse(skewX, y, cx, cy - .14, .022, .24));
        value = Math.min(value, -ellipse(skewX, y, cx + .057, cy + .17, .006, .095));
      }
    } else {
      // Pooled ink: domain-warped lobes, rolled undercuts and sparse pinholes.
      const warp = noise(x * 5 + 4, y * 3 + 2, seed + 3);
      const profile = base(x) + noise(x * 5.8 + 3, 7, seed + 7) * .17;
      value = y - profile
        + noise(x * 7 + warp * .65, y * 4.5 + 11, seed + 11) * .20
        + noise(x * 29 + y * .7, y * 16 + 31, seed + 17) * .026
        + noise(x * 86 + y * 9, y * 37 + 17, seed + 29) * .006;
      value = softUnion(value, ellipse(x, y, .19 + shift, -.28, .105, .28), .07);
      value = softUnion(value, ellipse(x, y, .72 - shift, -.18, .08, .27), .055);
      // Kept away from the page's clean regions; these give real topology,
      // not the appearance of a roughened horizontal wave.
      value = Math.min(value, -ellipse(x, y, .19 + shift, -.05, .014, .058));
      value = Math.min(value, -ellipse(x, y, .72 - shift, .04, .011, .043));
      value = Math.max(value, ellipse(x, y, .43 + shift, -.48, .011, .044));
    }
    // All contours finish beyond the viewport before an endpoint is simplified.
    return Math.max(Math.min(value, (y + .94) * 2), (y - .94) * 2);
  };
}

function pointSegmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function simplify(points: Point[], tolerance: number): Point[] {
  // Ramer-Douglas-Peucker on a closed contour, split at its farthest vertex.
  // The SAME reduced polygon is both painted and sampled; no Bézier mismatch.
  const line = (source: Point[]): Point[] => {
    if (source.length <= 2) return source;
    const keep = new Uint8Array(source.length); keep[0] = keep[source.length - 1] = 1;
    const stack = [0, source.length - 1];
    while (stack.length) {
      const end = stack.pop()!, start = stack.pop()!;
      let farthest = tolerance, index = -1;
      for (let i = start + 1; i < end; i++) {
        const distance = pointSegmentDistance(source[i], source[start], source[end]);
        if (distance > farthest) { farthest = distance; index = i; }
      }
      if (index !== -1) { keep[index] = 1; stack.push(start, index, index, end); }
    }
    return source.filter((_, i) => keep[i]);
  };
  let split = 1, distance = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y);
    if (d > distance) { distance = d; split = i; }
  }
  return [...line(points.slice(0, split + 1)).slice(0, -1), ...line([...points.slice(split), points[0]]).slice(0, -1)];
}
function polygon(points: Point[]): Polygon {
  const rounded = points.map(p => Object.freeze({ x: round(p.x), y: round(p.y) }));
  return Object.freeze({
    points: Object.freeze(rounded),
    left: Math.min(...rounded.map(p => p.x)), right: Math.max(...rounded.map(p => p.x)),
    top: Math.min(...rounded.map(p => p.y)), bottom: Math.max(...rounded.map(p => p.y)),
  });
}

function makeFacets(width: number, height: number, extent: number, seed: number): Polygon[] {
  const shift = hash(3, 7, seed) * .08;
  const vertices = [[-.02, .12], [.12, -.60], [.29, -.48], [.40, .33], [.57, -.12], [.70, .21], [.88, -.12], [1.02, -.34]];
  const points = vertices.map(([x, y], i) => ({ x: x * width, y: (y + shift + hash(i, 31, seed) * .08) * extent }));
  points.push({ x: width * 1.02, y: height + extent * 3 }, { x: -width * .02, y: height + extent * 3 });
  const fragment = [
    { x: width * .48, y: extent * (-.48 + shift) },
    { x: width * .55, y: extent * (-.62 + shift) },
    { x: width * .52, y: extent * (-.30 + shift) },
  ];
  const cutout = [
    { x: width * .23, y: extent * (.07 + shift) },
    { x: width * .27, y: extent * (.10 + shift) },
    { x: width * .25, y: extent * (-.11 + shift) },
  ];
  return [polygon(points), polygon(fragment), polygon(cutout)];
}

const edgePairs = [[], [3, 0], [0, 1], [3, 1], [1, 2], [], [0, 2], [3, 2], [2, 3], [2, 0], [], [2, 1], [1, 3], [0, 1], [0, 3], []];
function sampleMaterial(width: number, height: number, extent: number, variant: Exclude<TransitionVariant, 'facet'>, seed: number) {
  const field = material(variant, seed);
  const nx = clamp(Math.ceil(width / 2.5), 80, 640), ny = clamp(Math.ceil(extent * 2 / 2.25), 64, 192);
  const xs = [-8, -4, ...Array.from({ length: nx + 1 }, (_, i) => i * width / nx), width + 4, width + 8];
  const ys = Array.from({ length: ny + 1 }, (_, i) => -extent + i * extent * 2 / ny);
  // The lower closure remains safely outside the view for every active frontY.
  ys.push(height + extent * 3, height + extent * 3 + 4);
  const cols = xs.length, rows = ys.length, values = new Float64Array(cols * rows);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    values[row * cols + col] = row === 0 || row === rows - 1 || col === 0 || col === cols - 1 ? -1e6
      : row > ny ? 1 : field(xs[col] / width, ys[row] / extent);
  }
  const points: Point[] = [], neighbors: number[][] = [], indices = new Map<number, number>();
  const horizontalCount = rows * (cols - 1);
  for (let row = 0; row < rows - 1; row++) for (let col = 0; col < cols - 1; col++) {
    const index = row * cols + col;
    const a = values[index], b = values[index + 1], c = values[index + cols + 1], d = values[index + cols];
    const code = (a >= 0 ? 1 : 0) | (b >= 0 ? 2 : 0) | (c >= 0 ? 4 : 0) | (d >= 0 ? 8 : 0);
    if (code === 0 || code === 15) continue;
    const centerInside = (a + b + c + d) >= 0;
    const pairs = code === 5 ? (centerInside ? [0, 1, 2, 3] : [3, 0, 1, 2])
      : code === 10 ? (centerInside ? [3, 0, 1, 2] : [0, 1, 2, 3]) : edgePairs[code];
    const vertex = (edge: number) => {
      const id = edge === 0 ? row * (cols - 1) + col : edge === 2 ? (row + 1) * (cols - 1) + col
        : horizontalCount + row * cols + col + (edge === 1 ? 1 : 0);
      let result = indices.get(id);
      if (result !== undefined) return result;
      let x = xs[col], y = ys[row];
      if (edge === 0) x += (xs[col + 1] - x) * a / (a - b);
      if (edge === 1) { x = xs[col + 1]; y += (ys[row + 1] - y) * b / (b - c); }
      if (edge === 2) { x += (xs[col + 1] - x) * d / (d - c); y = ys[row + 1]; }
      if (edge === 3) y += (ys[row + 1] - y) * a / (a - d);
      result = points.length; points.push({ x, y }); neighbors.push([]); indices.set(id, result);
      return result;
    };
    for (let i = 0; i < pairs.length; i += 2) {
      const start = vertex(pairs[i]), end = vertex(pairs[i + 1]);
      neighbors[start].push(end); neighbors[end].push(start);
    }
  }
  const visited = new Uint8Array(points.length), polygons: Polygon[] = [];
  for (let i = 0; i < points.length; i++) {
    if (visited[i]) continue;
    const loop: Point[] = [];
    let current = i, previous = -1;
    while (!visited[current]) {
      visited[current] = 1; loop.push(points[current]);
      const next = neighbors[current].find(n => n !== previous);
      if (next === undefined) break;
      previous = current; current = next;
    }
    if (loop.length < 3) continue;
    const area = Math.abs(loop.reduce((sum, p, j) => { const q = loop[(j + 1) % loop.length]; return sum + p.x * q.y - p.y * q.x; }, 0)) * .5;
    if (area < 1.2) continue;
    polygons.push(polygon(simplify(loop, Math.max(.20, width / 6000))));
  }
  return polygons;
}

function insidePolygon(shape: Polygon, x: number, y: number) {
  if (x < shape.left || x > shape.right || y < shape.top || y > shape.bottom) return false;
  const points = shape.points;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function getShape(width: number, height: number, variant: TransitionVariant, seed: number): Shape {
  const key = [width, height, variant, seed].join(':');
  const cached = cache.get(key);
  if (cached) { cache.delete(key); cache.set(key, cached); return cached; }
  const extent = transitionExtent(width, height);
  const polygons = variant === 'facet' ? makeFacets(width, height, extent, seed) : sampleMaterial(width, height, extent, variant, seed);
  // Nonzero winding is supported as well as evenodd: holes oppose their parent.
  const oriented = polygons.map(p => {
    const first = p.points[0];
    const depth = polygons.filter(other => other !== p && insidePolygon(other, first.x, first.y)).length;
    const area = p.points.reduce((sum, a, i) => { const b = p.points[(i + 1) % p.points.length]; return sum + a.x * b.y - a.y * b.x; }, 0);
    return (area > 0) === (depth % 2 === 0) ? p : polygon([...p.points].reverse());
  });
  const shape = Object.freeze({ polygons: Object.freeze(oriented), pointCount: oriented.reduce((n, p) => n + p.points.length, 0) });
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
  cache.set(key, shape);
  return shape;
}

function segmentTouchesRect(a: Point, b: Point, left: number, top: number, right: number, bottom: number) {
  // Liang-Barsky clipping includes tangency and closed pockets inside the box.
  if (Math.max(a.x, b.x) < left || Math.min(a.x, b.x) > right || Math.max(a.y, b.y) < top || Math.min(a.y, b.y) > bottom) return false;
  let enter = 0, leave = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy], q = [a.x - left, right - a.x, a.y - top, bottom - a.y];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) enter = Math.max(enter, t); else leave = Math.min(leave, t);
    if (enter > leave) return false;
  }
  return true;
}

/**
 * Build once, translate with the document. There is deliberately no time,
 * progress mapping, scroll smoothing or moving material field in this service.
 * Rounded polygon vertices are the single source for SVG and text classification.
 */
export function buildTransitionContour(options: TransitionContourOptions): ErosionContour {
  const width = dimension(options.width), height = dimension(options.height);
  const extent = transitionExtent(width, height), frontY = finite(options.frontY, height + extent);
  const edgeSoftness = .65;
  if (frontY >= height + extent || frontY <= -extent) {
    const full = frontY <= -extent;
    return {
      path: full ? `M0 0H${width}V${height}H0Z` : '', frontierAt: () => frontY,
      incomingAt: () => full, classifyRect: () => full ? 'to' : 'from', pointCount: full ? 4 : 0, edgeSoftness,
    };
  }
  const variant = ['ink', 'silk', 'rift', 'facet', 'bloom'].includes(options.variant) ? options.variant : 'ink';
  const shape = getShape(width, height, variant, seedHash(options.seed));
  const incomingAt = (x: number, y: number) => {
    const px = clamp(finite(x, 0), 0, width), py = finite(y, 0) - frontY;
    if (py < -extent) return false;
    if (py > extent) return true;
    let inside = false;
    for (const p of shape.polygons) if (insidePolygon(p, px, py)) inside = !inside;
    return inside;
  };
  const classifyRect: ErosionContour['classifyRect'] = (left, top, right, bottom) => {
    const l = clamp(Math.min(finite(left, 0), finite(right, width)), 0, width) - edgeSoftness;
    const r = clamp(Math.max(finite(left, 0), finite(right, width)), 0, width) + edgeSoftness;
    const t = Math.min(finite(top, 0), finite(bottom, height)) - frontY - edgeSoftness;
    const b = Math.max(finite(top, 0), finite(bottom, height)) - frontY + edgeSoftness;
    if (b < -extent) return 'from';
    if (t > extent) return 'to';
    for (const p of shape.polygons) {
      if (p.right < l || p.left > r || p.bottom < t || p.top > b) continue;
      for (let i = 0; i < p.points.length; i++) {
        if (segmentTouchesRect(p.points[i], p.points[(i + 1) % p.points.length], l, t, r, b)) return 'mixed';
      }
    }
    return incomingAt((l + r) / 2, (t + b) / 2 + frontY) ? 'to' : 'from';
  };
  const frontierAt = (x: number) => {
    const px = clamp(finite(x, 0), 0, width);
    let first = Infinity;
    for (const p of shape.polygons) {
      if (px < p.left || px > p.right) continue;
      for (let i = 0; i < p.points.length; i++) {
        const a = p.points[i], b = p.points[(i + 1) % p.points.length];
        if (a.x === b.x) { if (a.x === px) first = Math.min(first, a.y, b.y); continue; }
        if (px >= Math.min(a.x, b.x) && px <= Math.max(a.x, b.x)) first = Math.min(first, a.y + (b.y - a.y) * (px - a.x) / (b.x - a.x));
      }
    }
    return frontY + (Number.isFinite(first) ? first : extent);
  };
  const path = shape.polygons.map(p => p.points.map((point, i) => `${i ? 'L' : 'M'}${point.x} ${point.y + frontY}`).join('') + 'Z').join('');
  return { path, frontierAt, incomingAt, classifyRect, pointCount: shape.pointCount, edgeSoftness };
}
