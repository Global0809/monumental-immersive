import { places, videos, type Place, type Video } from '../data/catalogue';
export type SavedConstellation = { id: string; title: string; place?: Place; films: Video[]; savedPlace: boolean };
/** Only saved films form satellites. A location is context, not an implied saved place. */
export function savedConstellations(savedIds: readonly string[], savedPlaceIds: readonly string[]): SavedConstellation[] {
  const groups = new Map<string,SavedConstellation>();
  const ensure=(place?:Place)=>{
    const id=place?.id || 'collection';
    if(!groups.has(id))groups.set(id,{id,title:place?.name || 'Your collection',place,films:[],savedPlace:savedPlaceIds.includes(id)});
    return groups.get(id)!;
  };
  for(const place of places)if(savedPlaceIds.includes(place.id))ensure(place);
  for(const id of new Set(savedIds)){
    const film=videos.find(item=>item.id===id);if(!film)continue;
    // Every saved film appears once; its other documented destinations stay in its details.
    ensure(places.find(place=>place.id===film.places[0])).films.push(film);
  }
  return [...groups.values()];
}
