import { PASSAGE_CHAPTERS, type PassageVector } from './passageChapters';
import { tunnelChapterZ, tunnelEntranceZ, type TunnelFrame } from './tunnelJourney';
import { samplePassageAssembly } from './passageAssembly';

export type PassagePose = { position: PassageVector; target: PassageVector; fov: number };
export type PassageStationMotion = { position: PassageVector; rotation: PassageVector; extend: number; reveal: number; latch: number; visible: boolean };
const clamp=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):n===Infinity?1:0;
const smooth=(n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
const between=(a:number,b:number,n:number)=>smooth((n-a)/(b-a));
const stationIndex=(value:number)=>Number.isFinite(value)?Math.max(-1,Math.min(5,Math.floor(value))):value===Infinity?5:-1;
export const PASSAGE_READING_START=.38, PASSAGE_READING_END=.74;

/** One native-scroll coordinate drives the camera, carrier mechanisms and CSS3D.
 * Unlike a timed transition, reversing or jumping always reconstructs the pose. */
export function passagePose(frame:Pick<TunnelFrame,'active'|'progress'>):PassagePose {
  const p=clamp(frame.progress),i=stationIndex(frame.active);
  const z=i<0?tunnelEntranceZ(p):tunnelChapterZ(i,p);
  const x=Math.sin(z*.014)*.16,y=.12+Math.sin(z*.021)*.08;
  return {position:[x,y,z],target:[x*.25,.12,z-24],fov:59};
}

/** Permanent side-mounted carriages extend into view, then tuck back into the
 * wall before the camera crosses their plane. Both renderers use this pose. */
export function passageStationMotion(index:number,frame:Pick<TunnelFrame,'active'|'progress'>):PassageStationMotion {
  const i=Math.max(0,stationIndex(index)),chapter=PASSAGE_CHAPTERS[i];
  const z=passagePose(frame).position[2],distance=z-chapter.center[2],side=i%2===0?-1:1;
  const approach=1-between(16,28,distance),clearance=between(8,11.2,distance);
  const extend=approach*clearance;
  return {
    position:[side*(8.4-7.5*extend),0,chapter.center[2]+.5*extend],
    rotation:[0,side*((1-extend)*1.42+extend*.07),0],
    extend,reveal:(1-between(12,17.5,distance))*between(8.5,11.2,distance),
    latch:(1-between(23,35,distance))*between(-4,3,distance),
    visible:distance>-26&&distance<88,
  };
}

/** Twelve staggered vertical strands, matching the carrier's physical leaves.
 * The one semantic DOM becomes unclipped at arrival; no duplicate text layers. */
export function passageWeaveMask(reveal:number):string {
  const p=clamp(reveal);if(p>=.9999)return 'none';
  const points=['0% 100%'];
  for(let i=0;i<12;i++){
    const lead=smooth((p-i*.018)/.802),top=(100*(1-lead)).toFixed(2);
    points.push(`${(i/12*100).toFixed(2)}% ${top}%`,`${((i+1)/12*100).toFixed(2)}% ${top}%`);
  }
  points.push('100% 100%');return `polygon(${points.join(',')})`;
}
export function passageContentOpacity(index:number,frame:Pick<TunnelFrame,'active'|'progress'>) {
  if(index!==frame.active)return 0;
  return samplePassageAssembly(index,frame).content;
}
export function passageReading(frame:Pick<TunnelFrame,'active'|'progress'>) {
  return frame.active>=0&&frame.progress>=PASSAGE_READING_START&&(frame.progress<=PASSAGE_READING_END||frame.active===5);
}
