/** Media events are the source of truth. Visibility never implies a successful decode. */
export type MotionMediaState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'failed' | 'unsupported';
export type MotionMediaEvent = 'request' | 'loaded' | 'play' | 'pause' | 'waiting' | 'ended' | 'failed' | 'unsupported' | 'reset';

export function motionMediaTransition(state: MotionMediaState, event: MotionMediaEvent): MotionMediaState {
  if (event === 'reset') return 'idle';
  if (event === 'request') return 'loading';
  if (event === 'failed' || event === 'unsupported') return event;
  // A delayed canplay/pause event must not erase a failed attempt. Only retry can.
  if (state === 'failed' || state === 'unsupported') return state;
  if (event === 'loaded') return state === 'playing' ? state : 'ready';
  if (event === 'play') return 'playing';
  if (event === 'waiting') return state === 'idle' ? state : 'loading';
  if (event === 'pause') return state === 'playing' || state === 'ready' ? 'paused' : state;
  return event;
}

export const motionMediaLabels: Record<MotionMediaState, string> = {
  idle: 'Not played', loading: 'Preparing preview', ready: 'Ready to play',
  playing: 'Playing', paused: 'Paused', ended: 'Ended',
  failed: 'Preview unavailable', unsupported: 'Format unsupported',
};

export function motionMediaCanSeek(state: MotionMediaState, duration: number): boolean {
  return Number.isFinite(duration) && duration > 0 && ['ready', 'playing', 'paused', 'ended'].includes(state);
}
