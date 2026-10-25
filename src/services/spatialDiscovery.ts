import { videos, places, type Video } from '../data/catalogue';
export const playableStories = (items: Video[] = videos) => items.filter(v=>v.status==='available'&&v.access==='free'&&v.src);
export function connectionReason(a: Video,b: Video): string | null {
  if(a.id===b.id)return null;
  const place=a.places.find(id=>b.places.includes(id));
  if(place)return `Both explore ${places.find(p=>p.id===place)?.name || place}`;
  if(a.series&&a.series===b.series)return `Both belong to ${a.series}`;
  const tag=a.tags.find(t=>!['preview','motion study','originals','in development','history','full film','trailer'].includes(t)&&b.tags.includes(t));
  if(tag)return `Shared theme: ${tag}`;
  return a.category===b.category?`Shared category: ${a.category}`:null;
}
export function bridgeStories(from:string,to:string) {
  if(from===to)return [];
  const left=playableStories().filter(v=>v.places.includes(from));
  const right=playableStories().filter(v=>v.places.includes(to));
  return left.flatMap(a=>right.flatMap(b=>{const reason=connectionReason(a,b);return reason?[{a,b,reason}]:[];})).slice(0,4);
}
export function encodeItinerary(name:string,ids:string[]) {
  const valid=[...new Set(ids)].filter(id=>playableStories().some(v=>v.id===id)).slice(0,20);
  return new URLSearchParams({name:name.slice(0,80),stops:valid.join(',')}).toString();
}
export function decodeItinerary(params:URLSearchParams) {
  const raw=params.get('stops'); if(!raw||raw.length>2000)return null;
  const ids=[...new Set(raw.split(','))].filter(id=>playableStories().some(v=>v.id===id)).slice(0,20);
  return ids.length?{name:(params.get('name')||'A shared cultural journey').slice(0,80),videoIds:ids}:null;
}
export const escapeSvg=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function collectionPrint(ids:string[]) {
  const collection=videos.filter(v=>ids.includes(v.id)).slice(0,12);
  const points=collection.map((v,i)=>{const angle=i/Math.max(1,collection.length)*Math.PI*2-Math.PI/2;return {v,x:600+Math.cos(angle)*350,y:520+Math.sin(angle)*290};});
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1100" viewBox="0 0 1200 1100"><rect width="1200" height="1100" fill="#080909"/><text x="60" y="85" fill="#efeee9" font-family="sans-serif" font-size="38">MONUMENTAL / MY CONSTELLATION</text><text x="60" y="125" fill="#a9aaa6" font-family="sans-serif" font-size="18">A collection chosen by you. ${collection.length} stories, connected through curiosity.</text>${points.map(p=>`<path d="M600 520L${p.x} ${p.y}" stroke="#ff4d32" stroke-width="1"/><circle cx="${p.x}" cy="${p.y}" r="8" fill="#ff4d32"/><text x="${p.x}" y="${p.y+32}" text-anchor="middle" fill="#efeee9" font-family="sans-serif" font-size="16">${escapeSvg(p.v.title.slice(0,38))}</text>`).join('')}<circle cx="600" cy="520" r="65" fill="#080909" stroke="#efeee9"/><text x="600" y="532" text-anchor="middle" fill="#efeee9" font-family="sans-serif" font-size="34">M</text><text x="60" y="1020" fill="#a9aaa6" font-family="sans-serif" font-size="18">Personal collection graphic · Includes titles, no viewing history or personal notes.</text></svg>`;
}
