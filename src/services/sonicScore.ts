/** Original stereo material studies, rendered offline. No sampled or generated stock audio. */
export const sonicScore = {
  activate: { duration: 1.45, peak: .65, material: 'Monumental ignition' },
  select: { duration: .29, peak: .51, material: 'Magnetic detent' },
  save: { duration: .88, peak: .58, material: 'Memory seal' },
  remove: { duration: .38, peak: .45, material: 'Magnetic release' },
  destination: { duration: 1.26, peak: .63, material: 'Atlas vector' },
  era: { duration: 1.08, peak: .58, material: 'Archive transport' },
  error: { duration: .32, peak: .36, material: 'Soft resistance' },
  hover: { duration: .15, peak: .26, material: 'Proximity contact' },
  navigate: { duration: .72, peak: .55, material: 'Spatial passage' },
  open: { duration: .68, peak: .55, material: 'Pressure aperture' },
  close: { duration: .43, peak: .48, material: 'Vacuum seal' },
  drag: { duration: .26, peak: .32, material: 'Suspended bearing' },
  tick: { duration: .16, peak: .32, material: 'Instrument index' },
  success: { duration: 1.03, peak: .6, material: 'Resolved structure' },
  focus: { duration: .46, peak: .47, material: 'Optical alignment' },
  collider: { duration: 1.43, peak: .65, material: 'Converging fields' },
  'sculpture-unfold': { duration: 1.23, peak: .62, material: 'Articulated chrome' },
  'sculpture-fold': { duration: .86, peak: .56, material: 'Counterweight return' },
  'sculpture-pulse': { duration: 1.36, peak: .65, material: 'Structural resonance' },
  'sculpture-turn': { duration: .35, peak: .36, material: 'Orbital bearing' },
  'sculpture-reset': { duration: .78, peak: .54, material: 'Mechanical registration' },
  portal: { duration: 1.65, peak: .65, material: 'Threshold pressure' },
  scan: { duration: .79, peak: .5, material: 'Optical section' },
  signal: { duration: .83, peak: .55, material: 'Relay transmission' },
  arrival: { duration: 1.18, peak: .6, material: 'Spatial settlement' },
  'assembly-release': { duration: .43, peak: .59, material: 'Sequential lock release' },
  'assembly-drive': { duration: .64, peak: .61, material: 'Loaded hydraulic articulation' },
  'assembly-lock': { duration: .54, peak: .63, material: 'Structural clamp registration' },
  'iris-open': { duration: 1.12, peak: .6, material: 'Spiral aperture drive' },
  'iris-close': { duration: .83, peak: .56, material: 'Aperture counterweight return' },
  'threshold-pass': { duration: .68, peak: .53, material: 'Chamber pressure transfer' },
} as const;
export type SoundType = keyof typeof sonicScore;
export type AmbientScene = 'home' | 'world' | 'time' | 'library' | 'cinema' | 'music' | 'culture' | 'collection';
export const sonicScenes: AmbientScene[] = ['home', 'world', 'time', 'library', 'cinema', 'music', 'culture', 'collection'];
export type SonicAsset = SoundType | `room-${AmbientScene}` | 'portal-travel';
export const sonicAsset = (name: SonicAsset) => `${import.meta.env?.BASE_URL ?? '/'}audio/score-v2/${name}.wav`;
