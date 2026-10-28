/** One browser animation-frame dispatch for the Passage and its flight crew.
 * Subscribers request their next frame explicitly; idle scenes cost nothing. */
let nativeFrame=0, sequence=0;
const callbacks=new Map<number,FrameRequestCallback>();
function flush(time:number) {
  nativeFrame=0;
  const pending=[...callbacks.values()]; callbacks.clear();
  for(const callback of pending) callback(time);
}
export function requestVisualFrame(callback:FrameRequestCallback) {
  const id=++sequence; callbacks.set(id,callback);
  if(!nativeFrame)nativeFrame=requestAnimationFrame(flush);
  return id;
}
export function cancelVisualFrame(id:number) {
  callbacks.delete(id);
  if(!callbacks.size&&nativeFrame){cancelAnimationFrame(nativeFrame);nativeFrame=0;}
}
