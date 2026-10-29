import test, { after } from 'node:test';
import assert from 'node:assert/strict';

class Surface {
  constructor(readonly protectedSurface = false) {}
  closest() { return this.protectedSurface ? this : null; }
}
class TrackedTarget extends EventTarget {
  counts = new Map<string, number>();
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) { this.counts.set(type, (this.counts.get(type) || 0) + 1); super.addEventListener(type, listener, options); }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) { this.counts.set(type, (this.counts.get(type) || 0) - 1); super.removeEventListener(type, listener, options); }
}
let currentTarget: Surface | null = new Surface(), modal = false, popover = false, clock = 0;
const win = Object.assign(new TrackedTarget(), { visualViewport: new TrackedTarget() });
const doc = Object.assign(new TrackedTarget(), { hidden: false, elementFromPoint: () => currentTarget, querySelector: (selector: string) => (selector === ':popover-open' ? popover : modal) ? new Surface(true) : null });
const replacements = { window: win, document: doc, performance: { now: () => clock }, innerWidth: 1200, innerHeight: 800 };
const originals = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { acquireXrayPointer, readXrayPointer } = await import('../src/services/xrayPointer');
function pointer(type: string, props: Record<string, unknown> = {}) {
  win.dispatchEvent(Object.assign(new Event(type), { isPrimary: true, pointerType: 'mouse', clientX: 400, clientY: 300, buttons: 0, relatedTarget: {}, ...props }));
}
after(() => { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });

test('immersive material scans have an independent input owner shared by all renderers', () => {
  let a = 0, b = 0;
  const first = acquireXrayPointer(() => a++), second = acquireXrayPointer(() => b++);
  assert.equal(win.counts.get('pointermove'), 1);
  pointer('pointermove');
  assert.deepEqual(readXrayPointer(), { x: 400, y: 300, active: true, pressed: false, blocked: false });
  assert.equal(a, 1); assert.equal(b, 1);
  first(); assert.equal(win.counts.get('pointermove'), 1);
  second(); second(); assert.equal(win.counts.get('pointermove'), 0);
  assert.equal(readXrayPointer().active, false);
});

test('press, touch, protected controls and stationary scroll changes cannot leave stale X-rays', () => {
  const invalidations: boolean[] = [];
  const release = acquireXrayPointer(layout => invalidations.push(layout));
  pointer('pointermove'); assert.equal(readXrayPointer().active, true);
  pointer('pointerdown', { buttons: 1 }); assert.equal(readXrayPointer().active, false);
  pointer('pointermove', { buttons: 1, clientX: 600 }); assert.equal(readXrayPointer().active, false);
  pointer('pointerup', { clientX: 620, clientY: 350 });
  assert.equal(readXrayPointer().active, true); assert.equal(readXrayPointer().x, 620); assert.equal(readXrayPointer().y, 350);
  pointer('pointercancel');
  pointer('pointermove', { pointerType: 'touch' }); assert.equal(readXrayPointer().active, false);
  pointer('pointermove'); assert.equal(readXrayPointer().active, true);
  currentTarget = new Surface(true); win.dispatchEvent(new Event('scroll'));
  assert.equal(invalidations.at(-1), true, 'Layout wakes paused scenes even when their cached bounds were elsewhere.');
  assert.equal(readXrayPointer().active, false); assert.equal(readXrayPointer().blocked, true);
  currentTarget = new Surface(); win.dispatchEvent(new Event('resize'));
  assert.equal(readXrayPointer().active, true);
  modal = true; clock += 60; assert.equal(readXrayPointer().active, false);
  modal = false; popover = true; doc.dispatchEvent(new Event('toggle'));
  assert.equal(readXrayPointer().blocked, true);
  popover = false; doc.dispatchEvent(new Event('close'));
  assert.equal(readXrayPointer().active, true);
  pointer('pointerout', { relatedTarget: null });
  assert.equal(readXrayPointer().active, false);
  pointer('pointermove'); win.dispatchEvent(new Event('blur'));
  assert.equal(readXrayPointer().active, false);
  release();
});
