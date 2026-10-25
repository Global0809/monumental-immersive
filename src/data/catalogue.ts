import { videos as seedVideos, places as seedPlaces, periods as seedPeriods } from './catalogue.seed';
import type { CatalogueSnapshot } from '../platform/catalogue/domain';
import { createCatalogueIndex, HttpCatalogueRepository, loadCatalogueWithFallback, type CatalogueLoad } from '../platform/catalogue/repository';
import { parseCatalogueSnapshot } from '../platform/catalogue/validation';

export type { Video, Place, Period, CatalogueSnapshot } from '../platform/catalogue/domain';

export const bundledCatalogue: CatalogueSnapshot = parseCatalogueSnapshot({
  schemaVersion: 1,
  revision: 'monumental-preview-2026-10-25',
  videos: seedVideos,
  places: seedPlaces,
  periods: seedPeriods,
});

// ES module live bindings preserve the existing synchronous UI contract. Hydration
// happens once, before App and its derived editorial modules are imported.
export let videos = bundledCatalogue.videos;
export let places = bundledCatalogue.places;
export let periods = bundledCatalogue.periods;
export let categories = [...new Set(videos.map(video => video.category))];
export let catalogueIndex = createCatalogueIndex(bundledCatalogue);
let loadStatus: Omit<CatalogueLoad, 'snapshot'> & { revision: string } = { source: 'bundled', revision: bundledCatalogue.revision };
let initialization: Promise<void> | undefined;

export function getCatalogueStatus() { return { ...loadStatus }; }

export function initializeCatalogue(endpoint?: string): Promise<void> | undefined {
  // No endpoint means no request, timeout or deferred boot on the current site.
  if (!endpoint?.trim()) return undefined;
  return initialization ??= loadCatalogueWithFallback(bundledCatalogue, new HttpCatalogueRepository(endpoint.trim())).then(result => {
    const snapshot = result.snapshot;
    videos = snapshot.videos;
    places = snapshot.places;
    periods = snapshot.periods;
    categories = [...new Set(videos.map(video => video.category))];
    catalogueIndex = createCatalogueIndex(snapshot);
    loadStatus = { source: result.source, reason: result.reason, revision: snapshot.revision };
  });
}
