export type PassageMediaBounds = Readonly<{ left:number; top:number; right:number; bottom:number }>;
let bounds:PassageMediaBounds|null=null;
const listeners=new Set<()=>void>();
export const getPassageMediaBounds=()=>bounds;
/** Projected by the scene, consumed by decorative overlays without DOM reads. */
export function setPassageMediaBounds(next:PassageMediaBounds|null){
  const valid=next&&Object.values(next).every(Number.isFinite)&&next.right>next.left&&next.bottom>next.top;
  const value=valid?Object.freeze({left:Math.round(next.left*4)/4,top:Math.round(next.top*4)/4,right:Math.round(next.right*4)/4,bottom:Math.round(next.bottom*4)/4}):null;
  if(value===null&&bounds===null||value&&bounds&&value.left===bounds.left&&value.top===bounds.top&&value.right===bounds.right&&value.bottom===bounds.bottom)return;
  bounds=value;listeners.forEach(listener=>listener());
}
export function subscribePassageMediaBounds(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
