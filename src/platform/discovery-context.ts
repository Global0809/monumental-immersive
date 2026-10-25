import type { Video, Place, Period } from '../data/catalogue';

/** Public catalogue grounding only. Never accepts ViewerState or account data. */
export type DiscoverySource = {
  id: string;
  title: string;
  summary: string;
  context: string;
  category: string;
  places: { id: string; name: string; country: string }[];
  period: { id: string; label: string };
  publishedAt: string;
  duration: number;
  access: Video['access'];
  status: Video['status'];
  credit: string;
  tags: string[];
};
export type DiscoveryContext = {
  schemaVersion: 1;
  catalogueRevision: string;
  sources: DiscoverySource[];
};

export function createDiscoveryContext(catalogue: {
  revision: string;
  videos: readonly Video[];
  places: readonly Place[];
  periods: readonly Period[];
}): DiscoveryContext {
  const places = new Map(catalogue.places.map(place => [place.id, place]));
  const periods = new Map(catalogue.periods.map(period => [period.id, period]));
  return {
    schemaVersion: 1,
    catalogueRevision: catalogue.revision,
    sources: catalogue.videos.map(video => {
      const period = periods.get(video.period);
      if (!period) throw new Error(`Unknown period for ${video.id}`);
      return {
        id: video.id, title: video.title, summary: video.description,
        context: video.context || '', category: video.category,
        places: video.places.map(id => {
          const place = places.get(id);
          if (!place) throw new Error(`Unknown destination for ${video.id}`);
          return { id, name: place.name, country: place.country };
        }),
        period: { id: period.id, label: period.label },
        publishedAt: video.publishedAt, duration: video.duration,
        access: video.access, status: video.status, credit: video.credit,
        tags: [...video.tags],
      };
    }),
  };
}

/** Future server response contract. Validation checks provenance, not factual entailment. */
export type DiscoveryAnswer = {
  schemaVersion: 1;
  catalogueRevision: string;
  recommendations: { storyId: string; reason: string; sourceIds: string[] }[];
};

export function parseDiscoveryAnswer(input: unknown, context: DiscoveryContext): DiscoveryAnswer {
  if (!input || typeof input !== 'object') throw new Error('Invalid discovery response');
  const value = input as Record<string, unknown>;
  if (value.schemaVersion !== 1 || value.catalogueRevision !== context.catalogueRevision ||
      !Array.isArray(value.recommendations) || value.recommendations.length > 12) {
    throw new Error('Unsupported or stale discovery response');
  }
  const sources = new Map(context.sources.map(source => [source.id, source]));
  const seen = new Set<string>();
  const recommendations = value.recommendations.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid recommendation');
    const row = entry as Record<string, unknown>;
    if (typeof row.storyId !== 'string' || seen.has(row.storyId) ||
        sources.get(row.storyId)?.status !== 'available' ||
        typeof row.reason !== 'string' || !row.reason.trim() || row.reason.length > 800 ||
        !Array.isArray(row.sourceIds) || row.sourceIds.length === 0 || row.sourceIds.length > 8 ||
        !row.sourceIds.every(id => typeof id === 'string' && sources.has(id)) ||
        !row.sourceIds.includes(row.storyId)) {
      throw new Error('Recommendation requires an available story and valid supporting sources');
    }
    seen.add(row.storyId);
    // Copy only the contract fields; generated actions, URLs and HTML are never accepted.
    return { storyId: row.storyId, reason: row.reason.trim(), sourceIds: [...new Set(row.sourceIds as string[])] };
  });
  return { schemaVersion: 1, catalogueRevision: context.catalogueRevision, recommendations };
}
