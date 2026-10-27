import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'http://127.0.0.1:5173/';
const output = 'test-results/ui';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
// Never borrow the visitor's saves or preferences, or seed state to bypass the UI.
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference' });
const page = await context.newPage();
page.setDefaultTimeout(15_000);
const results = [], runtimeErrors = [], screenshots = [];
let phase = 'Initial load';
page.on('pageerror', error => runtimeErrors.push({ phase, message: error.message }));
function url(route) { const target = new URL(base); target.hash = route; return target.href; }
function record(name, condition, detail = '') {
  assert.ok(condition, `${name}${detail ? ': ' + detail : ''}`);
  results.push({ name, passed: true, detail }); console.log(`PASS ${name}`);
}
async function screenshot(name) {
  // Capture the arrived composition, not a transient navigation fade.
  await page.waitForFunction(() => {
    const stage = document.querySelector('.route-stage');
    return !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert && (!stage || Number(getComputedStyle(stage).opacity) >= .99);
  });
  const path = `${output}/${name}.png`; await page.screenshot({ path }); screenshots.push(path);
}
async function ready(route) {
  await page.waitForURL(current => current.hash === '#' + route);
  await page.locator('main h1').first().waitFor(); await page.locator('.site-header').waitFor();
}
async function visit(route) { await page.goto(url(route), { waitUntil: 'domcontentloaded' }); await ready(route); }
async function noOverflow(label) {
  const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
  record(`No horizontal overflow: ${label}`, dimensions.content <= dimensions.viewport + 1, JSON.stringify(dimensions));
}
async function focused(locator) { return locator.evaluate(element => element === document.activeElement); }
async function waitCatalogue() {
  await page.waitForFunction(() => /^\d+ stor(?:y|ies)$/.test(document.querySelector('.catalogue-result-summary [role="status"]')?.textContent || ''));
}

