import * as THREE from 'three';

export type CinematicFinish = 'metal' | 'paint' | 'stone';

const finishes = {
  metal: { size: 256, repeat: [1, 3], depth: .012, seed: 1847 },
  paint: { size: 128, repeat: [3, 3], depth: .016, seed: 5317 },
  stone: { size: 128, repeat: [2, 2], depth: .035, seed: 9029 },
} as const;

const smooth = (n: number) => n * n * n * (n * (n * 6 - 15) + 10);
function hash(x: number, y: number, seed: number) {
  let value = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ seed;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}
// Periodic lattice coordinates make the small material swatches tile without
// a seam. Everything is baked once; scrolling never regenerates their pixels.
function noise(u: number, v: number, columns: number, rows: number, seed: number) {
  const x = u * columns, y = v * rows, ix = Math.floor(x), iy = Math.floor(y);
  const sx = smooth(x - ix), sy = smooth(y - iy);
  const a = hash(ix % columns, iy % rows, seed), b = hash((ix + 1) % columns, iy % rows, seed);
  const c = hash(ix % columns, (iy + 1) % rows, seed), d = hash((ix + 1) % columns, (iy + 1) % rows, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

function makeTexture(kind: CinematicFinish) {
  const spec = finishes[kind], data = new Uint8Array(spec.size * spec.size * 4);
  for (let y = 0; y < spec.size; y++) for (let x = 0; x < spec.size; x++) {
    const u = x / spec.size, v = y / spec.size, offset = (y * spec.size + x) * 4;
    let height: number, roughness: number;
    if (kind === 'metal') {
      // Long machining strokes, with finer crossgrain; no painted-on scratches.
      const grain = noise(u, v, 4, 128, spec.seed) - .5;
      const fine = noise(u, v, 32, 256, spec.seed + 1) - .5;
      const broad = noise(u, v, 8, 8, spec.seed + 2) - .5;
      height = .5 + grain * .20 + fine * .055;
      roughness = .89 + grain * .13 + broad * .10;
    } else if (kind === 'paint') {
      // Fine powder-coat granulation is isotropic and softer than cut metal.
      const fine = noise(u, v, 64, 64, spec.seed) - .5;
      const mid = noise(u, v, 16, 16, spec.seed + 1) - .5;
      height = .5 + fine * .09 + mid * .07;
      roughness = .91 + fine * .08 + mid * .06;
    } else {
      // A restrained ceramic/mineral surface, for tactile exhibits rather than
      // uniform grain pasted onto every part of the machine.
      const broad = noise(u, v, 4, 4, spec.seed) - .5;
      const mid = noise(u, v, 16, 16, spec.seed + 1) - .5;
      const fine = noise(u, v, 64, 64, spec.seed + 2) - .5;
      height = .5 + broad * .20 + mid * .12 + fine * .06;
      roughness = .89 + mid * .08 + fine * .10;
    }
    // Three reads bump from R and roughness from G: both properties share one
    // upload and allocation. Albedo and film colours are never textured here.
    data[offset] = Math.round(height * 255);
    data[offset + 1] = Math.round(roughness * 255);
    data[offset + 2] = 255; data[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, spec.size, spec.size, THREE.RGBAFormat);
  texture.name = `monumental-${kind}-microfinish`;
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(spec.repeat[0], spec.repeat[1]);
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 2;
  texture.needsUpdate = true;
  return texture;
}

/** Shared material-only detail. Each scene owns its kit, textures and lifetime.
 * No renderer, lighting, shader hook, colour map or animation state is touched. */
export function createCinematicMaterials() {
  const textures = new Map<CinematicFinish, THREE.DataTexture>();
  let disposed = false;
  return {
    apply<T extends THREE.MeshStandardMaterial>(material: T, kind: CinematicFinish, amount = 1): T {
      const strength = Number.isFinite(amount) ? THREE.MathUtils.clamp(amount, 0, 2) : 1;
      // Callers select architectural surfaces explicitly. This additional guard
      // prevents a video or protected editorial surface being accidentally treated.
      if (disposed || strength === 0 || material.map instanceof THREE.VideoTexture || material.userData.protectedSurface) return material;
      let texture = textures.get(kind);
      if (!texture) { texture = makeTexture(kind); textures.set(kind, texture); }
      material.bumpMap = texture; material.roughnessMap = texture;
      material.bumpScale = finishes[kind].depth * strength;
      material.needsUpdate = true;
      return material;
    },
    dispose() {
      if (disposed) return;
      disposed = true; textures.forEach(texture => texture.dispose()); textures.clear();
    },
  };
}
