import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildPanelGlyphAtlas, createPanelTelemetry, PANEL_GLYPHS } from '../src/services/panelTelemetry.ts';

test('panel glyph atlas is deterministic, legible bitmap data with padded cells', () => {
  const first = buildPanelGlyphAtlas(), second = buildPanelGlyphAtlas();
  assert.deepEqual(first.data, second.data);
  assert.equal(PANEL_GLYPHS.length, 24); assert.equal(first.width, 128); assert.equal(first.height, 64);
  assert.ok(first.data.byteLength <= 32 * 1024);
  const pixels = (glyph: number) => {
    const values: number[] = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const value = first.data[((Math.floor(glyph / 8) * 16 + y) * first.width + (glyph % 8) * 16 + x) * 4];
      if (x < 3 || x > 12 || y === 0 || y === 15) assert.equal(value, 0, 'cell padding prevents mip bleed');
      values.push(value);
    }
    return values;
  };
  const shapes = Array.from({ length: 24 }, (_, i) => pixels(i));
  assert.equal(new Set(shapes.map(shape => shape.join(','))).size, 24, 'every character has its own authored silhouette');
  for (const glyph of shapes) assert.ok(glyph.some(value => value === 255));
  for (let i = 0; i < first.data.length; i += 4) {
    assert.equal(first.data[i], first.data[i + 1]); assert.equal(first.data[i], first.data[i + 2]); assert.equal(first.data[i + 3], 255);
  }
});

