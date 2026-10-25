import test from 'node:test';
import assert from 'node:assert/strict';
import { routeScrollPosition } from '../src/services/routeScroll';
test('revisiting a filter keeps the controls at the current scroll position', () => {
  assert.equal(routeScrollPosition('#/search?q=music', '#/search?q=film', 720, 180, true), 720);
  assert.equal(routeScrollPosition('#/world?place=london', '#/world?place=miami', 320, 0, true), 320);
});
test('explicit new-page navigation begins at the page entrance, history restores reading', () => {
  assert.equal(routeScrollPosition('#/world', '#/my-world', 720, 450, true), 0);
  assert.equal(routeScrollPosition('#/world', '#/my-world', 720, 450, false), 450);
  assert.equal(routeScrollPosition('#/search?q=music', '#/search?q=film', 720, 180, false), 180);
  assert.equal(routeScrollPosition('#/world', '#/journey', 720, undefined, false), 0);
});
