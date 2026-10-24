/** Pixel-space SVG mask geometry. Use evenodd filling for the sparse edge islands. */
export interface ErosionContourOptions {
  width: number;
  height: number;
  progress: number;
  seed: number | string;
  macroAmplitude?: number;
  detailAmount?: number;
  direction?: 'up' | 'down';
  /** Antialias width in CSS pixels for renderers that support a threshold. No blur is required for SVG. */
  edgeSoftness?: number;
}

export interface ErosionContour {
  path: string;
  frontierAt: (x: number) => number;
  pointCount: number;
  edgeSoftness: number;
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const finite = (value: number | undefined, fallback: number) => Number.isFinite(value) ? value as number : fallback;
const number = (value: number) => Math.round(value * 100) / 100;

function seedHash(seed: string | number): number {
  const text = String(seed);
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  }
  return value >>> 0;
}

function hash(lattice: number, seed: number): number {
  let value = Math.imul(lattice ^ seed, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function noise(position: number, seed: number): number {
  const lattice = Math.floor(position);
  const part = position - lattice;
  const smooth = part * part * part * (part * (part * 6 - 15) + 10);
  return (hash(lattice, seed) * (1 - smooth) + hash(lattice + 1, seed) * smooth) * 2 - 1;
}

interface Profile {
  offsetAt: (x: number) => number;
  seed: number;
}

// Reuse the fixed profile while scrolling; changes in progress only translate it.
// A bounded cache also keeps route changes and resizing from accumulating profiles.
const profiles = new Map<string, Profile>();

function getProfile(width: number, height: number, seed: number, amplitude: number, detail: number): Profile {
  const key = `${width}:${height}:${seed}:${amplitude}:${detail}`;
  const existing = profiles.get(key);
  if (existing) return existing;
  const lean = (hash(71, seed) - 0.5) * 0.8;
  const strokes = Array.from({ length: 3 }, (_, index) => ({
    center: (index + 0.3 + hash(101 + index, seed) * 0.5) / 3,
    width: 0.028 + hash(111 + index, seed) * 0.045,
    reach: (0.012 + hash(121 + index, seed) * 0.018) * (index === 1 ? 1 : -1),
    slant: hash(131 + index, seed) > 0.5 ? -1 : 1,
  }));
  const offsetAt = (pixelX: number) => {
    const x = clamp(finite(pixelX, 0), 0, width) / width;
    const warped = x + noise(x * 2.7 + 23, seed + 3) * 0.055;
    const large = noise(warped * 2.65 + 11, seed + 7) * 0.66
      + noise(warped * 5.3 + 43, seed + 19) * 0.26 + (x - 0.5) * lean;
    const scallopX = warped + noise(warped * 13.1 + 17, seed + 23) * 0.016;
    const scallop = noise(scallopX * 25.6 + 9, seed + 29);
    // Compressed curved lobes end in sharp recesses; finer tears are carried by
    // those lobes rather than becoming an unrelated full-width sawtooth.
    const medium = (Math.sqrt(Math.abs(scallop)) * Math.sign(scallop)) * 0.024
      + noise(scallopX * 48.1 + 5, seed + 37) * 0.011;
    const tornScale = 0.6 + Math.abs(scallop) * 0.7;
    const torn = (noise(scallopX * 103.7 + 13, seed + 47) * 0.0056
      + noise(x * 201.3 + 31, seed + 53) * 0.0028) * tornScale;
    let strokesOffset = 0;
    for (const stroke of strokes) {
      const dx = (x - stroke.center) / stroke.width * stroke.slant;
      // A broad pulled shoulder and a short chipped end read as a dragged brush
      // mark. Their low reach avoids isolated tent-shaped mountain peaks.
      const shoulder = dx < 0
        ? Math.exp(-Math.pow(Math.abs(dx) * 0.65, 2.3))
        : Math.exp(-Math.pow(dx * 2.8, 0.8));
      strokesOffset += stroke.reach * shoulder;
    }
    return height * clamp(large * amplitude + (medium + torn + strokesOffset) * detail,
      -amplitude - 0.09 * detail, amplitude + 0.09 * detail);
  };
  const profile = { offsetAt, seed };
  if (profiles.size >= 24) profiles.delete(profiles.keys().next().value!);
  profiles.set(key, profile);
  return profile;
}

/**
 * Stable, scroll-reversible contour. The outgoing surface remains above the
 * frontier for an upward reveal. Only the boundary is irregular: the two fields
 * remain solid. Endpoints intentionally bypass all detail for a clean settle.
 */
export function buildErosionContour(options: ErosionContourOptions): ErosionContour {
  const width = clamp(finite(options.width, 1), 1, 32768);
  const height = clamp(finite(options.height, 1), 1, 32768);
  const progress = clamp(finite(options.progress, 0), 0, 1);
  const amplitude = clamp(finite(options.macroAmplitude, 0.15), 0, 0.3);
  const detail = clamp(finite(options.detailAmount, 1), 0, 2);
  const edgeSoftness = clamp(finite(options.edgeSoftness, 0.65), 0.25, 1.5);
  const down = options.direction === 'down';
  // Portrait screens retain a broad torn frontier rather than tall narrow peaks.
  const contourHeight = Math.min(height, width * 1.35);
  const { offsetAt, seed } = getProfile(width, contourHeight, seedHash(options.seed), amplitude, detail);
  // The entire contour, including detached fragments, starts and ends offscreen.
  const bleed = contourHeight * (amplitude + 0.12 * detail) + 8;
  const center = height + bleed - progress * (height + bleed * 2);
  const upwardFrontier = (x: number) => center + offsetAt(x);
  const frontierAt = down ? (x: number) => height - upwardFrontier(x) : upwardFrontier;
  if (progress === 0) return { path: '', frontierAt, pointCount: 0, edgeSoftness };
  if (progress === 1) return {
    path: `M0 0H${number(width)}V${number(height)}H0Z`, frontierAt, pointCount: 4, edgeSoftness,
  };

  const samples = Math.min(width <= 760 ? 220 : 450, Math.max(48, Math.ceil(width / 4)));
  const coordinates = Array.from({ length: samples + 1 }, (_, index) => {
    const x = width * index / samples;
    return `${number(x)} ${number(frontierAt(x))}`;
  });
  const farEdge = down ? 0 : height;
  let path = `M${coordinates[0]}L${coordinates.slice(1).join('L')}L${number(width)} ${farEdge}L0 ${farEdge}Z`;
  let pointCount = samples + 3;

  // A maximum of two holes and one fragment. Their outlines travel with the
  // frontier and are never scattered over the untouched page surface.
  if (detail > 0.1 && width > 80 && height > 80) {
    const signs = [1, 1, -1];
    for (let index = 0; index < signs.length; index += 1) {
      // Different seeded sections need not all contain the same number of holes.
      if (hash(201 + index, seed) < (index === 2 ? 0.4 : 0.2)) continue;
      const sign = signs[index];
      const x = width * (0.12 + hash(211 + index, seed) * 0.76);
      const rx = Math.min(width * 0.014, 16) * (0.5 + hash(221 + index, seed) * 0.8) * detail;
      const ry = Math.min(height * 0.005, 6) * (0.6 + hash(231 + index, seed) * 0.6) * detail;
      // Keep each island wholly on its intended side, including steep strokes.
      const nearby = [upwardFrontier(x - rx), upwardFrontier(x), upwardFrontier(x + rx)];
      const edge = sign > 0 ? Math.max(...nearby) : Math.min(...nearby);
      const y = edge + sign * (ry * 2.4 + 2);
      const island = Array.from({ length: 10 }, (_, point) => {
        const angle = point / 10 * Math.PI * 2;
        const roughness = 0.72 + hash(251 + index * 17 + point, seed) * 0.28;
        const py = y + Math.sin(angle) * ry * roughness;
        return `${number(x + Math.cos(angle) * rx * roughness)} ${number(down ? height - py : py)}`;
      });
      path += `M${island[0]}L${island.slice(1).join('L')}Z`;
      pointCount += island.length;
    }
  }
  return { path, frontierAt, pointCount, edgeSoftness };
}
