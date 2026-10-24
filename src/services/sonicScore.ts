/** Authored materials, rendered ahead of time. These are synthesis, not field recordings. */
export const sonicScore = {
  activate: { duration: 1.12, peak: .65, material: 'Monumental signature' },
  select: { duration: .22, peak: .48, material: 'Felted detent' },
  save: { duration: .64, peak: .55, material: 'Keepsake clasp' },
  remove: { duration: .28, peak: .42, material: 'Clasp release' },
  destination: { duration: 1.08, peak: .63, material: 'Atlas transit' },
  era: { duration: .83, peak: .55, material: 'Film splice' },
  error: { duration: .28, peak: .34, material: 'Soft obstruction' },
  hover: { duration: .085, peak: .16, material: 'Felt contact' },
  navigate: { duration: .53, peak: .48, material: 'Editorial cut' },
  open: { duration: .47, peak: .46, material: 'Hinged aperture' },
  close: { duration: .29, peak: .42, material: 'Damped closure' },
  drag: { duration: .19, peak: .25, material: 'Bearing friction' },
  tick: { duration: .105, peak: .25, material: 'Index tooth' },
  success: { duration: .8, peak: .58, material: 'Joined structure' },
  focus: { duration: .33, peak: .4, material: 'Optical lock' },
  collider: { duration: 1.15, peak: .64, material: 'Confluence' },
  'sculpture-unfold': { duration: .92, peak: .6, material: 'Chrome opening' },
  'sculpture-fold': { duration: .58, peak: .5, material: 'Chrome settling' },
  'sculpture-pulse': { duration: 1.18, peak: .65, material: 'Chrome resonance' },
  'sculpture-turn': { duration: .24, peak: .3, material: 'Chrome bearing' },
  'sculpture-reset': { duration: .53, peak: .47, material: 'Chrome alignment' },
} as const;
export type SoundType = keyof typeof sonicScore;
export type AmbientScene = 'home' | 'world' | 'time' | 'library';
export const sonicScenes: AmbientScene[] = ['home', 'world', 'time', 'library'];
export const sonicAsset = (name: SoundType | `room-${AmbientScene}`) => `${import.meta.env?.BASE_URL ?? '/'}audio/score-v1/${name}.wav`;
