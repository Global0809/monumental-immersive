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
  /** Conservative classification: a cavity inside the bounds always stays mixed. */
  classifyRect: (left: number, top: number, right: number, bottom: number) => 'from' | 'to' | 'mixed';
  pointCount: number; edgeSoftness: number;
}
type Point = { x: number; y: number };
type Field = { values: Float32Array; rowMin: Float32Array; rowMax: Float32Array; tileMin: Float32Array; tileMax: Float32Array; tileCols: number; tileRows: number; cols: number; rows: number; step: number; bleed: number; scale: number; ensure: (threshold: number) => void };
const TILE = 16;
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
// Cache the noise lattice, not a moving texture. Each material used to repeat
// millions of integer hashes during its first scroll frame.
function noiseLattice(maxX: number, maxY: number, seed: number) {
  const cols = Math.ceil(maxX) + 12, rows = Math.ceil(maxY) + 12;
  if (cols * rows > 262144) return (x: number, y: number) => noise(x, y, seed);
  const values = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) values[y * cols + x] = hash(x - 5, y - 5, seed);
  return (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y), u = smooth(x - ix), v = smooth(y - iy);
    if (ix < -5 || iy < -5 || ix + 6 >= cols || iy + 6 >= rows) return noise(x, y, seed);
    const i = (iy + 5) * cols + ix + 5;
    const a = values[i], b = values[i + 1], c = values[i + cols], d = values[i + cols + 1];
    return a + (b - a) * u + (c - a + (a - b - c + d) * u) * v;
  };
}
// Sample each material once. Four bounded grids retain nearby chapters on reversal.
const fields = new Map<string, Field>();
function material(width: number, height: number, seed: number, amplitude: number, detail: number): Field {
  const key = [width, height, seed, amplitude, detail].join(':');
  const cached = fields.get(key);
  if (cached) return cached;
  const contourHeight = Math.min(height, width * 1.1), scale = clamp(contourHeight / 800, .48, 1.4);
  const step = Math.max(1.8, width / 580, height / 580);
  const cols = Math.ceil(width / step) + 3, rows = Math.ceil(height / step) + 3;
  const values = new Float32Array(cols * rows);
  const rowMin = new Float32Array(rows), rowMax = new Float32Array(rows);
  const tileCols = Math.ceil((cols - 1) / TILE), tileRows = Math.ceil((rows - 1) / TILE);
  const tileMin = new Float32Array(tileCols * tileRows).fill(Infinity), tileMax = new Float32Array(tileCols * tileRows).fill(-Infinity);
  const bleed = contourHeight * amplitude * 1.35 + 46 * scale * detail + step * 3;
  const readyRows = new Uint8Array(rows), readyTiles = new Uint8Array(tileRows);
  const lean = hash(41, 17, seed) * .42;
  const warpX = noiseLattice(width / (83 * scale) + 2, height / (91 * scale) + 2, seed + 29);
  const warpY = noiseLattice(width / (73 * scale) + 2, height / (79 * scale) + 2, seed + 37);
  const lobe = noiseLattice(width / (49 * scale) + 2, height / (41 * scale) + 2, seed + 47);
  const tear = noiseLattice((width + height * .28) / (14 * scale) + 4, height / (12 * scale) + 4, seed + 59);
  const fiber = noiseLattice((width + height * .62) / (12 * scale) + 4, height / (4.2 * scale) + 6, seed + 71);
  // The macro silhouette is also a two-dimensional material. Its low frequency
  // needs only a tiny lattice; it does not remain an arch translating upward.
  const macroCols = 99, macroRows = 67, macro = new Float32Array(macroCols * macroRows);
  for (let row = 0; row < macroRows; row++) for (let col = 0; col < macroCols; col++) {
    const x = (col - 1) / 96, y = (row - 1) / 64;
    macro[row * macroCols + col] = contourHeight * amplitude * (
      noise(x * 2.2 + 11, y * 1.4 + 3.7, seed + 7) * .52
      + noise(x * 5.8 + 31, y * 2.6 + 8.3, seed + 19) * .25
      + noise(x * 11.3 + 5, y * 4.3 + 16, seed + 23) * .07 + (x - .5) * lean);
  }
  const macroX = new Uint16Array(cols), macroU = new Float32Array(cols);
  for (let col = 0; col < cols; col++) {
    const x = clamp((col - 1) * step / width * 96 + 1, 0, macroCols - 1.00001);
    macroX[col] = Math.floor(x); macroU[col] = x - macroX[col];
  }
  // Analytic bounds classify untouched rows without sampling them. Material
  // rows are populated once, only as the narrow erosion band reaches them.
  for (let row = 0; row < rows; row++) { rowMin[row] = (row - 1) * step - bleed; rowMax[row] = (row - 1) * step + bleed; }
  for (let ty = 0; ty < tileRows; ty++) for (let tx = 0; tx < tileCols; tx++) {
    tileMin[ty * tileCols + tx] = (ty * TILE - 1) * step - bleed;
    tileMax[ty * tileCols + tx] = ((ty + 1) * TILE - 1) * step + bleed;
  }
  const ensure = (threshold: number) => {
    const firstTile = clamp(Math.floor(((threshold - bleed) / step - 1) / TILE), 0, tileRows - 1);
    const lastTile = clamp(Math.floor(((threshold + bleed) / step + 2) / TILE), 0, tileRows - 1);
    for (let ty = firstTile; ty <= lastTile; ty++) {
      if (readyTiles[ty]) continue;
      for (let row = ty * TILE; row <= Math.min(rows - 1, (ty + 1) * TILE); row++) {
        if (readyRows[row]) continue;
        const y = (row - 1) * step;
        const my = clamp(y / height * 64 + 1, 0, macroRows - 1.00001), iy = Math.floor(my), v = my - iy;
        let min = Infinity, max = -Infinity;
        for (let col = 0; col < cols; col++) {
          const x = (col - 1) * step;
          let texture = 0;
          if (detail > 0) {
            // Domain warping produces overhangs, narrow necks and actual cavities.
            const wx = x / scale + warpX(x / (83 * scale), y / (91 * scale)) * 29;
            const wy = y / scale + warpY(x / (73 * scale), y / (79 * scale)) * 25;
            // Larger curved pockets establish a soft liquid silhouette; the much
            // finer raggedness belongs to their edges, rather than a sawtooth wave.
            const lobes = lobe(wx / 49, wy / 41) * 37;
            const tears = tear((wx + wy * .28) / 14, wy / 12) * 6.1;
            const fibers = fiber((wx + wy * .62) / 12, wy / 4.2) * 1.8;
            texture = (lobes + tears + fibers) * scale * detail;
          }
          // Unequal erosion speed through fixed material changes the large outline
          // as the threshold passes; it is not a translated one-dimensional line.
          const mi = iy * macroCols + macroX[col], u = macroU[col];
          const a = macro[mi], b = macro[mi + 1], c = macro[mi + macroCols], d = macro[mi + macroCols + 1];
          values[row * cols + col] = y - (a + (b - a) * u + (c - a + (a - b - c + d) * u) * v) + texture;
          min = Math.min(min, values[row * cols + col]); max = Math.max(max, values[row * cols + col]);
        }
        rowMin[row] = min; rowMax[row] = max;
        readyRows[row] = 1;
      }
      for (let tx = 0; tx < tileCols; tx++) {
        let min = Infinity, max = -Infinity;
        for (let row = ty * TILE; row <= Math.min(rows - 1, (ty + 1) * TILE); row++) {
          const end = Math.min(cols - 1, (tx + 1) * TILE);
          for (let col = tx * TILE; col <= end; col++) { const v = values[row * cols + col]; min = Math.min(min, v); max = Math.max(max, v); }
        }
        tileMin[ty * tileCols + tx] = min; tileMax[ty * tileCols + tx] = max;
      }
      readyTiles[ty] = 1;
    }
  };
  const field = { values, rowMin, rowMax, tileMin, tileMax, tileCols, tileRows, cols, rows, step, scale, bleed, ensure };
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
const saddleA = [0, 1, 2, 3], saddleB = [3, 0, 1, 2];
// One bounded scratch graph is shared by sequential draws. Epoch tags avoid
// clearing a large Map/Set or allocating adjacency arrays on each scroll frame.
let graphEpoch = 0, edgeIndex = new Int32Array(0), edgeEpoch = new Uint32Array(0);
const vertexX = new Float32Array(32768), vertexY = new Float32Array(32768);
const nextA = new Int32Array(32768), nextB = new Int32Array(32768), visited = new Uint32Array(32768);
/** Optional idle preflight: builds the bounded material, without changing visual state. */
export function prepareErosionContour(options: ErosionContourOptions) {
  const height = clamp(finite(options.height, 1), 1, 32768);
  const f = material(clamp(finite(options.width, 1), 1, 32768), height, seedHash(options.seed), clamp(finite(options.macroAmplitude, .15), 0, .3), clamp(finite(options.detailAmount, 1), 0, 2));
  f.ensure(height + f.bleed - clamp(finite(options.progress, 0), 0, 1) * (height + f.bleed * 2));
}
export function buildErosionContour(options: ErosionContourOptions): ErosionContour {
  const width = clamp(finite(options.width, 1), 1, 32768), height = clamp(finite(options.height, 1), 1, 32768);
  const progress = clamp(finite(options.progress, 0), 0, 1);
  const amplitude = clamp(finite(options.macroAmplitude, .15), 0, .3), detail = clamp(finite(options.detailAmount, 1), 0, 2);
  const edgeSoftness = clamp(finite(options.edgeSoftness, .65), .25, 1.5), down = options.direction === 'down';
  if (progress === 0 || progress === 1) return {
    path: progress ? 'M0 0H' + round(width) + 'V' + round(height) + 'H0Z' : '',
    frontierAt: () => progress ? (down ? height + 1 : -1) : (down ? -1 : height + 1),
    incomingAt: () => progress === 1, classifyRect: () => progress ? 'to' : 'from', pointCount: progress ? 4 : 0, edgeSoftness,
  };
  const f = material(width, height, seedHash(options.seed), amplitude, detail);
  const { cols, rows, step, values, bleed } = f;
  const threshold = height + bleed - progress * (height + bleed * 2);
  f.ensure(threshold);
  const incomingAt = (x: number, y: number) => {
    const fy = down ? height - finite(y, 0) : finite(y, 0);
    return fy >= threshold + bleed || (fy >= threshold - bleed && sample(f, clamp(finite(x, 0), 0, width), fy) >= threshold);
  };
  const classifyRect: ErosionContour['classifyRect'] = (left, top, right, bottom) => {
    let x0 = clamp(Math.min(finite(left, 0), finite(right, width)), 0, width), x1 = clamp(Math.max(finite(left, 0), finite(right, width)), 0, width);
    let y0 = clamp(Math.min(finite(top, 0), finite(bottom, height)), 0, height), y1 = clamp(Math.max(finite(top, 0), finite(bottom, height)), 0, height);
    if (down) [y0, y1] = [height - y1, height - y0];
    const tx0 = clamp(Math.floor((x0 / step + 1) / TILE), 0, f.tileCols - 1), tx1 = clamp(Math.floor((x1 / step + 1) / TILE), 0, f.tileCols - 1);
    const ty0 = clamp(Math.floor((y0 / step + 1) / TILE), 0, f.tileRows - 1), ty1 = clamp(Math.floor((y1 / step + 1) / TILE), 0, f.tileRows - 1);
    let min = Infinity, max = -Infinity;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * f.tileCols + tx;
      min = Math.min(min, f.tileMin[i]); max = Math.max(max, f.tileMax[i]);
      if (min < threshold && max >= threshold) return 'mixed';
    }
    return min >= threshold ? 'to' : 'from';
  };
  const frontierAt = (pixelX: number) => {
    const x = clamp(finite(pixelX, 0), 0, width);
    if (-step >= threshold + bleed || (-step >= threshold - bleed && sample(f, x, -step) >= threshold)) return down ? height + bleed : -bleed;
    let previous = -1;
    for (let y = 0; y <= height + step; y += step) {
      if (y < threshold - bleed) continue;
      const next = y > threshold + bleed ? 1 : sample(f, x, y) - threshold;
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
    return { path: down ? 'M0 0H' + width + 'V' + round(y) + 'H0Z' : 'M0 ' + round(y) + 'H' + width + 'V' + height + 'H0Z', frontierAt: () => y, incomingAt, classifyRect, pointCount: 4, edgeSoftness };
  }
  const horizontalEdges = rows * (cols - 1);
  const edgeCount = horizontalEdges + (rows - 1) * cols;
  if (edgeIndex.length < edgeCount) { edgeIndex = new Int32Array(edgeCount); edgeEpoch = new Uint32Array(edgeCount); }
  if (++graphEpoch === 0xffffffff) { graphEpoch = 1; edgeEpoch.fill(0); visited.fill(0); }
  let vertexCount = 0;
  const connect = (a: number, b: number) => {
    if (nextA[a] === -1) nextA[a] = b; else nextB[a] = b;
    if (nextA[b] === -1) nextA[b] = a; else nextB[b] = a;
  };
  for (let row = 0; row < rows - 1; row++) {
    if (Math.max(f.rowMax[row], f.rowMax[row + 1]) < threshold) continue;
    // Solid rows contribute only their outside edges. Full scanning is confined
    // to the narrow changing frontier, not the full canvas on every frame.
    const stride = row > 0 && row < rows - 2 && Math.min(f.rowMin[row], f.rowMin[row + 1]) >= threshold ? cols - 2 : 1;
    for (let col = 0; col < cols - 1; col += stride) {
      if (stride === 1 && row > 0 && row < rows - 2 && col > 0 && col < cols - 2) {
        const tile = Math.floor(row / TILE) * f.tileCols + Math.floor(col / TILE);
        if (f.tileMax[tile] < threshold || f.tileMin[tile] >= threshold) {
          col = Math.min(cols - 3, (Math.floor(col / TILE) + 1) * TILE - 1); continue;
        }
      }
      const index = row * cols + col, outside = -1000000;
      const solidTop = (row - 1) * step >= threshold + bleed, solidBottom = row * step >= threshold + bleed;
      const a = row === 0 || col === 0 ? outside : solidTop ? 1 : values[index] - threshold;
      const b = row === 0 || col === cols - 2 ? outside : solidTop ? 1 : values[index + 1] - threshold;
      const c = row === rows - 2 || col === cols - 2 ? outside : solidBottom ? 1 : values[index + cols + 1] - threshold;
      const d = row === rows - 2 || col === 0 ? outside : solidBottom ? 1 : values[index + cols] - threshold;
      const code = (a >= 0 ? 1 : 0) | (b >= 0 ? 2 : 0) | (c >= 0 ? 4 : 0) | (d >= 0 ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const centerInside = (a + b + c + d) >= 0;
      const edges = code === 5 ? (centerInside ? saddleA : saddleB) : code === 10 ? (centerInside ? saddleB : saddleA) : pairs[code];
      const edgeId = (edge: number) => {
        const id = edge === 0 ? row * (cols - 1) + col : edge === 2 ? (row + 1) * (cols - 1) + col : horizontalEdges + row * cols + col + (edge === 1 ? 1 : 0);
        if (edgeEpoch[id] !== graphEpoch) {
          let x = (col - 1) * step, y = (row - 1) * step;
          if (edge === 0) x += step * a / (a - b);
          else if (edge === 1) { x += step; y += step * b / (b - c); }
          else if (edge === 2) { x += step * d / (d - c); y += step; }
          else y += step * a / (a - d);
          const vertex = vertexCount++;
          edgeEpoch[id] = graphEpoch; edgeIndex[id] = vertex;
          vertexX[vertex] = x; vertexY[vertex] = down ? height - y : y;
          nextA[vertex] = nextB[vertex] = -1;
        }
        return edgeIndex[id];
      };
      for (let i = 0; i < edges.length; i += 2) connect(edgeId(edges[i]), edgeId(edges[i + 1]));
    }
  }
  let path = '', pointCount = 0;
  for (let start = 0; start < vertexCount; start++) {
    if (visited[start] === graphEpoch) continue;
    const polygon: Point[] = [];
    let previous = -1, current = start;
    while (visited[current] !== graphEpoch) {
      visited[current] = graphEpoch; polygon.push({ x: vertexX[current], y: vertexY[current] });
      const next = nextA[current] !== previous ? nextA[current] : nextB[current];
      if (next === -1) break;
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
  return { path, frontierAt, incomingAt, classifyRect, pointCount, edgeSoftness };
}
