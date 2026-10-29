import { places, videos } from '../data/catalogue';

/** Preserve explicit filters and carry only verified story/place identity. */
export function portalContext(path: string, params: Record<string, string | undefined>, selectedPlace: string) {
  const next = { ...params };
  const place = places.find(item => item.id === (params.place || selectedPlace));
  if (path === '/world' && !next.place && place) next.place = place.id;
  const film = path.startsWith('/film/') ? videos.find(item => item.id === path.slice(6)) : undefined;
  return {
    params: next,
    label: film?.title || ((path === '/world' || path === '/time-machine') && place ? place.name : ''),
    image: film?.poster || (path === '/world' && place ? place.image : ''),
    identity: film ? `film:${film.id}` : path === '/world' && place ? `place:${place.id}` : '',
  };
}
