import { tunnelStationZ } from './tunnelJourney';

/** Authored together: local architecture, camera, media and editorial placement.
 * Coordinates are local to each chapter, +Z faces the arriving visitor. */
export type PassageVector = readonly [number, number, number];
export type PassageChapter = {
  id: string; title: string; route: string; feature: string;
  lines: readonly [string,string]; copy: string; action: string; detail: string; object: string;
  environment: 'observatory'|'archive'|'cinema'|'resonance'|'atelier'|'collection';
  center: PassageVector; yaw: number;
  camera: { approach: PassageVector; reveal: PassageVector; read: PassageVector; target: PassageVector };
  panel: { position: PassageVector; width: number; scale: number };
  media: { position: PassageVector; width: number; yaw: number };
  exhibit: PassageVector; atmosphere: string; compact: string;
};

type PassageContent = Omit<PassageChapter,'center'|'yaw'|'camera'|'panel'|'media'|'exhibit'>;
const chapterContent: readonly PassageContent[] = [
  { id:'world',title:'The World',route:'/world',feature:'miami-frequency',
    lines:['EVERY PLACE.','AN OPEN DOOR.'],copy:'A story can take you somewhere. Turn the globe, choose a destination and meet the people making its culture.',action:'Explore the world',detail:'MIAMI → THE WORLD',object:'A planet of possibilities',
    environment:'observatory',
    atmosphere:'A geographic instrument and city study unfold on the first mechanical carrier.',compact:'A wide city window above an open, ivory-lined geographic composition.' },
  { id:'time-machine',title:'Time Machine',route:'/time-machine',feature:'break-beat-city',
    lines:['THE PAST.','STILL IN MOTION.'],copy:'Move through cultural moments. Follow the music, images and ideas that keep finding new life.',action:'Enter the Time Machine',detail:'THEN ↔ NOW',object:'An archive without an ending',
    environment:'archive',
    atmosphere:'Layered archival rings unfold from a carrier on the opposite tunnel wall; contemporary studies remain explicitly labelled.',compact:'Overlapping archival margins and an inset contemporary study, without invented historical dates.' },
  { id:'movies',title:'The Cinema',route:'/category/movies',feature:'sintel-full',
    lines:['LIGHTS DOWN.','WORLDS OPEN.'],copy:'Independent films and extraordinary perspectives. Find a story, take your seat and stay a little longer.',action:'Enter the cinema',detail:'INDEPENDENT FILM',object:'A window into another world',
    environment:'cinema',
    atmosphere:'A larger film window sits within a deep mechanical proscenium; footage keeps its original colours.',compact:'A generous letterboxed film screen, quiet black margins and a clear playback action.' },
  { id:'music',title:'Music',route:'/category/music',feature:'island-current',
    lines:['FOLLOW','THE FREQUENCY.'],copy:'Every sound comes from somewhere. Trace a rhythm back to its people, its streets and its story.',action:'Explore music',detail:'SOUND → PLACE → PEOPLE',object:'Culture has a resonance',
    environment:'resonance',
    atmosphere:'An inspectable record instrument and performance study inhabit a carrier surrounded by authored rhythmic light.',compact:'Sweeping engraved contours frame the sound study; restrained rhythm never implies audio analysis.' },
  { id:'culture',title:'Culture',route:'/category/culture',feature:'concrete-and-colour',
    lines:['LIFE.','IN EVERY FORM.'],copy:'Art on the street. Food around a shared table. Culture lives in the things we make together.',action:'Discover culture',detail:'ART / FOOD / PEOPLE',object:'Many perspectives. One connection.',
    environment:'atelier',
    atmosphere:'A tactile ceramic object sits below the cultural study within the same continuous structure.',compact:'Warm paper edges and a generous material image bring the content to human scale.' },
  { id:'my-world',title:'My World',route:'/my-world',feature:'tokyo-in-motion',
    lines:['BRING','SOMETHING BACK.'],copy:'Keep the stories that stay with you. Collect places, make a journey and build a world that is yours.',action:'Open My World',detail:'YOUR COLLECTION',object:'Your own Monumental',
    environment:'collection',
    atmosphere:'The final carrier collects actual saved posters beside an inspectable personal monument.',compact:'A calm personal shelf with actual saved content or a clearly labelled editorial starting point.' },
];

/** Six existing catalogue chapters inhabit one continuous physical tunnel. */
export const PASSAGE_CHAPTERS: readonly PassageChapter[] = chapterContent.map((chapter,index) => ({
  ...chapter,center:[0,0,tunnelStationZ(index)],yaw:0,
  camera:{approach:[0,.12,28],reveal:[0,.12,19],read:[0,.12,11.5],target:[0,.12,-12.5]},
  panel:{position:[-4.3,.35,.85],width:470,scale:.012},
  media:{position:[3.1,.8,.65],width:index===2?8.6:7.8,yaw:0},
  // Right-mounted carriers need an inboard exhibit position clear of the
  // fixed support motor, including the timepiece crown and platter corners.
  exhibit:[index%2?5:6,-3.25,.8],
}));
export function passageLocalToWorld(chapter: PassageChapter, point: PassageVector): [number,number,number] {
  const c=Math.cos(chapter.yaw),s=Math.sin(chapter.yaw);
  return [chapter.center[0]+point[0]*c+point[2]*s, chapter.center[1]+point[1], chapter.center[2]-point[0]*s+point[2]*c];
}
