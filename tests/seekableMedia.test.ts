import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PREVIEW_BYTES, prepareSeekableMedia } from '../src/services/seekableMedia.ts';

function objectUrls(t: TestContext) {
  const blobs: Blob[] = [], revoked: string[] = [];
  t.mock.method(URL, 'createObjectURL', (blob: Blob) => { blobs.push(blob); return `blob:preview-${blobs.length}`; });
  t.mock.method(URL, 'revokeObjectURL', (source: string) => { revoked.push(source); });
  return { blobs, revoked };
}

test('remote and existing object URLs pass through without any fetch or object URL allocation', async t => {
  const urls = objectUrls(t);
  const fetcher = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected fetch'); });
  for (const source of ['https://films.example/full.mp4', '//films.example/full.mp4', 'blob:existing-preview']) {
    const prepared = await prepareSeekableMedia(source, new AbortController().signal);
    assert.equal(prepared.src, source);
    prepared.release();
  }
  assert.equal(fetcher.mock.callCount(), 0);
  assert.deepEqual(urls, { blobs: [], revoked: [] });
});

test('a local host advertising byte ranges keeps the original streaming URL', async t => {
  const urls = objectUrls(t), signal = new AbortController().signal;
  const fetcher = t.mock.method(globalThis, 'fetch', async (_source: string, options?: RequestInit) => {
    assert.equal(options?.method, 'HEAD');
    assert.equal(options?.signal, signal);
    return new Response(null, { headers: { 'Accept-Ranges': 'ByTeS' } });
  });
  const prepared = await prepareSeekableMedia('/media/preview.mp4', signal);
  assert.equal(prepared.src, '/media/preview.mp4');
  prepared.release();
  assert.equal(fetcher.mock.callCount(), 1);
  assert.deepEqual(urls, { blobs: [], revoked: [] });
});

test('a host without HEAD support falls back to an identical typed Blob and releases it exactly once', async t => {
  const urls = objectUrls(t), signal = new AbortController().signal;
  const bytes = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 255]);
  const fetcher = t.mock.method(globalThis, 'fetch', async (source: string, options?: RequestInit) => {
    assert.equal(source, '/media/preview.mp4');
    assert.equal(options?.signal, signal);
    return options?.method === 'HEAD'
      ? new Response(null, { status: 405 })
      : new Response(bytes, { headers: { 'Content-Type': 'video/mp4' } });
  });
  const prepared = await prepareSeekableMedia('/media/preview.mp4', signal);
  assert.equal(fetcher.mock.callCount(), 2);
  assert.equal(prepared.src, 'blob:preview-1');
  assert.equal(urls.blobs[0].type, 'video/mp4');
  assert.deepEqual(new Uint8Array(await urls.blobs[0].arrayBuffer()), bytes);
  assert.deepEqual(urls.revoked, []);
  prepared.release(); prepared.release();
  assert.deepEqual(urls.revoked, ['blob:preview-1']);
});

test('a declared file above the 16 MiB limit remains direct without downloading its body', async t => {
  const urls = objectUrls(t);
  const fetcher = t.mock.method(globalThis, 'fetch', async (_source: string, options?: RequestInit) => {
    assert.equal(options?.method, 'HEAD');
    return new Response(null, { headers: { 'Content-Length': String(MAX_PREVIEW_BYTES + 1) } });
  });
  const prepared = await prepareSeekableMedia('/media/large.mp4', new AbortController().signal);
  assert.equal(MAX_PREVIEW_BYTES, 16 * 1024 * 1024);
  assert.equal(prepared.src, '/media/large.mp4');
  assert.equal(fetcher.mock.callCount(), 1);
  assert.equal(urls.blobs.length, 0);
});

test('an oversized stream without Content-Length is cancelled and never becomes an object URL', async t => {
  const urls = objectUrls(t);
  let cancelled = false, pulls = 0;
  const chunk = new Uint8Array(MAX_PREVIEW_BYTES / 2);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { pulls++; controller.enqueue(chunk); },
    cancel() { cancelled = true; },
  });
  t.mock.method(globalThis, 'fetch', async (_source: string, options?: RequestInit) => options?.method === 'HEAD' ? new Response(null) : new Response(body));
  const prepared = await prepareSeekableMedia('/media/unknown-size.mp4', new AbortController().signal);
  assert.equal(prepared.src, '/media/unknown-size.mp4');
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
  assert.ok(pulls <= 4, `Reader continued pulling after the byte cap: ${pulls}`);
  assert.equal(urls.blobs.length, 0);
});

test('a file exactly at the bound remains eligible and defaults to the MP4 MIME type', async t => {
  const urls = objectUrls(t);
  t.mock.method(globalThis, 'fetch', async (_source: string, options?: RequestInit) => options?.method === 'HEAD'
    ? new Response(null, { headers: { 'Content-Length': String(MAX_PREVIEW_BYTES) } })
    : new Response(new Uint8Array(MAX_PREVIEW_BYTES)));
  const prepared = await prepareSeekableMedia('/media/boundary.mp4', new AbortController().signal);
  assert.equal(prepared.src, 'blob:preview-1');
  assert.equal(urls.blobs[0].size, MAX_PREVIEW_BYTES);
  assert.equal(urls.blobs[0].type, 'video/mp4');
  prepared.release();
});

test('a failed body response rejects without creating a URL', async t => {
  const urls = objectUrls(t);
  t.mock.method(globalThis, 'fetch', async (_source: string, options?: RequestInit) => options?.method === 'HEAD' ? new Response(null) : new Response(null, { status: 503 }));
  await assert.rejects(prepareSeekableMedia('/media/missing.mp4', new AbortController().signal), /could not be loaded/i);
  assert.equal(urls.blobs.length, 0);
});

test('an already aborted request rejects before network activity', async t => {
  const urls = objectUrls(t), controller = new AbortController();
  controller.abort();
  const fetcher = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected fetch'); });
  await assert.rejects(prepareSeekableMedia('/media/preview.mp4', controller.signal), { name: 'AbortError' });
  assert.equal(fetcher.mock.callCount(), 0);
  assert.equal(urls.blobs.length, 0);
});

test('aborting the pending HEAD request propagates cancellation without fallback download', async t => {
  const urls = objectUrls(t), controller = new AbortController();
  const fetcher = t.mock.method(globalThis, 'fetch', (_source: string, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    assert.equal(options?.signal, controller.signal);
    options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
  }));
  const preparation = prepareSeekableMedia('/media/preview.mp4', controller.signal);
  controller.abort();
  await assert.rejects(preparation, { name: 'AbortError' });
  assert.equal(fetcher.mock.callCount(), 1);
  assert.equal(urls.blobs.length, 0);
});

test('a late abort after the body arrives prevents creation of a stale playable URL', async t => {
  const urls = objectUrls(t), controller = new AbortController();
  let body: ReadableStream<Uint8Array> | undefined;
  t.mock.method(globalThis, 'fetch', async (_source: string, options?: RequestInit) => {
    if (options?.method === 'HEAD') return new Response(null);
    body = new ReadableStream<Uint8Array>({ start(stream) { stream.enqueue(new Uint8Array([1, 2, 3])); controller.abort(); stream.close(); } });
    return new Response(body);
  });
  await assert.rejects(prepareSeekableMedia('/media/preview.mp4', controller.signal), { name: 'AbortError' });
  assert.equal(body?.locked, false);
  assert.equal(urls.blobs.length, 0);
});
