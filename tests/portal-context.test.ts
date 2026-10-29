import test from 'node:test';
import assert from 'node:assert/strict';
import { portalContext } from '../src/services/portalContext';
import { selectTunnelRelayPart, setTunnelRelay, getTunnelLife } from '../src/services/tunnelLife';

test('forward portals preserve explicit parameters and only carry catalogue identities', () => {
  assert.equal(portalContext('/world', {}, 'london').params.place, 'london');
  const explicit = portalContext('/world', { place: 'miami', category: 'Music' }, 'london');
  assert.deepEqual(explicit.params, { place: 'miami', category: 'Music' });
  assert.equal(explicit.identity, 'place:miami');
  assert.equal(portalContext('/film/sintel-full', { t: '12' }, 'miami').identity, 'film:sintel-full');
  assert.equal(portalContext('/film/unknown', {}, 'miami').identity, '');
  assert.deepEqual(portalContext('/category/movies', {}, 'miami').params, {});
});
test('individual relay inspection validates components and reassembles atomically', () => {
  setTunnelRelay(false); selectTunnelRelayPart(4);
  assert.equal(getTunnelLife().relayOpen, true); assert.equal(getTunnelLife().relayPart, 4);
  selectTunnelRelayPart(99); assert.equal(getTunnelLife().relayPart, null);
  selectTunnelRelayPart(2); setTunnelRelay(false);
  assert.equal(getTunnelLife().relayPart, null); assert.equal(getTunnelLife().relayOpen, false);
});
