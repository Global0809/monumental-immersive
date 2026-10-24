/** Seeded two-dimensional material, revealed by a scroll-controlled threshold. */
export interface ErosionContourOptions {
  width: number; height: number; progress: number; seed: number | string;
  macroAmplitude?: number; detailAmount?: number; direction?: 'up' | 'down';
  /** SVG uses native antialiasing, never a blurred fringe. */
  edgeSoftness?: number;
}
export interface ErosionContour {
  path: string; frontierAt: (x: number) => number;
  incomingAt: (x: number, y: number) => boolean;
  pointCount: number; edgeSoftness: number;
}
type Point = { x: number; y: number };
type Field = { values: Float32Array; rowMin: Float32Array; rowMax: Float32Array; cols: number; rows: number; step: number; bleed: number; scale: number };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const finite = (n: number | undefined, fallback: number) => Number.isFinite(n) ? n as number : fallback;
const round = (n: number) => Math.round(n * 100) / 100;
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
function seedHash(seed: string | number) {
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
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a + (a - b - c + d) * u) * v;
}
// Sample each material once. Four bounded grids retain nearby chapters on reversal.
const fields = new Map<string, Field>();
function material(width: number, height: number, seed: number, amplitude: number, detail: number): Field {
  const key = [width, height, seed, amplitude, detail].join(':');
  const cached = fields.get(key);
  if (cached) return cached;
  const contourHeight = Math.min(height, width * 1.1), scale = clamp(contourHeight / 800, .48, 1.4);
  const step = Math.max(1.6, width / 640, height / 650);
  const cols = Math.ceil(width / step) + 3, rows = Math.ceil(height / step) + 3;
  const values = new Float32Array(cols * rows), broad = new Float32Array(cols);
  const rowMin = new Float32Array(rows), rowMax = new Float32Array(rows);
  const lean = hash(41, 17, seed) * .42;
  for (let col = 0; col < cols; col++) {
    const x = (col - 1) * step / width;
    broad[col] = contourHeight * amplitude * (noise(x * 2.2 + 11, 3.7, seed + 7) * .62
      + noise(x * 4.8 + 31, 8.3, seed + 19) * .15 + (x - .5) * lean);
  }
  for (let row = 0; row < rows; row++) {
    const y = (row - 1) * step;
    let min = Infinity, max = -Infinity;
    for (let col = 0; col < cols; col++) {
      const x = (col - 1) * step;
      let texture = 0;
      if (detail > 0) {
        // Domain warping produces overhangs, narrow necks and actual cavities.
        const wx = x / scale + noise(x / (76 * scale), y / (83 * scale), seed + 29) * 24;
        const wy = y / scale + noise(x / (63 * scale) + 9, y / (71 * scale), seed + 37) * 20;
        const lobes = noise(wx / 31, wy / 27, seed + 47) * 19;
        const tears = noise((wx + wy * .32) / 11, wy / 9, seed + 59) * 8;
        const fibers = noise((wx + wy * .8) / 13, wy / 3.8, seed + 71) * 2.8;
        texture = (lobes + tears + fibers) * scale * detail;
      }
      values[row * cols + col] = y - broad[col] + texture;
      min = Math.min(min, values[row * cols + col]); max = Math.max(max, values[row * cols + col]);
    }
    rowMin[row] = min; rowMax[row] = max;
  }
  const field = { values, rowMin, rowMax, cols, rows, step, scale, bleed: contourHeight * amplitude * 1.05 + 34 * scale * detail + step * 3 };
  if (fields.size >= 4) fields.delete(fields.keys().next().value!);
  fields.set(key, field);
  return field;
}
function sample(f: Field, x: number, y: number) {
  const gx = clamp(x / f.step + 1, 0, f.cols - 1.000001), gy = clamp(y / f.step + 1, 0, f.rows - 1.000001);
  const ix = Math.floor(gx), iy = Math.floor(gy), u = gx - ix, v = gy - iy;
  const a = f.values[iy * f.cols + ix], b = f.values[iy * f.cols + ix + 1];
  const c = f.values[(iy + 1) * f.cols + ix], d = f.values[(iy + 1) * f.cols + ix + 1];
  return a + (b - a) * u + (c - a + (a - b - c + d) * u) * v;
}
function simplify(points: Point[], tolerance: number) {
  for (let pass = 0; pass < 2 && points.length > 12; pass++) points = points.filter((p, i) => {
    const a = points[(i + points.length - 1) % points.length], b = points[(i + 1) % points.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    return length < .001 || Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / length > tolerance || i % 8 === 0;
  });
  return points;
}
const pairs: number[][] = [[],[3,0],[0,1],[3,1],[1,2],[],[0,2],[3,2],[2,3],[2,0],[],[2,1],[1,3],[1,0],[0,3],[]];
/** Optional idle preflight: builds the bounded material, without changing visual state. */
export function prepareErosionContour(options: ErosionContourOptions) {
  material(clamp(finite(options.width, 1), 1, 32768), clamp(finite(options.height, 1), 1, 32768), seedHash(options.seed), clamp(finite(options.macroAmplitude, .15), 0, .3), clamp(finite(options.detailAmount, 1), 0, 2));
}
export function buildErosionContour(options: ErosionContourOptions): ErosionContour {
  const width = clamp(finite(options.width, 1), 1, 32768), height = clamp(finite(options.height, 1), 1, 32768);
  const progress = clamp(finite(options.progress, 0), 0, 1);
  const amplitude = clamp(finite(options.macroAmplitude, .15), 0, .3), detail = clamp(finite(options.detailAmount, 1), 0, 2);
  const edgeSoftness = clamp(finite(options.edgeSoftness, .65), .25, 1.5), down = options.direction === 'down';
  if (progress === 0 || progress === 1) return {
    path: progress ? 'M0 0H' + round(width) + 'V' + round(height) + 'H0Z' : '',
    frontierAt: () => progress ? (down ? height + 1 : -1) : (down ? -1 : height + 1),
    incomingAt: () => progress === 1, pointCount: progress ? 4 : 0, edgeSoftness,
  };
  const f = material(width, height, seedHash(options.seed), amplitude, detail);
  const { cols, rows, step, values, bleed } = f;
  const threshold = height + bleed - progress * (height + bleed * 2);
  const incomingAt = (x: number, y: number) => sample(f, clamp(finite(x, 0), 0, width), down ? height - finite(y, 0) : finite(y, 0)) >= threshold;
  const frontierAt = (pixelX: number) => {
    const x = clamp(finite(pixelX, 0), 0, width);
    if (sample(f, x, -step) >= threshold) return down ? height + bleed : -bleed;
    let previous = sample(f, x, -step) - threshold;
    for (let y = 0; y <= height + step; y += step) {
      const next = sample(f, x, y) - threshold;
      if (next >= 0 && previous < 0) {
        const result = y - step + step * -previous / (next - previous);
        return down ? height - result : result;
      }
      previous = next;
    }
    return down ? -bleed : height + bleed;
  };
  if (amplitude === 0 && detail === 0) {
    const y = down ? height - threshold : threshold;
    return { path: down ? 'M0 0H' + width + 'V' + round(y) + 'H0Z' : 'M0 ' + round(y) + 'H' + width + 'V' + height + 'H0Z', frontierAt: () => y, incomingAt, pointCount: 4, edgeSoftness };
  }
  const vertices = new Map<number, Point>(), links = new Map<number, number[]>();
  const horizontalEdges = rows * (cols - 1);
  const connect = (a: number, b: number) => {
    const aa = links.get(a); if (aa) aa.push(b); else links.set(a, [b]);
    const bb = links.get(b); if (bb) bb.push(a); else links.set(b, [a]);
  };
  for (let row = 0; row < rows - 1; row++) {
    if (Math.max(f.rowMax[row], f.rowMax[row + 1]) < threshold) continue;
    // Solid rows contribute only their outside edges. Full scanning is confined
    // to the narrow changing frontier, not the full canvas on every frame.
    const stride = row > 0 && row < rows - 2 && Math.min(f.rowMin[row], f.rowMin[row + 1]) >= threshold ? cols - 2 : 1;
    for (let col = 0; col < cols - 1; col += stride) {
    const index = row * cols + col, outside = -1000000;
    const a = row === 0 || col === 0 ? outside : values[index] - threshold;
    const b = row === 0 || col === cols - 2 ? outside : values[index + 1] - threshold;
    const c = row === rows - 2 || col === cols - 2 ? outside : values[index + cols + 1] - threshold;
    const d = row === rows - 2 || col === 0 ? outside : values[index + cols] - threshold;
    const code = (a >= 0 ? 1 : 0) | (b >= 0 ? 2 : 0) | (c >= 0 ? 4 : 0) | (d >= 0 ? 8 : 0);
    if (code === 0 || code === 15) continue;
    const centerInside = (a + b + c + d) >= 0;
    const edges = code === 5 ? (centerInside ? [0,1,2,3] : [3,0,1,2]) : code === 10 ? (centerInside ? [3,0,1,2] : [0,1,2,3]) : pairs[code];
    const edgeId = (edge: number) => {
      const id = edge === 0 ? row * (cols - 1) + col : edge === 2 ? (row + 1) * (cols - 1) + col : horizontalEdges + row * cols + col + (edge === 1 ? 1 : 0);
      if (!vertices.has(id)) {
        let x = (col - 1) * step, y = (row - 1) * step;
        if (edge === 0) x += step * a / (a - b);
        else if (edge === 1) { x += step; y += step * b / (b - c); }
        else if (edge === 2) { x += step * d / (d - c); y += step; }
        else y += step * a / (a - d);
        vertices.set(id, { x, y: down ? height - y : y });
      }
      return id;
    };
    for (let i = 0; i < edges.length; i += 2) connect(edgeId(edges[i]), edgeId(edges[i + 1]));
    }
  }
  const visited = new Set<number>();
  let path = '', pointCount = 0;
  for (const start of links.keys()) {
    if (visited.has(start)) continue;
    const polygon: Point[] = [];
    let previous = -1, current = start;
    while (!visited.has(current)) {
      visited.add(current); polygon.push(vertices.get(current)!);
      const next = links.get(current)!.find(id => id !== previous);
      if (next === undefined) break;
      previous = current; current = next;
    }
    if (polygon.length < 3) continue;
    const area = Math.abs(polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + p.x * q.y - p.y * q.x; }, 0)) / 2;
    if (area < Math.max(.7, f.scale * f.scale)) continue;
    const points = simplify(polygon, .22 * Math.max(1, step / 2));
    const first = points[0], last = points[points.length - 1];
    path += 'M' + round((last.x + first.x) / 2) + ' ' + round((last.y + first.y) / 2);
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      path += 'Q' + round(p.x) + ' ' + round(p.y) + ' ' + round((p.x + q.x) / 2) + ' ' + round((p.y + q.y) / 2);
    }
    path += 'Z'; pointCount += points.length;
  }
  return { path, frontierAt, incomingAt, pointCount, edgeSoftness };
}
