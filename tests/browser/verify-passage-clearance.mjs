import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// This geometry audit runs against the local Vite source, independently of the
// application render loop. Production behavior is covered by the browser suite.
const base = process.env.SITE_URL || 'http://127.0.0.1:5184/';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Clearance audit requires the local Vite source server');
const output = process.env.PASSAGE_OUTPUT || 'output/playwright/reference-tunnel-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const address = new URL('_passage-clearance-audit', base).href;
  await page.route(address, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Passage clearance audit</title>' }));
  await page.goto(address);
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { createPassageArchitecture } = await import('/src/components/spatial/passageArchitecture.ts');
    const { passagePose } = await import('/src/services/passageJourney.ts');
    const scene = new THREE.Scene(), architecture = createPassageArchitecture(scene, () => {});
    const origin = new THREE.Vector3(), direction = new THREE.Vector3(), next = new THREE.Vector3(), offset = new THREE.Vector3();
    const ray = new THREE.Raycaster(), collisions = [], offsets = [[0, 0], [-.25, 0], [.25, 0], [0, -.25], [0, .25]];
    let testedSegments = 0, testedRays = 0;
    try {
      for (let active = -1; active <= 5; active++) {
        let previous = passagePose({ active, progress: 0 }).position;
        for (let step = 1; step <= 400; step++) {
          const progress = step / 400, pose = passagePose({ active, progress });
          architecture.update({ active, progress, elapsed: 0, delta: 0, reducedMotion: true, inspection: { station: null, expanded: false, rotation: 0 } });
          scene.updateMatrixWorld(true);
          const meshes = [];
          scene.traverseVisible(object => {
            if (!object.isMesh) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            if (materials.every(material => material.transparent && material.opacity < .3)) return;
            // Detect entering either side of a solid surface, not just its front.
            materials.forEach(material => { material.side = THREE.DoubleSide; });
            meshes.push(object);
          });
          origin.fromArray(previous); next.fromArray(pose.position); direction.copy(next).sub(origin);
          const length = direction.length();
          if (length > .000001) {
            testedSegments++;
            direction.normalize();
            for (const [x, y] of offsets) {
              offset.set(x, y, 0).add(origin); ray.set(offset, direction); ray.near = 0; ray.far = length;
              testedRays++;
              const hit = ray.intersectObjects(meshes, false)[0];
              if (!hit) continue;
              const names = []; let node = hit.object;
              while (node) { if (node.name) names.push(node.name); node = node.parent; }
              collisions.push({ active, progress, offset: [x, y], position: hit.point.toArray(), geometry: hit.object.geometry.type, names, instanceId: hit.instanceId ?? null });
            }
          }
          previous = pose.position;
        }
      }
    } finally { architecture.destroy(); }
    return { testedSegments, testedRays, cameraSafetyRadius: .25, collisions };
  });
  await writeFile(`${output}/clearance.json`, JSON.stringify({ base, checkedAt: new Date().toISOString(), ...result }, null, 2));
  assert.equal(result.collisions.length, 0, `${result.collisions.length} camera-volume intersections; see ${output}/clearance.json`);
  console.log(`PASS ${result.testedRays} actual-geometry rays across ${result.testedSegments} moving camera segments; 0 intersections.`);
} finally { await browser.close(); }
