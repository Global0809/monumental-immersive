import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTunnelPulse, getTunnelLife, sendTunnelSignal, setTunnelRelay, subscribeTunnelLife } from '../src/services/tunnelLife';

test('signals retrigger the one envelope and freeze without frame updates', () => {
  const pulse = createTunnelPulse();
  pulse.trigger(-24.5);
  for (let i = 0; i < 60; i++) pulse.advance(1 / 60);
  assert.ok(Math.abs(pulse.value.age - 1) < .00001);
  const snapshot = { ...pulse.value };
  pulse.advance(0); pulse.advance(NaN); pulse.trigger(Infinity);
  assert.deepEqual(pulse.value, snapshot);
  pulse.trigger(-108.5);
  assert.deepEqual(pulse.value, { originZ: -108.5, age: 0, strength: 1 });
  pulse.advance(30);
  assert.equal(pulse.value.age, .05, 'a resumed frame never jumps the whole pulse');
  pulse.reset();
  assert.equal(pulse.value.strength, 0);
  pulse.trigger(14);
  for (let i = 0; i < 500; i++) pulse.advance(.05);
  assert.equal(pulse.value.age, 8);
  assert.equal(pulse.value.strength, 0);
});

test('relay controls share a stable snapshot and unsubscribe on teardown', () => {
  setTunnelRelay(false);
  const original = getTunnelLife(); let notifications = 0;
  const off = subscribeTunnelLife(() => notifications++);
  setTunnelRelay(false);
  assert.equal(getTunnelLife(), original);
  setTunnelRelay(true); sendTunnelSignal();
  assert.equal(getTunnelLife().relayOpen, true);
  assert.equal(getTunnelLife().signal, original.signal + 1);
  assert.equal(notifications, 2);
  off(); setTunnelRelay(false);
  assert.equal(notifications, 2);
});
