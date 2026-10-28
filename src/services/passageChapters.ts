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

export const PASSAGE_CHAPTERS: readonly PassageChapter[] = [
  { id:'world',title:'The World',route:'/world',feature:'miami-frequency',
    lines:['EVERY PLACE.','AN OPEN DOOR.'],copy:'A story can take you somewhere. Turn the globe, choose a destination and meet the people making its culture.',action:'Explore the world',detail:'MIAMI → THE WORLD',object:'A planet of possibilities',
    environment:'observatory',center:[0,0,-32],yaw:0,
    camera:{approach:[2.6,.35,25],reveal:[-.7,1.1,20],read:[0,.7,16],target:[0,.5,-1]},
    panel:{position:[-5.1,.5,2],width:470,scale:.012},media:{position:[3.5,1,-1],width:10.6,yaw:0},exhibit:[2.8,-2.8,0],
    atmosphere:'A tall concrete observatory opens around a floating atlas, deep city windows and a fine meridian canopy.',compact:'A wide city window above an open, ivory-lined geographic composition.' },
  { id:'time-machine',title:'Time Machine',route:'/time-machine',feature:'break-beat-city',
    lines:['THE PAST.','STILL IN MOTION.'],copy:'Move through cultural moments. Follow the music, images and ideas that keep finding new life.',action:'Enter the Time Machine',detail:'THEN ↔ NOW',object:'An archive without an ending',
    environment:'archive',center:[3,1,-66],yaw:.09,
    camera:{approach:[2.1,.1,25],reveal:[.7,.7,20],read:[0,.3,16],target:[0,.2,-1]},
    panel:{position:[-5.1,.3,2],width:470,scale:.012},media:{position:[3.4,.6,-1],width:9.5,yaw:0},exhibit:[3,-2.9,0],
    atmosphere:'Offset paper-and-metal archive frames create a deep sequence of thresholds; current studies remain explicitly contemporary.',compact:'Overlapping archival margins and an inset contemporary study, without invented historical dates.' },
  { id:'movies',title:'The Cinema',route:'/category/movies',feature:'sintel-full',
    lines:['LIGHTS DOWN.','WORLDS OPEN.'],copy:'Independent films and extraordinary perspectives. Find a story, take your seat and stay a little longer.',action:'Enter the cinema',detail:'INDEPENDENT FILM',object:'A window into another world',
    environment:'cinema',center:[-2,-.4,-100],yaw:-.07,
    camera:{approach:[-2.7,.5,25],reveal:[-1,1,20],read:[0,.8,16],target:[0,.6,-2]},
    panel:{position:[-5.2,.45,2],width:470,scale:.012},media:{position:[3.7,1,-3],width:12,yaw:0},exhibit:[4.3,-2.9,0],
    atmosphere:'A dark proscenium, stepped floor and luminous full-width film surface; economical screen spill lights the room.',compact:'A generous letterboxed film screen, quiet black margins and a clear playback action.' },
  { id:'music',title:'Music',route:'/category/music',feature:'island-current',
    lines:['FOLLOW','THE FREQUENCY.'],copy:'Every sound comes from somewhere. Trace a rhythm back to its people, its streets and its story.',action:'Explore music',detail:'SOUND → PLACE → PEOPLE',object:'Culture has a resonance',
    environment:'resonance',center:[-5,.5,-134],yaw:-.1,
    camera:{approach:[-1.7,.15,25],reveal:[-1.1,.9,20],read:[0,.5,16],target:[0,.35,-1]},
    panel:{position:[-5.1,.4,2],width:470,scale:.012},media:{position:[3.5,.8,-1],width:10.4,yaw:0},exhibit:[3,-2.9,0],
    atmosphere:'Three suspended acoustic ribbons sweep through a bend. Their slow authored phrasing supports the moving study.',compact:'Sweeping engraved contours frame the sound study; restrained rhythm never implies audio analysis.' },
  { id:'culture',title:'Culture',route:'/category/culture',feature:'concrete-and-colour',
    lines:['LIFE.','IN EVERY FORM.'],copy:'Art on the street. Food around a shared table. Culture lives in the things we make together.',action:'Discover culture',detail:'ART / FOOD / PEOPLE',object:'Many perspectives. One connection.',
    environment:'atelier',center:[1,-.6,-168],yaw:.08,
    camera:{approach:[2,.2,25],reveal:[1,.4,19],read:[0,.15,16],target:[0,.1,-1]},
    panel:{position:[-5.1,.15,2],width:470,scale:.012},media:{position:[3.3,.7,-.5],width:9.7,yaw:0},exhibit:[4,-3.15,4.6],
    atmosphere:'An intimate workshop of mineral plaster, thick paper, a shared table and a suspended fabric image.',compact:'Warm paper edges and a generous material image bring the content to human scale.' },
  { id:'my-world',title:'My World',route:'/my-world',feature:'tokyo-in-motion',
    lines:['BRING','SOMETHING BACK.'],copy:'Keep the stories that stay with you. Collect places, make a journey and build a world that is yours.',action:'Open My World',detail:'YOUR COLLECTION',object:'Your own Monumental',
    environment:'collection',center:[0,0,-202],yaw:0,
    camera:{approach:[-1,.5,25],reveal:[-.35,.7,20],read:[0,.5,16],target:[0,.35,-1]},
    panel:{position:[-5.1,.35,2],width:470,scale:.012},media:{position:[3.5,.8,-1],width:9.9,yaw:0},exhibit:[3,-2.8,0],
    atmosphere:'A quiet collecting room brings the atlas rings, paper margins and cinema light together around real saved stories.',compact:'A calm personal shelf with actual saved content or a clearly labelled editorial starting point.' },
];

export function passageLocalToWorld(chapter: PassageChapter, point: PassageVector): [number,number,number] {
  const c=Math.cos(chapter.yaw),s=Math.sin(chapter.yaw);
  return [chapter.center[0]+point[0]*c+point[2]*s, chapter.center[1]+point[1], chapter.center[2]-point[0]*s+point[2]*c];
}
