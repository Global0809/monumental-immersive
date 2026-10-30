import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'http://127.0.0.1:5184/';
const output = process.env.LIFE_OUTPUT || 'output/playwright/living-tunnel-review';
const mode = process.env.LIFE_MODE || 'all';
const checks = [], errors = [], measurements = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const address = route => { const url = new URL(base); url.hash = route; return url.href; };
function check(name, value, detail = '') {
  assert.ok(value, `${name}: ${detail}`); checks.push({ name, passed: true, detail }); console.log(`PASS ${name}`);
}
async function scenario(name, options, run) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', ...options });
  await context.addInitScript(() => { window.__lifeSoundPulses = []; window.addEventListener('monumental:sonic-pulse', event => window.__lifeSoundPulses.push(event.detail)); });
  const page = await context.newPage(); page.setDefaultTimeout(20_000);
  page.on('pageerror', error => errors.push({ scenario: name, message: error.message }));
  page.on('console', message => {
    if (/WebGLProgram|VALIDATE_STATUS|shader error|shader failed|GL_INVALID|GLSL/i.test(message.text())) errors.push({ scenario: name, message: message.text() });
  });
  try { await page.goto(address('/'), { waitUntil: 'domcontentloaded' }); await ready(page); await run(page, context); }
  catch (error) { checks.push({ name, passed: false, detail: error.stack }); console.error(`FAIL ${name}: ${error.message}`); await page.screenshot({ path: `${output}/failure-${name}.png` }).catch(() => {}); }
  finally { await context.close(); }
}
async function ready(page) {
  await page.locator('.tunnel-journey[data-ready="true"]').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert);
  await page.evaluate(() => document.fonts.ready);
}
const scene = page => page.locator('[data-passage-chapter]');
const signalCount = async page => Number(await scene(page).getAttribute('data-passage-signal'));
async function nextSignal(page) { const previous = await signalCount(page); await page.waitForFunction(previous => Number(document.querySelector('[data-passage-signal]')?.dataset.passageSignal) > previous, previous, { timeout: 4500 }); }
async function observeSignals(page, duration) {
  return page.evaluate(duration => new Promise(resolve => {
    const host = document.querySelector('[data-passage-signal]'), events = [], start = performance.now(); let previous = Number(host.dataset.passageSignal);
    const initial = previous, observer = new MutationObserver(() => { const value = Number(host.dataset.passageSignal); if (value !== previous) { events.push({ at: performance.now() - start, count: value }); previous = value; } });
    observer.observe(host, { attributes: true, attributeFilter: ['data-passage-signal'] });
    setTimeout(() => { observer.disconnect(); resolve({ initial, final: previous, events, duration }); }, duration);
  }), duration);
}
async function station(page, title, id) {
  await page.getByRole('button', { name: `Travel to ${title}`, exact: true }).click();
  await page.waitForFunction(id => document.querySelector('[data-passage-chapter]')?.dataset.passageChapter === id && document.querySelector('[data-passage-reading]')?.dataset.passageReading === 'true', id);
  await page.waitForTimeout(300);
}
async function sampleFrames(page, label) {
  const observation = await page.evaluate(() => new Promise(resolve => {
    const host = document.querySelector('[data-passage-draw-calls]'), samples = [], start = performance.now();
    let last = start, maximum = 0;
    const observer = new MutationObserver(() => {
      const now = performance.now(); samples.push(now - last); last = now;
      maximum = Math.max(maximum, Number(host.dataset.passageDrawCalls));
    });
    observer.observe(host, { attributes: true, attributeFilter: ['data-passage-draw-calls'] });
    setTimeout(() => { observer.disconnect(); samples.sort((a, b) => a - b); resolve({ count: samples.length, medianMs: samples[Math.floor(samples.length * .5)] || 0, p95Ms: samples[Math.floor(samples.length * .95)] || 0, maximumDrawCalls: maximum }); }, 1500);
  }));
  measurements.push({ label, ...observation }); return observation;
}

