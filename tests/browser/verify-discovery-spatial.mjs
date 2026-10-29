import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const out=process.env.DISCOVERY_OUTPUT || 'output/playwright/selected-discovery-confirm';
const base=process.env.SITE_URL || 'http://127.0.0.1:5184/';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const checks=[],errors=[];
const check=(label,truth)=>{assert.ok(truth,label);checks.push(label);};
try { for(const device of ['desktop','mobile','reduced']){
 const context=await browser.newContext({viewport:device==='mobile'?{width:390,height:844}:{width:1440,height:900},isMobile:device==='mobile',hasTouch:device==='mobile',reducedMotion:device==='reduced'?'reduce':'no-preference'});
 await context.addInitScript(()=>localStorage.setItem('monumental.viewer.v1',JSON.stringify({saved:['miami-frequency','island-current','break-beat-city','sintel-full'],savedPlaces:['miami','london']})));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
 for(const [route,name,selector] of [['/world','world','.atlas-story-windows'],['/time-machine','time','.ex-era-room'],['/category/movies','cinema','.collection-theater'],['/my-world','personal','.personal-constellation']]){
  await page.goto(base.split('#')[0]+'#'+route,{waitUntil:'domcontentloaded'});await page.locator(selector).waitFor({state:'visible'});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1000);
  if(name==='world'){
   check(device+' globe has actual Miami stories',await page.locator('.atlas-story-windows article').count()===3);
   check(device+' projected story connection exists',await page.locator('.atlas-story-threads path').first().getAttribute('d'));
   await page.locator('.atlas-story-windows button').first().click();await page.locator('.ms-player-dialog[open]').waitFor();check(device+' globe story opens player',true);await page.keyboard.press('Escape');await page.locator('.ms-player-dialog[open]').waitFor({state:'detached'});
   await page.evaluate(()=>scrollTo(0,0));
  }
  if(name==='time'){
   const before=await page.locator('.ex-era-frame').nth(1).evaluate(el=>getComputedStyle(el).transform);check(device+' archive frames retain spatial transforms',before!=='none');
   await page.getByRole('button',{name:'Next era',exact:true}).click();check(device+' era selection updates',await page.locator('.ex-era-frame[data-era="1970s"]').getAttribute('aria-pressed')==='true');await page.waitForTimeout(950);
   const pose=await page.locator('.ex-era-frame.is-active').evaluate(el=>getComputedStyle(el).transform);await page.waitForTimeout(200);check(device+' reading frame stays settled',pose===await page.locator('.ex-era-frame.is-active').evaluate(el=>getComputedStyle(el).transform));await page.evaluate(()=>scrollTo(0,0));
  }
  if(name==='cinema'){
   check(device+' cinema opens as spatial gallery',await page.locator('.collection-theater--gallery').count()===1);
   await page.getByRole('button',{name:'Next featured story',exact:true}).click();await page.waitForTimeout(750);check(device+' selected poster advances',await page.locator('.ct-filmstrip button[aria-pressed=true]').count()===1);
   await page.locator('.ct-selection').scrollIntoViewIfNeeded();
  }
  if(name==='personal'){
   await page.locator('.personal-constellation__sky').scrollIntoViewIfNeeded();await page.waitForTimeout(500);
   const anchor=page.locator('.personal-constellation__anchor').first(),sat=page.locator('.personal-constellation__story').first();
   const a=await anchor.boundingBox(),b=await sat.boundingBox();check(device+' saved story is separated from its destination',Math.hypot(a.x-b.x,a.y-b.y)>35);
   await page.getByRole('button',{name:'Expand London: 0 saved stories',exact:true}).click();check(device+' empty saved destination stays honest',await page.locator('.personal-constellation__collection').innerText().then(t=>t.includes('Find stories from London')));
   await page.getByRole('button',{name:'Expand Miami: 1 saved stories',exact:true}).click();check(device+' destination opens readable saved collection',await page.locator('.personal-constellation__collection li').count()===1);
   await sat.focus();const t=await sat.getAttribute('style');await page.waitForTimeout(250);check(device+' focusing satellite pauses motion',t===await sat.getAttribute('style'));
  }
  check(device+' '+name+' has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(device!=='reduced')await page.screenshot({path:`${out}/${device}-${name}.png`});
 }
 await context.close();
}
} finally { await browser.close(); }assert.deepEqual(errors,[]);await writeFile(out+'/checks.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({count:checks.length,errors}));