function compile(material: THREE.MeshStandardMaterial) {
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\nvoid main(){\n#include <project_vertex>\n}',
    fragmentShader: '#include <common>\nvoid main(){\n#include <alphatest_fragment>\n#include <emissivemap_fragment>\n#include <opaque_fragment>\n}',
  } as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

test('telemetry chains shader ownership and preserves later cutaway anchors and authored maps', () => {
  const material = new THREE.MeshStandardMaterial({ color: 0x101513, roughness: .79 });
  const bump = new THREE.Texture(); material.bumpMap = bump;
  const original = (shader: THREE.WebGLProgramParametersWithUniforms) => { shader.fragmentShader = '// original\n' + shader.fragmentShader; };
  const key = () => 'prior-material'; material.onBeforeCompile = original; material.customProgramCacheKey = key;
  const colour = material.color.clone(), kit = createPanelTelemetry(material), shader = compile(material);
  assert.equal(material.map, null); assert.equal(material.bumpMap, bump); assert.deepEqual(material.color, colour); assert.equal(material.roughness, .79);
  assert.match(shader.fragmentShader, /\/\/ original/);
  for (const token of ['alphatest_fragment', 'emissivemap_fragment', 'opaque_fragment']) assert.ok(shader.fragmentShader.includes(`#include <${token}>`));
  assert.ok(shader.vertexShader.includes('#include <project_vertex>'));
  assert.match(shader.vertexShader, /step\(\.5,normal\.y\)/);
  assert.match(shader.fragmentShader, /panelDistance<55\./);
  assert.match(shader.fragmentShader, /totalEmissiveRadiance\+=/);
  assert.equal(shader.uniforms.uPanelAtlas, kit.uniforms.uPanelAtlas);
  assert.match(material.customProgramCacheKey(), /^prior-material\|monumental-panel-telemetry/);
  kit.dispose(); assert.equal(material.onBeforeCompile, original); assert.equal(material.customProgramCacheKey, key);
  assert.equal(material.userData.panelTelemetry, undefined); bump.dispose(); material.dispose();
});

test('lining and iris share one immutable, mipmapped data atlas and release it after the final owner', () => {
  const wall = new THREE.MeshStandardMaterial(), iris = new THREE.MeshStandardMaterial();
  const a = createPanelTelemetry(wall), b = createPanelTelemetry(iris, { surface: 'iris' });
  const texture = a.uniforms.uPanelAtlas.value; let disposals = 0;
  texture.addEventListener('dispose', () => disposals++);
  assert.equal(texture, b.uniforms.uPanelAtlas.value); assert.equal(texture.colorSpace, THREE.NoColorSpace);
  assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter); assert.equal(texture.magFilter, THREE.LinearFilter); assert.equal(texture.generateMipmaps, true);
  const version = texture.version, shader = compile(iris);
  assert.match(shader.vertexShader, /panelOrigin.z\*17.17/);
  assert.doesNotMatch(shader.vertexShader, /dot\(panelOrigin/);
  assert.match(shader.vertexShader, /position.xy-vec2\(2.45,-2.24\)/);
  assert.match(shader.vertexShader, /step\(\.8,normal\.z\)/);
  for (let i = 0; i < 120; i++) a.update({ time: i / 60, energy: .8, cameraZ: -i, pointer: [.2, -.3], pointerActive: true });
  assert.equal(texture.version, version, 'animation never reuploads the texture');
  a.dispose(); a.dispose(); assert.equal(disposals, 0, 'iris still owns the shared atlas');
  b.dispose(); b.dispose(); assert.equal(disposals, 1);
  const next = createPanelTelemetry(new THREE.MeshStandardMaterial());
  assert.notEqual(next.uniforms.uPanelAtlas.value, texture, 'remount receives a valid fresh texture'); next.dispose();
  wall.dispose(); iris.dispose();
});

test('input is bounded, reduced and disabled modes are static, disposed updates do nothing', () => {
  const material = new THREE.MeshStandardMaterial(), kit = createPanelTelemetry(material), u = kit.uniforms;
  kit.update({ time: 14, reading: .6, pointer: [.2, -.4], pointerActive: true, energy: .8, cameraZ: -46, quality: 'light' });
  assert.equal(u.uPanelTime.value, 14); assert.equal(u.uPanelPointer.value.z, 1); assert.equal(u.uPanelQuality.value, .45);
  assert.equal(u.uPanelCameraZ.value, -46); assert.equal(u.uPanelReading.value, .6);
  kit.update({ time: 25, reading: true, pointer: [40, -40], pointerActive: true, energy: 9, cameraZ: Infinity, quality: 4 });
  assert.deepEqual(u.uPanelPointer.value.toArray(), [1, -1, 1]); assert.equal(u.uPanelEnergy.value, 1);
  assert.equal(u.uPanelCameraZ.value, 14); assert.equal(u.uPanelQuality.value, 1); assert.equal(u.uPanelReading.value, 1);
  for (const mode of [{ calm: true }, { enabled: false }]) {
    kit.update({ time: 100, energy: 1, pointer: [.5, .5], pointerActive: true, ...mode });
    assert.equal(u.uPanelTime.value, 0); assert.equal(u.uPanelEnergy.value, 0); assert.equal(u.uPanelPointer.value.z, 0); assert.equal(u.uPanelCalm.value, 1);
  }
  kit.update({ time: NaN, pointer: [NaN, Infinity], pointerActive: true, energy: NaN });
  assert.deepEqual(u.uPanelPointer.value.toArray(), [0, 0, 0]); assert.equal(u.uPanelTime.value, 0); assert.equal(u.uPanelEnergy.value, 0);
  kit.dispose(); kit.update({ time: 500 }); assert.equal(u.uPanelTime.value, 0); material.dispose();
});

test('disposal does not overwrite a newer material owner', () => {
  const material = new THREE.MeshStandardMaterial(), previousData = { retained: true };
  material.userData.panelTelemetry = previousData;
  const kit = createPanelTelemetry(material), later = () => {}, key = () => 'cutaway';
  material.onBeforeCompile = later; material.customProgramCacheKey = key;
  kit.dispose(); assert.equal(material.onBeforeCompile, later); assert.equal(material.customProgramCacheKey, key);
  assert.equal(material.userData.panelTelemetry, previousData); material.dispose();
});

test('readable text protection is bounded, finite and keeps preallocated uniforms across frames', () => {
  const material = new THREE.MeshStandardMaterial(), kit = createPanelTelemetry(material), u = kit.uniforms;
  const array = u.uPanelProtected.value, first = array[0];
  kit.setProtection([
    { left: NaN, top: 0, right: .5, bottom: .5 },
    { left: .8, top: .1, right: .4, bottom: .5 },
    { left: -.1, top: -.2, right: .4, bottom: .5 },
    { left: .1, top: .2, right: 1.4, bottom: 1.5 },
    { left: .2, top: .3, right: .6, bottom: .7 },
    { left: .3, top: .4, right: .7, bottom: .8 },
    { left: .4, top: .5, right: .8, bottom: .9 },
  ]);
  assert.equal(u.uPanelProtectedCount.value, 4);
  assert.deepEqual(array[0].toArray(), [0, 0, .4, .5]);
  assert.deepEqual(array[1].toArray(), [.1, .2, 1, 1]);
  assert.deepEqual(array[3].toArray(), [.3, .4, .7, .8]);
  kit.update({ time: 2, reading: 1 });
  assert.equal(u.uPanelProtectedCount.value, 4, 'regular frame updates preserve current DOM protection');
  kit.setProtection([{ left: .1, top: .2, right: .3, bottom: .4 }]);
  assert.equal(u.uPanelProtected.value, array); assert.equal(array[0], first);
  assert.equal(u.uPanelProtectedCount.value, 1);
  const shader = compile(material);
  assert.match(shader.fragmentShader, /\.5-screen.y\*\.5/, 'DOM coordinates use top-down screen Y');
  assert.match(shader.fragmentShader, /mix\(\.035,1\.,clearText\)/, 'protection attenuates only the authored emission');
  kit.setProtection([]); assert.equal(u.uPanelProtectedCount.value, 0);
  kit.dispose(); kit.setProtection([{ left: 0, top: 0, right: 1, bottom: 1 }]);
  assert.equal(u.uPanelProtectedCount.value, 0); material.dispose();
});