try {
  if (mode === 'relay' || mode === 'all') {
    await scenario('automatic-relay', {}, async page => {
      const controls = page.locator('.tunnel-relay-control,#tunnel-relay-parts,.tunnel-relay-reassemble');
      check('Manual relay controls are absent', await controls.count() === 0 && await page.getByRole('button', { name: /^(Unfold|Fold) the relay$|^Inspect relay component|^Reassemble$/ }).count() === 0);
      const sound=page.getByRole('button',{name:'Turn sound on',exact:true}); if(await sound.count()) await sound.click();
      await page.waitForTimeout(350); const audioBefore=await page.evaluate(()=>window.__lifeSoundPulses.length);
      const captureCycle=page.evaluate(()=>new Promise(resolve=>{
        const host=document.querySelector('[data-passage-relay-phase]'),start=performance.now(),events=[],signals=[],parts=new Set();let previous='',signal=Number(host.dataset.passageSignal);
        const observer=new MutationObserver(()=>{
          const state={open:host.dataset.passageRelayOpen,part:host.dataset.passageRelayPart,phase:Number(host.dataset.passageRelayPhase)};
          const key=state.open+'/'+state.part;if(key!==previous){events.push({...state,at:performance.now()-start});previous=key;}
          if(state.part!=='')parts.add(state.part);const next=Number(host.dataset.passageSignal);if(next!==signal){signals.push(performance.now()-start);signal=next;}
        });observer.observe(host,{attributes:true,attributeFilter:['data-passage-relay-open','data-passage-relay-part','data-passage-relay-phase','data-passage-signal']});
        setTimeout(()=>{observer.disconnect();resolve({events,parts:[...parts].sort(),signals});},17000);
      }));
      await page.waitForFunction(()=>document.querySelector('[data-passage-relay-open]')?.dataset.passageRelayOpen==='true'); await page.waitForTimeout(350); await page.screenshot({path:output+'/relay-open.png'});
      await page.waitForFunction(()=>document.querySelector('[data-passage-relay-part]')?.dataset.passageRelayPart==='2'); await page.waitForTimeout(400); await page.screenshot({path:output+'/relay-shell.png'});
      const phaseBefore=Number(await scene(page).getAttribute('data-passage-relay-phase'));
      await page.mouse.click(824,450); await page.mouse.move(824,450); await page.mouse.down(); await page.mouse.move(910,470,{steps:8}); await page.mouse.up();
      const phaseAfter=Number(await scene(page).getAttribute('data-passage-relay-phase'));
      check('Click and drag cannot reset or hijack the automated relay',phaseAfter>=phaseBefore&&phaseAfter-phaseBefore<1.5&&await controls.count()===0,{phaseBefore,phaseAfter});
      await page.waitForFunction(()=>Number(document.querySelector('[data-passage-relay-phase]')?.dataset.passageRelayPhase)>=13.6);await page.screenshot({path:output+'/relay-closed.png'});
      const cycle=await captureCycle; measurements.push({label:'Automatic relay cycle',...cycle});
      check('Relay opens and reassembles without manual input',cycle.events.some(e=>e.open==='true')&&cycle.events.some(e=>e.open==='false'));
      check('All six shells are selected automatically',cycle.parts.join(',')==='0,1,2,3,4,5',cycle.parts);
      const gaps=cycle.signals.slice(1).map((v,i)=>v-cycle.signals[i]);
      check('Three-second signal cadence continues during relay automation',gaps.length>=3&&gaps.every(gap=>gap>=2850&&gap<=3250),gaps);
      check('Automatic relay adds no sound spam with sound enabled',await page.evaluate(()=>window.__lifeSoundPulses.length)===audioBefore);
      await page.getByRole('button',{name:'Open Index',exact:true}).click();await page.locator('#monumental-index:modal').waitFor();await page.waitForTimeout(200);
      let before=await scene(page).getAttribute('data-passage-relay-phase');await page.waitForTimeout(650);check('Modal pauses relay phase',await scene(page).getAttribute('data-passage-relay-phase')===before);await page.keyboard.press('Escape');
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
      before=await scene(page).getAttribute('data-passage-relay-phase');await page.waitForTimeout(650);check('Hidden tab pauses relay phase',await scene(page).getAttribute('data-passage-relay-phase')===before);
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(400);
      const resumed=Number(await scene(page).getAttribute('data-passage-relay-phase'));check('Visibility resumes without skipping the choreography',resumed>=Number(before)&&resumed-Number(before)<.7,{before,resumed});
      await station(page,'The World','world');check('Chapter reading stows the opening relay',await scene(page).getAttribute('data-passage-relay-open')==='false'&&await scene(page).getAttribute('data-passage-relay-part')==='');
      await page.getByRole('button',{name:'Inspect The World exhibit',exact:true}).click();before=await scene(page).getAttribute('data-passage-relay-phase');await page.waitForTimeout(400);check('Exhibit inspection leaves relay inactive',await scene(page).getAttribute('data-passage-relay-phase')===before);await page.keyboard.press('Escape');
      check('Passage retains one renderer and six chapter interfaces',await page.locator('canvas.spatial-world-canvas').count()===1&&await page.locator('.tunnel-panel').count()===6);
    });
    for(const [name,options] of [['compact-relay',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}],['reduced-relay',{reducedMotion:'reduce'}]]){
      await scenario(name,options,async page=>{
        const before=await scene(page).getAttribute('data-passage-relay-phase');await page.waitForTimeout(800);
        check(name+' stays closed and still',await scene(page).getAttribute('data-passage-relay-phase')===before&&await scene(page).getAttribute('data-passage-relay-open')==='false'&&await scene(page).getAttribute('data-passage-relay-part')==='');
        check(name+' contains no manual relay interface',await page.locator('.tunnel-relay-control,#tunnel-relay-parts').count()===0);await page.screenshot({path:output+'/'+name+'.png'});
      });
    }
  }
  if (mode === 'signal') {
    await scenario('automatic-signal', {}, async page => {
      await page.waitForFunction(() => document.querySelector('[data-passage-life]')?.dataset.passageLife === 'active');
      check('Send a signal button is absent', await page.getByRole('button', { name: 'Send a signal', exact: true }).count() === 0);
      const sound = page.getByRole('button', { name: 'Turn sound on', exact: true }); if (await sound.count()) await sound.click();
      await page.waitForTimeout(450); const audioBefore = await page.evaluate(() => window.__lifeSoundPulses.length);
      const idle = await observeSignals(page, 6400); measurements.push({ label: 'Idle cadence', ...idle });
      check('Idle Passage emits two paced visual pulses', idle.events.length >= 2 && idle.events.length <= 3, JSON.stringify(idle));
      const gaps = idle.events.slice(1).map((event, i) => event.at - idle.events[i].at);
      check('Visual pulse cadence is three seconds', gaps.every(gap => gap >= 2850 && gap <= 3250), JSON.stringify(gaps));
      check('Automatic pulses introduce no repeated sound cues', await page.evaluate(() => window.__lifeSoundPulses.length) === audioBefore);
      await page.screenshot({ path: `${output}/automatic-opening.png` });
      await station(page, 'The World', 'world'); const chapter = await observeSignals(page, 3400);
      check('World reading position also pulses automatically', chapter.events.length >= 1 && chapter.events.length <= 2, JSON.stringify(chapter));
      await page.getByRole('button', { name: 'Inspect The World exhibit', exact: true }).click(); await page.waitForTimeout(150);
      const inspect = await observeSignals(page, 3300); check('Exhibit inspection suspends automatic pulses', inspect.events.length === 0, JSON.stringify(inspect));
      await page.keyboard.press('Escape'); const inspectionReturn = await observeSignals(page, 650); check('Closing inspection does not produce a catch-up burst', inspectionReturn.events.length === 0);
      await nextSignal(page);
      await page.locator('[data-tunnel-station="world"]').getByRole('button', { name: /^Play / }).click(); await page.locator('.ms-player-dialog:modal').waitFor();
      const player = await observeSignals(page, 3300); check('Full player suspends automatic pulses', player.events.length === 0, JSON.stringify(player));
      await page.keyboard.press('Escape'); const playerReturn = await observeSignals(page, 650); check('Closing full player does not produce a catch-up burst', playerReturn.events.length === 0);
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      const hidden = await observeSignals(page, 3300); check('Hidden tab suspends automatic pulses', hidden.events.length === 0);
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
      const visible = await observeSignals(page, 650); check('Returning visibility does not produce a catch-up burst', visible.events.length === 0);
      await page.evaluate(() => { location.hash = '#/settings'; }); await page.getByRole('heading', { name: /MAKE IT/i }).waitFor(); await page.waitForTimeout(200);
      const away = await observeSignals(page, 3300); check('Other routes suspend automatic Passage pulses', away.events.length === 0);
      await page.evaluate(() => { location.hash = '#/'; }); await ready(page); const returned = await observeSignals(page, 650); check('Returning to Passage starts a fresh interval', returned.events.length === 0);
      await nextSignal(page); check('Returning retains one scene and resumes pulses', await page.locator('canvas.spatial-world-canvas').count() === 1 && await signalCount(page) > returned.final);
      await page.screenshot({ path: `${output}/automatic-return.png` });
    });
    for (const [name, options] of [['compact', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }], ['reduced', { reducedMotion: 'reduce' }]]) {
      await scenario(name, options, async page => { const observed = await observeSignals(page, 3300); check(name + ' keeps automatic pulse off', observed.events.length === 0 && await scene(page).getAttribute('data-passage-life') === 'off'); check(name + ' exposes no signal control', await page.getByRole('button', { name: 'Send a signal', exact: true }).count() === 0); await page.screenshot({ path: `${output}/automatic-${name}.png` }); });
    }
  }
  if (mode === 'all') {
  await scenario('phone-life', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async page => {
    check('Phone omits desktop-only relay controls', await page.getByRole('button', { name: /^(Unfold|Fold) the relay$/ }).count() === 0 && await page.getByRole('button', { name: 'Send a signal', exact: true }).count() === 0);
    check('Phone suspends additional scene effects', await scene(page).getAttribute('data-passage-life') === 'off');
    check('Phone retains readable entry and no horizontal overflow', await page.getByRole('button', { name: 'ENTER THE WORLD', exact: true }).isVisible() && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${output}/05-phone.png` });
  });
  await scenario('reduced-life', { reducedMotion: 'reduce' }, async page => {
    check('Reduced motion offers usable content without effects controls', await scene(page).getAttribute('data-passage-life') === 'off' && await page.getByRole('button', { name: 'Send a signal', exact: true }).count() === 0 && await page.locator('.tunnel-panel').count() === 6);
    await page.screenshot({ path: `${output}/06-reduced.png` });
  });
  }
  check('New tunnel interactions produce no uncaught browser errors', errors.length === 0, JSON.stringify(errors));
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, checkedAt: new Date().toISOString(), checks, errors, measurements }, null, 2));
  await browser.close();
  console.log(`${checks.filter(check => check.passed).length} passed; ${checks.filter(check => !check.passed).length} failed.`);
  if (checks.some(check => !check.passed)) process.exitCode = 1;
}
