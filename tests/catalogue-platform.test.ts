import test from 'node:test';
import assert from 'node:assert/strict';
import { bundledCatalogue, catalogueIndex, videos, places, periods, initializeCatalogue } from '../src/data/catalogue.ts';
import { videos as authoredVideos, places as authoredPlaces, periods as authoredPeriods } from '../src/data/catalogue.seed.ts';
import { assertPreviewCompatibility, isPublicResourceUrl, parseCatalogueSnapshot } from '../src/platform/catalogue/validation.ts';
import { BundledCatalogueRepository, HttpCatalogueRepository, loadCatalogueWithFallback, createCatalogueIndex } from '../src/platform/catalogue/repository.ts';

const copy = () => structuredClone(bundledCatalogue);
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

test('bundled catalogue migration preserves all authored content and synchronous exports', async () => {
  assert.deepEqual(videos, authoredVideos);
  assert.deepEqual(places, authoredPlaces);
  assert.deepEqual(periods, authoredPeriods);
  assert.equal(initializeCatalogue(undefined), undefined);
  assert.equal(initializeCatalogue('   '), undefined);
  assert.deepEqual(await new BundledCatalogueRepository(bundledCatalogue).load(), bundledCatalogue);
  assert.equal(catalogueIndex.videos.get(videos[0].id), videos[0]);
  assert.deepEqual(catalogueIndex.videosByPlace.get('miami'), videos.filter(video => video.places.includes('miami')));
  assert.deepEqual(catalogueIndex.videosByPeriod.get('1930s'), videos.filter(video => video.period === '1930s'));
});

test('catalogue schema rejects unsupported versions, duplicate IDs and unresolved references', () => {
  assert.throws(() => parseCatalogueSnapshot({ ...copy(), schemaVersion: 2 }), /schemaVersion/);
  const duplicate = copy(); duplicate.videos.push(duplicate.videos[0]);
  assert.throws(() => parseCatalogueSnapshot(duplicate), /duplicate IDs/);
  const missingPlace = copy(); missingPlace.videos[0].places.push('no-such-place');
  assert.throws(() => parseCatalogueSnapshot(missingPlace), /unknown place/);
  const missingPeriod = copy(); missingPeriod.videos[0].period = 'no-such-period';
  assert.throws(() => parseCatalogueSnapshot(missingPeriod), /unknown period/);
});

test('catalogue validates availability, enums and finite runtime', () => {
  for (const duration of [NaN, Infinity, -1, 0]) {
    const invalid = copy(); invalid.videos[0].duration = duration;
    assert.throws(() => parseCatalogueSnapshot(invalid));
  }
  const invalidStatus = copy() as unknown as { videos: { status: string }[] }; invalidStatus.videos[0].status = 'published';
  assert.throws(() => parseCatalogueSnapshot(invalidStatus), /status/);
  const invalidAccess = copy() as unknown as { videos: { access: string }[] }; invalidAccess.videos[0].access = 'member';
  assert.throws(() => parseCatalogueSnapshot(invalidAccess), /access/);
  const missingSource = copy(); delete missingSource.videos[0].src;
  assert.throws(() => parseCatalogueSnapshot(missingSource), /availability/);
  const invalidDate = copy(); invalidDate.videos[0].publishedAt = '2026-02-30';
  assert.throws(() => parseCatalogueSnapshot(invalidDate), /publishedAt/);
});

test('public catalogue never carries premium footage or caption URLs', () => {
  const privateMedia = copy(); privateMedia.videos[0].access = 'premium';
  assert.throws(() => parseCatalogueSnapshot(privateMedia), /private media/);
  delete privateMedia.videos[0].src;
  assert.throws(() => parseCatalogueSnapshot(privateMedia), /private media/);
  delete privateMedia.videos[0].captions;
  const valid = parseCatalogueSnapshot(privateMedia);
  assert.equal(valid.videos[0].status, 'available');
  assert.equal(valid.videos[0].src, undefined);
});

test('resource URLs reject executable schemes, traversal, credentials and protocol-relative hosts', () => {
  for (const url of ['/media/film.mp4', 'media/film.mp4', './media/film.mp4', 'https://cdn.example.com/film.mp4']) assert.equal(isPublicResourceUrl(url), true, url);
  for (const url of ['javascript:alert(1)', 'data:text/html,anything', '//bad.example/film', '/%2fhost/file', '../secret', '/media/%2e%2e/secret', 'https://user:pass@example.com/video', 'http://example.com/video', '/media\\video', '\n/media/file']) assert.equal(isPublicResourceUrl(url), false, url);
  const invalid = copy(); invalid.videos[0].poster = 'javascript:alert(1)';
  assert.throws(() => parseCatalogueSnapshot(invalid), /poster/);
});

