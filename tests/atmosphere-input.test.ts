import test from 'node:test';
import assert from 'node:assert/strict';
import { createAtmosphereInput } from '../src/components/spatial/atmosphereInput';
import { createAtmosphere } from '../src/components/spatial/atmosphere';

test('fast pointer sweeps stay bounded and leave a wake that dissipates', () => {
  const input = createAtmosphereInput();
  input.move(-1, -.8, 0);
  for (let i = 1; i <= 30; i++) {
    input.move(i % 2 ? 1 : -1, i % 2 ? 1 : -1, i);
    const frame = input.update(1 / 60);
    assert.ok(Math.hypot(frame.vx, frame.vy) <= 5);
    assert.ok(Number.isFinite(frame.orbit));
  }
  assert.ok(input.field.trail.some(node => node.strength > .05));
  input.leave();
  for (let i = 0; i < 180; i++) input.update(1 / 60);
  assert.ok(input.field.strength < .001);
  assert.ok(Math.hypot(input.field.vx, input.field.vy) < .001);
  assert.ok(input.field.trail.every(node => node.strength < .001));
});

test('a hold charges an orbit and one release emits a finite ripple', () => {
  const input = createAtmosphereInput();
  input.move(.2, -.3, 0); input.press();
  for (let i = 0; i < 60; i++) input.update(1 / 60);
  assert.ok(input.field.charge > .97);
  assert.ok(input.field.orbit > .5);
  input.release();
  assert.equal(input.field.pulse.x, .2);
  assert.ok(input.field.pulse.power > .9);
  input.update(.04); input.release();
  assert.equal(input.field.pulse.age, .04, 'a repeated pointerup does not restart the wave');
  for (let i = 0; i < 120; i++) input.update(1 / 60);
  assert.equal(input.field.pulse.power, 0);
  assert.ok(input.field.charge < .001);
});

test('charge timing is independent of refresh rate and touch has a smaller response', () => {
  const chargeAt = (fps: number) => {
    const input = createAtmosphereInput(); input.move(0, 0, 0); input.press();
    for (let i = 0; i < fps; i++) input.update(1 / fps);
    return input.field.charge;
  };
  assert.ok(Math.abs(chargeAt(30) - chargeAt(120)) < 1e-10);
  const input = createAtmosphereInput(); input.move(0, 0, 0, true);
  for (let i = 0; i < 120; i++) input.update(1 / 60);
  assert.ok(input.field.strength <= .48);
  input.move(NaN, Infinity, 1); input.update(Infinity);
  assert.ok(Number.isFinite(input.field.x));
});

test('focus loss and reduced motion clear all kinetic energy without reallocating buffers', () => {
  const atmosphere = createAtmosphere();
  const positions = atmosphere.points.geometry.attributes.position.array;
  atmosphere.input.move(.5, .5, 0); atmosphere.input.press();
  for (let i = 0; i < 60; i++) atmosphere.update(i / 60);
  assert.ok(atmosphere.points.material.uniforms.uPointer.value.w > .9);
  atmosphere.input.release(); atmosphere.update(1, 1 / 60, true);
  assert.equal(atmosphere.points.material.uniforms.uPointer.value.z, 0);
  assert.equal(atmosphere.points.material.uniforms.uPointer.value.w, 0);
  assert.equal(atmosphere.points.material.uniforms.uPulse.value.w, 0);
  assert.equal(positions, atmosphere.points.geometry.attributes.position.array);
  atmosphere.dispose();
});
