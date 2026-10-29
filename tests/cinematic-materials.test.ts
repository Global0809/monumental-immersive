import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCinematicMaterials, type CinematicFinish } from '../src/services/cinematicMaterials.ts';

test('cinematic finishes are deterministic, shared, bounded and mipmapped', () => {
  const first = createCinematicMaterials(), second = createCinematicMaterials();
  const seen = new Set<THREE.Texture>(); let bytes = 0;
  for (const kind of ['metal', 'paint', 'stone'] as CinematicFinish[]) {
    const a = first.apply(new THREE.MeshStandardMaterial(), kind);
    const b = second.apply(new THREE.MeshStandardMaterial(), kind);
    const map = a.bumpMap as THREE.DataTexture;
    assert.equal(a.roughnessMap, map, 'height and roughness share a packed allocation');
    assert.equal(first.apply(new THREE.MeshStandardMaterial(), kind).bumpMap, map, 'parts share the finish texture');
    assert.deepEqual(map.image.data, (b.bumpMap as THREE.DataTexture).image.data, 'the seed reconstructs identical pixels');
    assert.ok(map.image.width <= 256 && map.image.height <= 256);
    assert.equal(map.generateMipmaps, true); assert.equal(map.minFilter, THREE.LinearMipmapLinearFilter);
    assert.equal(map.colorSpace, THREE.NoColorSpace, 'surface data is not treated as sRGB colour');
    assert.equal(map.wrapS, THREE.RepeatWrapping); assert.equal(map.wrapT, THREE.RepeatWrapping);
    seen.add(map); bytes += map.image.data.byteLength;
    const version = map.version;
    first.apply(a, kind, .6);
    assert.equal(map.version, version, 'reusing a surface does not regenerate or upload pixels');
  }
  assert.equal(seen.size, 3);
  assert.ok(bytes <= 384 * 1024, 'all finish pixels together stay below 384KiB before mipmaps');
  first.dispose(); second.dispose();
});

test('brushed metal has directional detail while coatings remain isotropic', () => {
  const kit = createCinematicMaterials();
  const direction = (kind: CinematicFinish) => {
    const map = kit.apply(new THREE.MeshStandardMaterial(), kind).bumpMap as THREE.DataTexture;
    const { data, width, height } = map.image; let across = 0, along = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const value = Number(data[(y * width + x) * 4]);
      across += Math.abs(value - Number(data[(y * width + (x + 1) % width) * 4]));
      along += Math.abs(value - Number(data[(((y + 1) % height) * width + x) * 4]));
    }
    return across / along;
  };
  assert.ok(direction('metal') < .2, 'machining marks have a clear brush direction');
  for (const finish of ['paint', 'stone'] as const) {
    const ratio = direction(finish);
    assert.ok(ratio > .7 && ratio < 1.3, `${finish} does not inherit metal stripes`);
  }
  kit.dispose();
});

test('finish application preserves authored colour, media and shader hooks', () => {
  const kit = createCinematicMaterials(), image = new THREE.Texture();
  const material = new THREE.MeshPhysicalMaterial({ color: 0x272822, emissive: 0x110503, roughness: .42, map: image });
  const hook = () => {}, cacheKey = () => 'structural-xray';
  material.onBeforeCompile = hook; material.customProgramCacheKey = cacheKey;
  const colour = material.color.clone(), emissive = material.emissive.clone();
  kit.apply(material, 'metal');
  assert.equal(material.map, image); assert.deepEqual(material.color, colour); assert.deepEqual(material.emissive, emissive);
  assert.equal(material.roughness, .42); assert.equal(material.onBeforeCompile, hook); assert.equal(material.customProgramCacheKey, cacheKey);
  const protectedMaterial = new THREE.MeshStandardMaterial(); protectedMaterial.userData.protectedSurface = true;
  kit.apply(protectedMaterial, 'paint'); assert.equal(protectedMaterial.bumpMap, null);
  const video = new THREE.VideoTexture({} as HTMLVideoElement), media = new THREE.MeshStandardMaterial({ map: video });
  kit.apply(media, 'metal'); assert.equal(media.bumpMap, null); assert.equal(media.map, video);
  kit.dispose(); image.dispose(); video.dispose(); material.dispose(); media.dispose(); protectedMaterial.dispose();
});

test('kits dispose only owned textures once and cannot allocate after disposal', () => {
  const kit = createCinematicMaterials(); let disposals = 0;
  for (const kind of ['metal', 'paint', 'stone'] as const) {
    const material = kit.apply(new THREE.MeshStandardMaterial(), kind);
    material.bumpMap!.addEventListener('dispose', () => disposals++);
  }
  kit.dispose(); kit.dispose();
  assert.equal(disposals, 3);
  const next = new THREE.MeshStandardMaterial(); kit.apply(next, 'metal');
  assert.equal(next.bumpMap, null); assert.equal(next.roughnessMap, null);
  next.dispose();
});
