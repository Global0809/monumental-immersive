import test from 'node:test';
import assert from 'node:assert/strict';
import { passageBayExpansion } from '../src/services/passageEnvelope.ts';
import { tunnelStationZ } from '../src/services/tunnelJourney.ts';

test('each carrier has a continuous physical bay, without changing the opening tunnel', () => {
  assert.equal(passageBayExpansion(14), 0);
  assert.equal(passageBayExpansion(-7), 0);
  for (let index = 0; index < 6; index++) {
    const center = tunnelStationZ(index);
    for (let z = center - 10; z <= center + 10; z += .25) assert.equal(passageBayExpansion(z), 4.4);
    for (let z = center - 23; z < center + 23; z += .05) {
      assert.ok(Math.abs(passageBayExpansion(z + .05) - passageBayExpansion(z)) < .04, 'no discontinuous wall step');
    }
  }
});