test('editorial compatibility is separate from schema and preserves authored scene anchors and image credits', () => {
  const reordered = copy(); reordered.videos.reverse();
  reordered.videos.push({ ...reordered.videos[0], id: 'new-approved-story' });
  assertPreviewCompatibility(parseCatalogueSnapshot(reordered), bundledCatalogue);
  assert.equal(createCatalogueIndex(reordered).videos.has('new-approved-story'), true);
  const removed = copy(); removed.videos.pop();
  assert.throws(() => assertPreviewCompatibility(parseCatalogueSnapshot(removed), bundledCatalogue), /authored story links/);
  const movedPlace = copy(); movedPlace.places.reverse();
  assert.throws(() => assertPreviewCompatibility(parseCatalogueSnapshot(movedPlace), bundledCatalogue), /scene migration/);
  const changedImage = copy(); changedImage.places[0].image = '/media/other.jpg';
  assert.throws(() => assertPreviewCompatibility(parseCatalogueSnapshot(changedImage), bundledCatalogue), /credits migration/);
});

test('HTTP catalogue sends only an anonymous public GET and loads a valid revision', async () => {
  const remote = copy(); remote.revision = 'approved-2'; remote.videos[0].title = 'Updated approved title';
  let calls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    calls++;
    assert.equal(input, 'https://catalogue.example.com/v1/catalogue');
    assert.equal(init?.method, 'GET'); assert.equal(init?.credentials, 'omit');
    assert.equal(init?.referrerPolicy, 'no-referrer'); assert.equal(init?.redirect, 'error');
    assert.deepEqual(init?.headers, { Accept: 'application/json' }); assert.equal(init?.body, undefined);
    return response(remote);
  };
  const result = await loadCatalogueWithFallback(bundledCatalogue, new HttpCatalogueRepository('https://catalogue.example.com/v1/catalogue', { fetch: fetcher }));
  assert.equal(calls, 1); assert.equal(result.source, 'remote');
  assert.equal(result.snapshot.revision, 'approved-2');
  assert.equal(result.snapshot.videos[0].title, 'Updated approved title');
  assert.equal(videos[0].title, authoredVideos[0].title);
});

test('network, status, malformed JSON, invalid schema and incompatible publications retain the bundled snapshot', async () => {
  const incompatible = copy(); incompatible.periods.reverse();
  const fetchers: typeof fetch[] = [
    async () => { throw new Error('offline'); },
    async () => response({}, 503),
    async () => new Response('not JSON'),
    async () => response({ schemaVersion: 2 }),
    async () => response(incompatible),
  ];
  for (const fetcher of fetchers) {
    const result = await loadCatalogueWithFallback(bundledCatalogue, new HttpCatalogueRepository('/api/catalogue', { fetch: fetcher }));
    assert.equal(result.source, 'bundled'); assert.equal(result.reason, 'unavailable-or-invalid');
    assert.deepEqual(result.snapshot, bundledCatalogue);
  }
});

test('timeout bounds startup even if an adapter ignores abort, without late catalogue mutation', async () => {
  let signal: AbortSignal | undefined;
  let finish: (value: Response) => void = () => {};
  const fetcher: typeof fetch = (_input, init) => { signal = init?.signal ?? undefined; return new Promise(resolve => { finish = resolve; }); };
  const result = await loadCatalogueWithFallback(bundledCatalogue, new HttpCatalogueRepository('/api/catalogue', { fetch: fetcher, timeoutMs: 5 }));
  assert.equal(result.source, 'bundled'); assert.equal(signal?.aborted, true);
  finish(response({ ...copy(), revision: 'late-response' }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(result.snapshot.revision, bundledCatalogue.revision);
});

test('remote payloads expose only defined public metadata fields and reject oversized responses', async () => {
  const payload = { ...copy(), privateInternalNotes: 'not a public field' };
  assert.equal('privateInternalNotes' in parseCatalogueSnapshot(payload), false);
  const fetcher: typeof fetch = async () => new Response('', { headers: { 'content-length': '2000001' } });
  await assert.rejects(() => new HttpCatalogueRepository('/api/catalogue', { fetch: fetcher }).load(), /too large/);
});
