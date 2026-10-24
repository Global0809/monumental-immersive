/** Existing content anchors. No pins, spacers, or additional document height. */
export type ErosionTheme = 'black' | 'charcoal' | 'paper' | 'warm' | 'red';
export type ErosionChapter = {
  selector: string;
  fromTheme?: ErosionTheme;
  toTheme: ErosionTheme;
  seed: string;
  direction?: 'up' | 'down';
  /** Viewport positions of the chapter top, measured in viewport heights. */
  start?: number;
  end?: number;
  macroAmplitude?: number;
  detailAmount?: number;
  edgeSoftness?: number;
  enabled?: boolean;
};
const chapter = (selector: string, toTheme: ErosionTheme, seed: string, extra: Partial<ErosionChapter> = {}): ErosionChapter =>
  ({ selector, toTheme, seed, start: .88, end: -.1, macroAmplitude: .15, detailAmount: 1, ...extra });

export function erosionChapters(path: string): ErosionChapter[] {
  let chapters: ErosionChapter[];
  if (path === '/') chapters = [
    chapter('.discovery-section', 'warm', 'frequency'),
    chapter('.original-feature', 'black', 'wavemakers'),
    chapter('.portal-section', 'paper', 'go-somewhere', { macroAmplitude: .18, detailAmount: 1.2 }),
    chapter('.category-section', 'red', 'all-culture'),
  ];
  else if (path === '/world') chapters = [chapter('.ex-connections', 'paper', 'world-thread'), chapter('.ex-results', 'black', 'world-stories')];
  else if (path === '/time-machine') chapters = [chapter('.ex-era-results', 'warm', 'era-context')];
  else if (path.startsWith('/category/') || path === '/search') chapters = [chapter('.results-line', 'paper', 'catalogue-' + path)];
  else if (path.startsWith('/film/')) chapters = [chapter('.story-context', 'warm', 'story-context'), chapter('.film-detail > .page-section:last-child', 'black', 'related-stories')];
  else if (path === '/my-world') chapters = [chapter('.tab-row', 'paper', 'my-collection'), chapter('.moment-notebook', 'warm', 'field-notes'), chapter('.culture-passport', 'red', 'passport')];
  else if (path === '/journey') chapters = [chapter('.journey-results, .journey-invitation', 'paper', 'journey-edit')];
  else if (path === '/motion') chapters = [chapter('.motion-layout', 'red', 'motion-laboratory', { macroAmplitude: .12 })];
  else if (path === '/premium') chapters = [chapter('.membership-grid', 'warm', 'membership', { macroAmplitude: .1 })];
  else if (path === '/settings') chapters = [chapter('.settings-list', 'paper', 'settings', { macroAmplitude: .09, detailAmount: .65 })];
  else if (path === '/credits') chapters = [chapter('.credits-list', 'warm', 'credits', { macroAmplitude: .11 })];
  else chapters = [];
  // The real concept-film chapter already exists even on shorter Live pages.
  if (path !== '/' && path !== '/motion') chapters.push(chapter('.route-stage > .motion-showcase', path === '/live' ? 'paper' : 'black', 'motion-' + path));
  chapters.push(chapter('.site-footer', 'black', 'closing', { macroAmplitude: .1 }));
  return chapters;
}

/** These keep their existing material, pixels and interface palette. Also usable by new components. */
export const erosionProtected = [
  '[data-erosion-protect]', '.hero', '.original-feature', '.detail-hero',
  '.ex-world-room', '.ex-world-tools', '.ex-destinations', '.city-experience',
  '.ex-time-room', '.ex-era-room', '.ex-time-controls', '.ex-era-toolbar',
  '.personal-monument', '.culture-collider', '.portal', '.ex-era-frame', '.ex-comparison',
  '.ex-connection-link', '.film-image', '.ex-story-image', '.ex-location-photo',
  '.motion-stage', '.motion-index', '.motion-controls', '.passport-card', '.passport-detail',
  '.notebook-play', '.notebook-editor', '.sound-studio', '.journey-builder', '.journey-edit-bar',
  '.journey-stop', '.search-field', '.browse-filters', '.filter-row', '.active-filters',
  '.catalogue-tools', '.frequency-tuner', '.settings-list > div', '.membership-grid > div',
  'button', 'input', 'textarea', 'select', '.button', '[contenteditable]',
  'video', 'img', 'canvas', 'iframe', 'dialog', '[popover]',
].join(',');
