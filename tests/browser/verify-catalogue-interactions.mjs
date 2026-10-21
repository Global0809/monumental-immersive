import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
const out = '.openai/catalogue-qa';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
const input = page.getByRole('textbox', { name: 'Search catalogue' });
const params = () => page.evaluate(() => Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || '')));
const cards = () => page.locator('.browse-page .film-title').evaluateAll(links => links.map(link => ({ title: link.textContent, href: link.getAttribute('href') })));
const navigate = async query => { await page.goto(base + '/#/search' + (query ? '?' + query : '')); await input.waitFor(); };
const settle = () => page.waitForFunction(() => !document.querySelector('.results-line [role="status"]')?.textContent.includes('Finding'));
const check = async (name, run) => { try { await run(); checks.push({ name, passed: true }); } catch (error) { checks.push({ name, passed: false, error: error.message }); } };

try {
  await check('Debounced search retains focus and announces final results', async () => {
    await navigate(''); await input.fill('Miami'); await page.waitForURL(/q=Miami/); await settle();
    assert.equal(await input.evaluate(el => document.activeElement === el), true);
    assert.ok((await cards()).length > 0);
    assert.ok(!(await page.locator('.results-line [role="status"]').innerText()).includes('Finding'));
  });
  await check('Keyboard typing continues across debounce commits without dropping characters', async () => {
    await navigate(''); await input.focus(); await input.pressSequentially('Mi', { delay: 90 });
    await page.waitForURL(/q=Mi/); await input.pressSequentially('ami', { delay: 90 });
    await page.waitForURL(/q=Miami/); assert.equal(await input.inputValue(), 'Miami');
    assert.equal(await input.evaluate(el => document.activeElement === el), true);
  });
  await check('Whitespace-only draft settles without a permanent pending state', async () => {
    await navigate(''); await input.fill('   '); await page.waitForTimeout(650);
    assert.ok(!(await page.locator('.results-line [role="status"]').innerText()).includes('Finding'));
    assert.equal((await params()).q, undefined);
  });
  await check('Reset cancels a pending search and retains display preferences', async () => {
    await navigate('place=miami&sort=longest&view=list'); await input.fill('culture');
    await page.getByRole('button', { name: 'Reset filters' }).click(); await page.waitForTimeout(650);
    assert.equal(await input.inputValue(), '');
    assert.deepEqual(await params(), { sort: 'longest', view: 'list' });
  });
  await check('Changing a filter during debounce preserves the typed query', async () => {
    await navigate(''); await input.fill('Miami');
    await page.getByRole('combobox', { name: 'Access', exact: true }).selectOption('free');
    await page.waitForURL(/q=Miami/); await settle();
    assert.equal((await params()).access, 'free'); assert.equal(await input.inputValue(), 'Miami');
  });
  await check('Composed text input does not run a partial search', async () => {
    await navigate(''); await input.dispatchEvent('compositionstart'); await input.fill('Tokyo');
    await page.waitForTimeout(400); assert.equal((await params()).q, undefined);
    await input.dispatchEvent('compositionend'); await page.waitForURL(/q=Tokyo/); await settle();
  });
  await check('Independent filters intersect correctly and chips remove one filter', async () => {
    const filters = ['place=miami', 'period=now', 'duration=short', 'access=free'];
    const sets = [];
    for (const filter of filters) { await navigate(filter); sets.push(new Set((await cards()).map(card => card.href))); }
    const intersection = [...sets[0]].filter(id => sets.every(set => set.has(id))).sort();
    await navigate(filters.join('&'));
    assert.deepEqual((await cards()).map(card => card.href).sort(), intersection);
    assert.ok(intersection.length > 0, 'Exercise a nonempty intersection');
    await page.getByRole('button', { name: 'Remove era filter' }).click();
    await page.waitForFunction(() => !location.hash.includes('period='));
    assert.deepEqual(await params(), { place: 'miami', duration: 'short', access: 'free' });
  });
  await check('Duration sorting works in both directions and title sorting is alphabetical', async () => {
    const runtimes = () => page.locator('.browse-page .film-meta>span:last-child').evaluateAll(spans => spans.map(span => {
      const match = span.textContent.match(/^(\d+)\s*(sec|min)/i);
      return match ? Number(match[1]) * (match[2].toLowerCase() === 'min' ? 60 : 1) + (span.textContent.includes('+') ? 30 : 0) : null;
    }));
    await navigate('access=free&sort=shortest'); const shortest = await runtimes();
    const ascending = shortest.filter(value => value !== null); assert.deepEqual(ascending, [...ascending].sort((a,b) => a-b));
    assert.equal(shortest.slice(ascending.length).every(value => value === null), true);
    await page.getByRole('combobox', { name: 'Sort catalogue' }).selectOption('longest');
    await page.waitForURL(/sort=longest/); const longest = await runtimes();
    const descending = longest.filter(value => value !== null); assert.deepEqual(descending, [...descending].sort((a,b) => b-a));
    assert.equal(longest.slice(descending.length).every(value => value === null), true);
    await page.getByRole('combobox', { name: 'Sort catalogue' }).selectOption('title'); await page.waitForURL(/sort=title/);
    const titles = (await cards()).map(card => card.title); assert.deepEqual(titles, [...titles].sort((a,b) => a.localeCompare(b)));
  });
  await check('Back cancels unfinished typing even when both URL queries were empty', async () => {
    await navigate('place=miami');
    await page.getByRole('combobox', { name: 'Access', exact: true }).selectOption('free');
    await page.waitForURL(/access=free/); await input.fill('unfinished'); await page.goBack();
    await page.waitForTimeout(650);
    assert.deepEqual(await params(), { place: 'miami' }); assert.equal(await input.inputValue(), '');
  });
  await check('Category search preserves its category route and result scope', async () => {
    await page.goto(base + '/#/category/music'); await input.waitFor(); await input.fill('Miami');
    await page.waitForURL(/#\/category\/music\?q=Miami/); await settle();
    const categories = await page.locator('.browse-page .film-meta>span:first-child').allTextContents();
    assert.ok(categories.length > 0); assert.ok(categories.every(category => category === 'Music'));
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await page.waitForURL(/#\/category\/music$/); assert.equal(await input.inputValue(), '');
    assert.equal(await input.evaluate(el => document.activeElement === el), true);
  });
  await check('Grid/list, URL reload, browser Back and keyboard submit preserve state', async () => {
    await navigate('place=miami&sort=title'); await page.getByRole('button', { name: 'List view', exact: true }).click();
    await page.waitForURL(/view=list/); await page.reload(); await input.waitFor();
    assert.equal(await page.getByRole('button', { name: 'List view', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('combobox', { name: 'Destination', exact: true }).inputValue(), 'miami');
    await input.fill('  design  '); await input.press('Enter'); await page.waitForURL(/q=design/); await settle();
    assert.equal(await input.inputValue(), 'design');
    await page.goBack(); await page.waitForFunction(() => !location.hash.includes('q=')); await settle();
    assert.equal(await input.inputValue(), '');
    await page.getByRole('button', { name: 'Grid view', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => !location.hash.includes('view='));
    assert.equal(await page.getByRole('button', { name: 'Grid view', exact: true }).getAttribute('aria-pressed'), 'true');
  });
  await check('320px filters, chips, search and list cards stay within the viewport', async () => {
    await page.setViewportSize({ width: 320, height: 844 });
    await navigate('q=miami&place=miami&access=free&view=list');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await input.focus();
    const focus = await input.evaluate(el => ({ style: getComputedStyle(el).outlineStyle, within: getComputedStyle(el.closest('form')).borderBottomColor }));
    assert.equal(focus.within, 'rgb(255, 77, 50)');
    await page.screenshot({ path: out + '/mobile-320-controls.png' });
    await page.locator('.film-grid').scrollIntoViewIfNeeded(); await page.screenshot({ path: out + '/mobile-320-list.png' });
    assert.ok((await cards()).length > 0);
    const touchTargets = await page.locator('.film-grid.list-view .film-play, .film-grid.list-view .save-small, .catalogue-tools button, .active-filters button').evaluateAll(elements => elements.map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
    assert.ok(touchTargets.every(target => target.width >= 40 && target.height >= 40));
    checks.push({ name: 'Search focus style evidence', passed: true, focus });
  });
  await page.setViewportSize({ width: 1440, height: 1000 }); await navigate('place=miami&view=list'); await page.evaluate(() => scrollTo(0,0));
  await page.screenshot({ path: out + '/desktop-list.png' });
  assert.deepEqual(errors, []);
  const report = { passed: checks.every(check => check.passed), checks, errors };
  await writeFile(out + '/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
} finally { await browser.close(); }
