import { PASSAGE_CHAPTERS, passageLocalToWorld, type PassageVector } from './passageChapters';
import type { TunnelFrame } from './tunnelJourney';

export type PassagePose = { position: PassageVector; target: PassageVector; fov: number };
const clamp=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):n===Infinity?1:0;
const smooth=(n:number)=>{const t=clamp(n);return t*t*t*(t*(t*6-15)+10);};
const mix=(a:PassageVector,b:PassageVector,t:number):PassageVector=>a.map((v,i)=>v+(b[i]-v)*t) as unknown as PassageVector;
function curve(a:PassageVector,b:PassageVector,c:PassageVector,d:PassageVector,t:number):PassageVector {
  const u=1-t;
  return a.map((v,i)=>u*u*u*v+3*u*u*t*b[i]+3*u*t*t*c[i]+t*t*t*d[i]) as unknown as PassageVector;
}
const world=(i:number,p:PassageVector)=>passageLocalToWorld(PASSAGE_CHAPTERS[i],p);
export const PASSAGE_READING_START=.38, PASSAGE_READING_END=.74;

/** Deterministic scroll poses. The camera and its look target share the same
 * authored path; no time-based damping can detach the scene from native scroll. */
export function passagePose(frame:Pick<TunnelFrame,'active'|'progress'>):PassagePose {
  const p=clamp(frame.progress), i=Number.isNaN(frame.active)?-1:Math.min(5,Math.max(-1,Math.floor(frame.active)));
  if(i<0) {
    const t=smooth(p), end=world(0,PASSAGE_CHAPTERS[0].camera.approach);
    return {position:curve([0,.5,12],[3.3,.45,5],[3.2,.35,-2],end,t),
      target:mix([3.3,.2,-12],world(0,PASSAGE_CHAPTERS[0].camera.target),t),fov:46};
  }
  const c=PASSAGE_CHAPTERS[i], read=world(i,c.camera.read), target=world(i,c.camera.target);
  if(p<PASSAGE_READING_START) {
    const t=smooth(p/PASSAGE_READING_START), reveal=world(i,c.camera.reveal);
    return {position:curve(world(i,c.camera.approach),reveal,reveal,read,t),target,fov:46};
  }
  if(p<=PASSAGE_READING_END||i===5) return {position:read,target,fov:46};
  const t=smooth((p-PASSAGE_READING_END)/(1-PASSAGE_READING_END)),next=PASSAGE_CHAPTERS[i+1];
  // Exit to the left of the image, then arc into the next threshold. These
  // control points clear every media plane rather than flying through footage.
  return {position:curve(read,world(i,[-7,.4,8]),world(i,[-8,.4,-9]),world(i+1,next.camera.approach),t),
    target:mix(target,world(i+1,next.camera.target),t),fov:46};
}

export function passageContentOpacity(index:number,frame:Pick<TunnelFrame,'active'|'progress'>) {
  if(index!==frame.active)return 0;
  const p=clamp(frame.progress);
  return smooth((p-.11)/.23)*(index===5?1:1-smooth((p-.74)/.13));
}
export function passageReading(frame:Pick<TunnelFrame,'active'|'progress'>) {
  return frame.active>=0&&frame.progress>=PASSAGE_READING_START&&(frame.progress<=PASSAGE_READING_END||frame.active===5);
}
