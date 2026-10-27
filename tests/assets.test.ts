import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicAsset } from '../src/services/assets';

test('public media retains its path on root hosting and receives a Pages prefix once', () => {
  for (const path of ['/media/miami-frequency.mp4', '/media/miami.webp', '/captions/miami-frequency.vtt']) {
    assert.equal(resolvePublicAsset(path), path);
    const prefixed = resolvePublicAsset(path, '/monumental-immersive/');
    assert.equal(prefixed, `/monumental-immersive${path}`);
    assert.equal(resolvePublicAsset(prefixed, '/monumental-immersive/'), prefixed);
    assert.equal(resolvePublicAsset(path, '/monumental-immersive'), prefixed);
  }
});

test('public media resolver preserves remote, protocol-relative and relative sources', () => {
  for (const path of ['https://example.com/film.mp4', '//example.com/film.mp4', 'media/film.mp4', 'data:image/png;base64,AA==']) {
    assert.equal(resolvePublicAsset(path, '/monumental-immersive/'), path);
  }
});
