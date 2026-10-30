/** A small original vocabulary: offline PCM shared by semantic intent. */
export const minimalAssets = {
  touch: { duration: .105, peak: .24, material: 'Soft tactile contact' },
  passage: { duration: .34, peak: .28, material: 'Air and space' },
  confirm: { duration: .46, peak: .27, material: 'Warm glass confirmation' },
  release: { duration: .18, peak: .22, material: 'Soft release' },
  portal: { duration: .68, peak: .3, material: 'Quiet threshold' },
  resist: { duration: .2, peak: .18, material: 'Gentle resistance' },
  hush: { duration: 6, peak: .028, material: 'Optional quiet air' },
} as const;
export type MinimalAsset = keyof typeof minimalAssets;
const cue = <T extends Exclude<MinimalAsset, 'hush'>>(asset: T) => ({ ...minimalAssets[asset], asset });
// Runtime policy chooses which actions deserve sound; aliases never auto-play.
export const sonicScore = {
  activate: cue('confirm'), select: cue('touch'), save: cue('confirm'), remove: cue('release'),
  destination: cue('passage'), era: cue('passage'), error: cue('resist'), hover: cue('touch'),
  navigate: cue('passage'), open: cue('passage'), close: cue('release'), drag: cue('release'),
  tick: cue('touch'), success: cue('confirm'), focus: cue('touch'), collider: cue('confirm'),
  'sculpture-unfold': cue('passage'), 'sculpture-fold': cue('release'), 'sculpture-pulse': cue('confirm'),
  'sculpture-turn': cue('touch'), 'sculpture-reset': cue('touch'), portal: cue('portal'),
  scan: cue('passage'), signal: cue('touch'), arrival: cue('confirm'),
  'assembly-release': cue('release'), 'assembly-drive': cue('passage'), 'assembly-lock': cue('touch'),
  'iris-open': cue('passage'), 'iris-close': cue('release'), 'threshold-pass': cue('portal'),
} as const;
export type SoundType = keyof typeof sonicScore;
export type AmbientScene = 'home' | 'world' | 'time' | 'library' | 'cinema' | 'music' | 'culture' | 'collection';
export const sonicScenes: AmbientScene[] = ['home', 'world', 'time', 'library', 'cinema', 'music', 'culture', 'collection'];
export type SonicAsset = SoundType | `room-${AmbientScene}` | 'portal-travel';
export const sonicAsset = (name: SonicAsset) => {
  const asset: MinimalAsset = name === 'portal-travel' || name.startsWith('room-') ? 'hush' : sonicScore[name as SoundType].asset;
  return `${import.meta.env?.BASE_URL ?? '/'}audio/score-v3/${asset}.wav`;
};
