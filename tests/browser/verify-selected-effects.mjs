import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const base=process.env.SITE_URL||'http://127.0.0.1:5184/';
const out=process.env.SELECTED_OUTPUT||'output/playwright/selected-effects';
await mkdir(out,{recursive:true});
const checks=[],errors=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
function check(name,value,detail=''){assert.ok(value,name+': '+detail);checks.push({name,passed:true,detail});console.log('PASS '+name);}
const url=path=>{const u=new URL(base);u.hash=path;return u.href;};
async function ready(page){await page.locator('.tunnel-journey[data-ready="true"]').waitFor();await page.waitForFunction(()=>!document.documentElement.dataset.spatialPassage);await page.evaluate(()=>document.fonts.ready);}
async function run(name,options,work){const context=await browser.newContext({viewport:{width:1440,height:900},...options});const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/WebGLProgram|shader error|VALIDATE_STATUS/i.test(m.text()))errors.push(m.text());});try{await page.goto(url('/'));await ready(page);await work(page);}catch(e){checks.push({name,passed:false,detail:e.stack});await page.screenshot({path:`${out}/failure-${name}.png`}).catch(()=>{});console.error(e.message);}finally{await context.close();}}
try{
await run('desktop-mechanisms',{},async page=>{
  await page.waitForTimeout(900);await page.screenshot({path:`${out}/opening.png`});
  check('Depth text preserves the exact accessible headline', await page.locator('.tunnel-hero h1').getAttribute('aria-label')==='CULTURE. WITHOUT BORDERS.');
  check('Letters settle to crisp stationary type',await page.locator('.tunnel-hero .depth-letter').first().evaluate(el=>getComputedStyle(el).transform==='matrix(1, 0, 0, 1, 0, 0)'||getComputedStyle(el).transform==='none'));
  const button=page.getByRole('button',{name:'Open Index',exact:true});
  const before=await button.boundingBox();await page.mouse.move(before.x+before.width/2,before.y+before.height/2);await page.mouse.down();await page.waitForTimeout(140);
  const held=await button.boundingBox();check('Mechanical press keeps its click target fixed',Math.abs(held.y-before.y)<.5&&Math.abs(held.x-before.x)<.5);
  await page.mouse.up();await page.locator('#monumental-index:modal').waitFor();await page.keyboard.press('Escape');
  check('Relay exposes no manual settings',await page.locator('.tunnel-relay-control,#tunnel-relay-parts').count()===0);
  await page.waitForFunction(()=>document.querySelector('[data-passage-relay-part]')?.dataset.passageRelayPart!=='');
  check('Automatic relay reveals a component',await page.locator('[data-passage-relay-open]').getAttribute('data-passage-relay-open')==='true');
  await page.waitForTimeout(300);await page.screenshot({path:out+'/component-extracted.png'});
  await page.waitForFunction(()=>document.querySelector('[data-passage-relay-open]')?.dataset.passageRelayOpen==='false');
  check('Automatic reassembly clears component selection',await page.locator('[data-passage-relay-part]').getAttribute('data-passage-relay-part')==='');
  await page.mouse.move(1220,660);await page.waitForTimeout(300);
  check('Structural lens responds over the actual tunnel',await page.locator('[data-passage-cutaway]').getAttribute('data-passage-cutaway')==='true');
  await page.screenshot({path:`${out}/structural-lens.png`});
  await page.mouse.move(140,590);await page.waitForTimeout(500);
  check('Structural lens yields to interface controls',await page.locator('[data-passage-cutaway]').getAttribute('data-passage-cutaway')==='false');
  await page.getByRole('button',{name:'Travel to The World',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-passage-reading]')?.dataset.passageReading==='true');
  const mediaBefore=await page.evaluate(()=>window.__nothing??document.querySelector('[data-passage-chapter]')?.dataset.passageChapter);
  check('Direct station navigation remains readable',mediaBefore==='world');
  await page.getByRole('link',{name:'Explore the world',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.spatial-passage')?.getAttribute('data-carried-identity')==='place:miami');
  await page.waitForTimeout(180);await page.screenshot({path:`${out}/forward-portal.png`});
  check('The same destination stays visible through the portal',await page.locator('.spatial-passage strong').textContent()==='Miami');
  await page.waitForFunction(()=>location.hash.startsWith('#/world')&&!document.documentElement.dataset.spatialPassage);
  check('Portal commits the carried destination',new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('place')==='miami');
  await page.getByRole('button',{name:'Go to London',exact:true}).click();
  await page.waitForFunction(()=>location.hash.includes('place=london'));
  await page.getByRole('link',{name:'Watch',exact:true}).first().click();
  await page.waitForFunction(()=>location.hash.startsWith('#/search')&&!document.documentElement.dataset.spatialPassage);
  await page.getByRole('link',{name:'World',exact:true}).first().click();
  await page.waitForFunction(()=>location.hash.startsWith('#/world')&&!document.documentElement.dataset.spatialPassage);
  check('World returns to the visitor selected destination',page.url().includes('place=london'));
});
await run('compact',{viewport:{width:390,height:844}},async page=>{
  check('Compact keeps the same readable chapters',await page.locator('.tunnel-journey[data-compact="true"]').count()===1&&await page.locator('.tunnel-panel').count()===6);
  check('No narrow-screen horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  check('Desktop relay controls are omitted on phone',await page.getByRole('button',{name:'Unfold the relay',exact:true}).count()===0);
  await page.screenshot({path:`${out}/mobile.png`});
  await page.getByLabel('Choose Passage station').selectOption('4');await page.waitForTimeout(900);
  check('Touch station selection reaches Culture',await page.locator('.tunnel-panel[data-environment="atelier"] h2').isVisible());
  await page.screenshot({path:`${out}/mobile-culture.png`});
});
await run('reduced',{reducedMotion:'reduce'},async page=>{
  check('Reduced motion uses stable type',await page.locator('.depth-letter').first().evaluate(el=>getComputedStyle(el).animationName==='none'));
  check('Reduced motion omits the animated mechanisms',await page.locator('[data-passage-life]').getAttribute('data-passage-life')==='off');
  await page.screenshot({path:`${out}/reduced.png`});
});
}finally{await browser.close();await writeFile(`${out}/verification.json`,JSON.stringify({checks,errors},null,2));}
if(checks.some(c=>!c.passed)||errors.length)process.exitCode=1;