try {
  phase = 'Fresh My World';
  await visit('/my-world'); await page.locator('.collection-welcome').waitFor();
  record('Fresh My World offers an immediate film', await page.getByRole('button', { name: 'Watch Miami, in Frequency', exact: true }).isVisible());
  record('Fresh My World does not show empty collection tabs', await page.getByRole('tablist', { name: 'Your collection' }).count() === 0);
  record('Single global header; no redundant persistent dock', await page.locator('.site-header').count() === 1 && await page.locator('.spatial-dock, .spatial-wayfinding, .bottom-nav').count() === 0);
  record('Desktop primary navigation', JSON.stringify(await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link').allTextContents()) === JSON.stringify(['World', 'Time Machine', 'Watch', 'Journeys', 'My World']));
  await screenshot('my-world-empty-desktop');

  phase = 'Index and keyboard navigation';
  const openIndex = page.getByRole('button', { name: 'Open Index', exact: true });
  await openIndex.click();
  const index = page.getByRole('dialog', { name: 'Find your way.' }); await index.waitFor();
  const expectedRoutes = ['/', '/world', '/time-machine', '/journey', '/motion', '/search', '/category/movies', '/category/music', '/category/culture', '/category/sports', '/category/gaming', '/category/news', '/category/fashion', '/category/kids', '/live', '/my-world', '/settings', '/premium', '/credits'];
  const directoryRoutes = await index.getByRole('link').evaluateAll(links => links.map(link => new URL(link.href).hash.slice(1)));
  record('Index retains every supported destination', JSON.stringify([...directoryRoutes].sort()) === JSON.stringify([...expectedRoutes].sort()));
  for (const group of ['Explore', 'Watch', 'Your space']) record(`Index group: ${group}`, await index.getByRole('navigation', { name: group, exact: true }).isVisible());
  const closeIndex = index.getByRole('button', { name: 'Close Index' });
  await closeIndex.focus(); await page.keyboard.press('Shift+Tab');
  record('Index reverse Tab wraps within dialog', await focused(index.getByRole('button', { name: 'Sound Studio' })));
  await page.keyboard.press('Tab'); record('Index Tab wraps to close', await focused(closeIndex));
  await screenshot('index-desktop');
  await page.keyboard.press('Escape'); await index.waitFor({ state: 'hidden' });
  record('Index Escape restores its opener', await focused(openIndex));
  await openIndex.click(); await index.getByRole('button', { name: 'Sound Studio' }).click();
  await page.locator('#sound-console:popover-open').waitFor();
  record('Sound Studio opens after Index releases focus', await focused(page.locator('#sound-console')) && !(await index.isVisible()));
  record('Interface sound starts opt-in', await page.locator('#sound-console').getByRole('switch', { name: 'Interface sound', exact: true }).getAttribute('aria-checked') === 'false');
  await page.keyboard.press('Escape'); await page.locator('#sound-console:popover-open').waitFor({ state: 'hidden' });

  phase = 'Search and filtering';
  await page.getByRole('link', { name: 'Search stories and places' }).click();
  await page.getByRole('combobox', { name: 'Search everything' }).fill('Tokyo');
  await page.getByRole('button', { name: 'Full catalogue', exact: true }).click();
  await ready('/search?q=Tokyo'); await waitCatalogue();
  const cards = page.locator('.film-grid[aria-label="Catalogue results"] .film-card');
  record('Quick search carries its query into the catalogue', await page.getByRole('textbox', { name: 'Search catalogue' }).inputValue() === 'Tokyo' && await cards.count() > 0);
  const tokyoCount = await cards.count();
  await page.getByLabel('Destination', { exact: true }).selectOption('miami');
  await page.waitForURL(current => new URLSearchParams(current.hash.split('?')[1]).get('place') === 'miami');
  await page.getByRole('heading', { name: 'No stories match these filters.' }).waitFor();
  record('Combined query and destination intersect honestly', await cards.count() === 0);
  await page.getByRole('button', { name: 'Clear these filters', exact: true }).click();
  await ready('/search'); await waitCatalogue(); const catalogueCount = await cards.count();
  record('Reset restores catalogue without a fixed item count', catalogueCount > tokyoCount, `${catalogueCount} entries`);
  await page.getByRole('radio', { name: 'List view', exact: true }).click(); await page.locator('.film-grid.list-view').waitFor();
  record('List view retains catalogue results', await cards.count() === catalogueCount);
  await page.getByRole('radio', { name: 'Grid view', exact: true }).click();
  await page.getByLabel('Sort catalogue', { exact: true }).selectOption('title');
  await page.waitForURL(current => new URLSearchParams(current.hash.split('?')[1]).get('sort') === 'title');
  const titles = await cards.locator('.film-title').allTextContents();
  record('Alphabetical sorting changes the rendered collection', titles.length === catalogueCount && JSON.stringify(titles) === JSON.stringify([...titles].sort((a, b) => a.localeCompare(b))));
  await screenshot('catalogue-desktop');

  phase = 'Save, playback and resume';
  const miamiCard = cards.filter({ has: page.getByRole('link', { name: 'Details: Miami, in Frequency', exact: true }) });
  await miamiCard.getByRole('button', { name: 'Save Miami, in Frequency', exact: true }).click();
  record('Saved control reflects its state', await miamiCard.getByRole('button', { name: 'Remove Miami, in Frequency', exact: true }).getAttribute('aria-pressed') === 'true');
  await miamiCard.getByRole('button', { name: 'Play Miami, in Frequency', exact: true }).click();
  const player = page.locator('.ms-player-dialog'); await player.waitFor(); const video = player.locator('video');
  await page.waitForFunction(() => document.querySelector('.ms-player-dialog video')?.readyState >= 2);
  record('Local film has a finite playable duration', await video.evaluate(element => Number.isFinite(element.duration) && element.duration > 0));
  if (await video.evaluate(element => element.paused)) await player.getByRole('button', { name: 'Play video', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.ms-player-dialog video')?.currentTime > 1);
  await player.getByRole('button', { name: 'Pause video', exact: true }).click();
  record('Native playback advances and pauses', await video.evaluate(element => element.currentTime > 1 && element.paused));
  await player.getByLabel('Playback speed', { exact: true }).selectOption('1.5');
  record('Playback speed reaches the media element', await video.evaluate(element => element.playbackRate === 1.5));
  // Exercise a real transport control; no fabricated timeupdate or seeded history.
  await player.getByRole('button', { name: 'Forward 10 seconds', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.ms-player-dialog video')?.currentTime >= 11);
  const resumeTime = await video.evaluate(element => element.currentTime);
  record('Captions are attached to the film', await video.locator('track[kind="captions"], track[kind="subtitles"]').count() > 0);
  await screenshot('player-desktop');
  await page.keyboard.press('Escape'); await player.waitFor({ state: 'detached' });
  record('Escape closes the film', await page.locator('.ms-player-dialog').count() === 0);
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'My World', exact: true }).click();
  await ready('/my-world'); await page.getByRole('tab', { name: /^Continue watching/ }).waitFor();
  record('Returning My World prioritizes unfinished viewing', await page.getByRole('tab', { name: /^Continue watching/ }).getAttribute('aria-selected') === 'true');
  await page.getByRole('tab', { name: /^Saved/ }).click(); await page.reload(); await ready('/my-world');
  await page.getByRole('tab', { name: /^Saved/ }).click();
  record('Saved film persists after reload', await page.locator('#collection-panel').getByRole('link', { name: 'Details: Miami, in Frequency', exact: true }).isVisible());
  await page.getByRole('tab', { name: /^Saved/ }).focus(); await page.keyboard.press('Home');
  record('Collection tabs support keyboard navigation', await page.getByRole('tab', { name: /^Continue watching/ }).getAttribute('aria-selected') === 'true' && await focused(page.getByRole('tab', { name: /^Continue watching/ })));
  await page.locator('#collection-panel').getByRole('button', { name: 'Play Miami, in Frequency', exact: true }).click();
  await page.waitForFunction(expected => { const film = document.querySelector('.ms-player-dialog video'); return film?.readyState >= 2 && film.currentTime >= expected - 1; }, resumeTime);
  record('Continue watching restores actual playback position', await player.locator('.ms-player-resume').isVisible(), `${resumeTime.toFixed(1)} sec saved`);
  await player.getByRole('button', { name: 'Close player', exact: true }).click();

  phase = 'Journey generation, editing and persistence';
  await visit('/journey'); await page.getByLabel('Journey duration', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Find my journey', exact: true }).click();
  const stops = page.locator('.journey-stops .journey-stop'); await stops.first().waitFor();
  record('Journey generates multiple playable stops', await stops.count() >= 2);
  const firstTitle = await stops.first().locator('.journey-stop-info a').innerText();
  await stops.first().getByRole('button', { name: `Move ${firstTitle} down`, exact: true }).click();
  record('Journey reorder changes the actual itinerary', await stops.nth(1).locator('.journey-stop-info a').innerText() === firstTitle);
  const orderedTitles = await stops.locator('.journey-stop-info a').allTextContents();
  const journeyName = 'Browser check — connected stories';
  await page.getByRole('textbox', { name: 'Journey name', exact: true }).fill(journeyName);
  await page.getByRole('button', { name: 'Save journey', exact: true }).click();
  await page.getByRole('button', { name: 'Saved to My World', exact: true }).waitFor();
  record('Saved journey acknowledges completion', await page.getByRole('button', { name: 'Saved to My World', exact: true }).isDisabled());
  await visit('/my-world'); await page.locator('.saved-journeys').getByRole('heading', { name: journeyName, exact: true }).waitFor();
  await page.locator('.saved-journeys').getByRole('link', { name: 'Edit', exact: true }).click(); await stops.first().waitFor();
  record('Saved journey reopens with its chosen name and order', await page.getByRole('textbox', { name: 'Journey name', exact: true }).inputValue() === journeyName && JSON.stringify(await stops.locator('.journey-stop-info a').allTextContents()) === JSON.stringify(orderedTitles));
  await page.locator('.journey-manifest-heading').scrollIntoViewIfNeeded();
  await screenshot('journey-desktop');

  phase = 'Preferences';
  await visit('/settings'); const soundSwitch = page.getByRole('switch', { name: 'Interface sound', exact: true });
  await soundSwitch.click();
  record('Sound opt-in updates the header and studio', await soundSwitch.getAttribute('aria-checked') === 'true' && await page.getByRole('button', { name: 'Turn sound off', exact: true }).isVisible());
  await soundSwitch.click(); await page.getByRole('switch', { name: 'Reduce motion', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.motion === 'reduced');
  await page.reload(); await ready('/settings');
  record('Reduced-motion preference persists', await page.locator('html').getAttribute('data-motion') === 'reduced' && await page.getByRole('switch', { name: 'Reduce motion', exact: true }).getAttribute('aria-checked') === 'true');
  record('Settings has no false active primary destination', await page.getByRole('navigation', { name: 'Primary navigation' }).locator('[aria-current]').count() === 0);

  phase = 'Desktop route matrix';
  for (const route of expectedRoutes) {
    await visit(route); record(`Route renders: ${route}`, (await page.locator('main h1').first().innerText()).trim().length > 0);
    await noOverflow(`desktop ${route}`);
  }
  for (const route of ['/film/miami-frequency', '/film/wavemakers-valid-id']) {
    await visit(route);
    record(`Film detail renders: ${route}`, await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Watch', exact: true }).getAttribute('aria-current') === 'location');
    await noOverflow(`desktop ${route}`);
  }

  phase = 'Mobile navigation and catalogue';
  await page.setViewportSize({ width: 390, height: 844 }); await visit('/search'); await waitCatalogue();
  record('Mobile header keeps its compact controls', await page.getByRole('link', { name: 'Search stories and places' }).isVisible() && await openIndex.isVisible());
  record('Desktop navigation does not crowd mobile', !(await page.getByRole('navigation', { name: 'Primary navigation' }).isVisible()));
  await openIndex.click(); await index.waitFor(); await screenshot('index-mobile');
  await index.getByRole('link', { name: 'Gaming', exact: true }).click(); await ready('/category/gaming'); await index.waitFor({ state: 'hidden' });
  record('Mobile Index follows a category and closes', await page.getByRole('heading', { name: 'Gaming', exact: true }).isVisible());
  await visit('/search'); await waitCatalogue(); await page.getByRole('button', { name: /^Filters / }).click();
  const filterDialog = page.getByRole('dialog', { name: 'Refine your stories' }); await filterDialog.waitFor();
  await filterDialog.getByLabel('Destination', { exact: true }).selectOption('miami');
  await filterDialog.getByLabel('Availability', { exact: true }).selectOption('available');
  await filterDialog.getByRole('button', { name: /^Show \d+ stor/ }).click(); await filterDialog.waitFor({ state: 'hidden' }); await waitCatalogue();
  record('Mobile filter sheet applies selected filters', await page.getByRole('button', { name: 'Remove place filter', exact: true }).isVisible() && await page.getByRole('button', { name: 'Remove availability filter', exact: true }).isVisible() && await cards.count() > 0);
  record('Filter sheet restores trigger focus', await focused(page.getByRole('button', { name: /^Filters / })));
  await screenshot('catalogue-mobile');
  for (const route of ['/', '/world', '/time-machine', '/category/movies', '/category/music', '/my-world', '/journey', '/motion', '/live', '/premium', '/settings', '/film/miami-frequency']) {
    await visit(route); await noOverflow(`mobile ${route}`);
  }
  await visit('/my-world'); await page.getByRole('tab', { name: /^Saved/ }).click(); await screenshot('my-world-mobile');

  phase = 'System reduced motion';
  const calmContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    const calmPage = await calmContext.newPage();
    calmPage.on('pageerror', error => runtimeErrors.push({ phase: 'System reduced motion', message: error.message }));
    await calmPage.goto(url('/settings'), { waitUntil: 'domcontentloaded' });
    await calmPage.waitForFunction(() => document.documentElement.dataset.motion === 'reduced');
    record('Fresh visitor inherits OS reduced motion', await calmPage.getByRole('switch', { name: 'Reduce motion', exact: true }).getAttribute('aria-checked') === 'true');
    await calmPage.getByRole('switch', { name: 'Reduce motion', exact: true }).click();
    record('OS reduced motion still applies when the site toggle is off', await calmPage.locator('html').getAttribute('data-motion') === 'reduced' && await calmPage.getByRole('switch', { name: 'Reduce motion', exact: true }).getAttribute('aria-checked') === 'false');
  } finally { await calmContext.close(); }
  record('No uncaught application exceptions during these flows', runtimeErrors.length === 0, JSON.stringify(runtimeErrors));
} catch (error) {
  results.push({ name: phase, passed: false, detail: error.stack || String(error) });
  await screenshot('failure').catch(() => {}); console.error(`FAIL ${phase}\n${error.stack || error}`); process.exitCode = 1;
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, checkedAt: new Date().toISOString(), results, runtimeErrors, screenshots }, null, 2));
  await browser.close();
  console.log(`${results.filter(result => result.passed).length} checks passed; ${results.filter(result => !result.passed).length} failed. Evidence: ${output}/results.json`);
}
