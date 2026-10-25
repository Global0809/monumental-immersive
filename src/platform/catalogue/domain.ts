/** Public editorial metadata only. Entitlements and private playback sources stay server-side. */
export interface Video {
  id: string;
  title: string;
  description: string;
  category: string;
  places: string[];
  period: string;
  publishedAt: string;
  people: string[];
  duration: number;
  poster: string;
  src?: string;
  captions?: string;
  access: 'free' | 'premium';
  status: 'available' | 'development';
  series?: string;
  episode?: number;
  credit: string;
  context?: string;
  tags: string[];
}

export interface Place {
  id: string;
  name: string;
  country: string;
  kind: string;
  lat: number;
  lon: number;
  description: string;
  image: string;
  tagline: string;
}

export interface Period { id: string; label: string; description: string; }

export interface CatalogueSnapshot {
  schemaVersion: 1;
  /** An opaque publishing revision; unchanged data should retain its revision. */
  revision: string;
  videos: Video[];
  places: Place[];
  periods: Period[];
}

export interface CatalogueRepository {
  load(): Promise<CatalogueSnapshot>;
}

export interface CatalogueIndex {
  videos: ReadonlyMap<string, Video>;
  places: ReadonlyMap<string, Place>;
  periods: ReadonlyMap<string, Period>;
  videosByPlace: ReadonlyMap<string, readonly Video[]>;
  videosByPeriod: ReadonlyMap<string, readonly Video[]>;
}
