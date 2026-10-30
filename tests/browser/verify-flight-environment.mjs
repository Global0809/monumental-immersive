// Native Chrome review of the autonomous family; no separate crew viewer.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const base=process.env.SITE_URL||'http://127.0.0.1:5184/',out=process.env.FLIGHT_OUTPUT||'output/playwright/autonomous-flight/final';
const mode=process.env.FLIGHT_MODE||'all';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',args:['--mute-audio']});
const checks=[],errors=[],measurements=[];
const check=(name,pass,detail='')=>{assert.ok(pass,name+': '+JSON.stringify(detail));checks.push({name,passed:true,detail});console.log('PASS '+name);};
const wait=(p,ms=500)=>p.waitForTimeout(ms);
const address=route=>{const u=new URL(base);u.hash=route;return u.href;};
async function instrument(c){
  await c.addInitScript(()=>{
    const q=window.__flightQA={draws:0,frames:0,matrices:[]},names=new WeakMap();
    for(const T of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
      if(!T)continue;
      const get=T.prototype.getUniformLocation,matrix=T.prototype.uniformMatrix4fv,clear=T.prototype.clear;
      T.prototype.getUniformLocation=function(program,name){const v=get.call(this,program,name);if(v)names.set(v,name);return v;};
      T.prototype.uniformMatrix4fv=function(location,transpose,values,...args){if(this.canvas?.classList.contains('flight-canvas')&&names.get(location)==='modelMatrix')q.matrices.push(Array.from(values));return matrix.call(this,location,transpose,values,...args);};
      T.prototype.clear=function(...args){if(this.canvas?.classList.contains('flight-canvas')){q.frames++;q.matrices=[];}return clear.apply(this,args);};
      for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
        const native=T.prototype[method];if(!native)continue;
        T.prototype[method]=function(...args){if(this.canvas?.classList.contains('flight-canvas'))q.draws++;return native.apply(this,args);};
      }
    }
    localStorage.setItem('monumental.flight.docked','true');
  });
}
async function scenario(name,options,run){
  const c=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference',...options});await instrument(c);
  const p=await c.newPage();p.setDefaultTimeout(20000);
  p.on('pageerror',e=>errors.push({scenario:name,message:e.message}));
  p.on('console',m=>{if(/WebGLProgram|VALIDATE_STATUS|shader error|GL_INVALID/i.test(m.text()))errors.push({scenario:name,message:m.text()});});
  try{await run(p);}catch(e){checks.push({name,passed:false,detail:e.stack});await p.screenshot({path:out+'/failure-'+name+'.png'}).catch(()=>{});console.error(e.message);}finally{await c.close();}
}
async function settled(p){await p.locator('.flight-canvas').waitFor();await p.waitForFunction(()=>!document.documentElement.dataset.spatialPassage&&!document.querySelector('main')?.inert);}
async function home(p){await p.goto(address('/'));await p.locator('.tunnel-journey[data-ready="true"]').waitFor();await settled(p);await wait(p,650);}
async function state(p,wanted){await p.waitForFunction(v=>document.querySelector('.flight-environment')?.dataset.state===v,wanted);}
const snap=p=>p.evaluate(()=>({draws:window.__flightQA.draws,frames:window.__flightQA.frames,matrices:window.__flightQA.matrices,state:document.querySelector('.flight-environment')?.dataset.state,activity:document.querySelector('.flight-environment')?.dataset.activity}));
async function sample(p,label,ms=650){const before=await snap(p);await wait(p,ms);const after=await snap(p);const s={label,duration:ms,draws:after.draws-before.draws,frames:after.frames-before.frames,before,after};measurements.push(s);return s;}
async function paused(p,label){await wait(p,200);const s=await sample(p,label,500);check(label,s.draws===0,{draws:s.draws,state:s.after.state});}
async function shot(p,name){await p.screenshot({path:out+'/'+name+'.png'});}
async function route(p,path,selector){await p.evaluate(path=>{location.hash='#'+path;},path);await p.locator(selector).first().waitFor();await settled(p);await wait(p,550);}
try{
  await scenario('desktop',{},async p=>{
    await home(p);await state(p,'active');
    check('Crew button and dialog are absent',await p.getByRole('button',{name:/^Flight crew/}).count()===0&&await p.locator('.flight-dialog,.flight-invitation').count()===0);
    check('One autonomous renderer retains four models',await p.locator('.flight-canvas').count()===1&&await p.locator('.flight-environment').getAttribute('data-drone-count')==='4');
    check('Old docked preference cannot freeze flight',await p.evaluate(()=>localStorage.getItem('monumental.flight.docked'))==='true'&&(await sample(p,'old docked preference')).draws>0);
    check('Flight canvas never intercepts interactions',await p.locator('.flight-canvas').evaluate(c=>getComputedStyle(c).pointerEvents==='none'));
    await p.evaluate(()=>{window.__originalFlightCanvas=document.querySelector('.flight-canvas');});
    if(mode!=='remaining'){
    await shot(p,'opening-a');const idle=await sample(p,'idle visible motion',6000);await shot(p,'opening-b');
    check('Idle motion updates native model matrices',idle.draws>0&&idle.before.matrices.length>0&&idle.after.matrices.length>0&&JSON.stringify(idle.before.matrices)!==JSON.stringify(idle.after.matrices),{frames:idle.frames,matrices:idle.after.matrices.length});
    await p.mouse.move(1250,445,{steps:12});const pointer=await sample(p,'cursor near family',1100);await shot(p,'opening-pointer');
    check('Cursor interaction keeps moving transforms finite',pointer.draws>0&&pointer.after.matrices.every(m=>m.every(Number.isFinite)));
    }
    check('Hero typography retains its flight exclusion',await p.locator('.flight-canvas').evaluate(c=>{const r=document.querySelector('.tunnel-hero h1').getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return [...c.style.clipPath.matchAll(/M\s*([\d.]+)[\s,]+([\d.]+)\s*H\s*([\d.]+)\s*V\s*([\d.]+)\s*H\s*[\d.]+\s*Z/g)].slice(1).some(m=>x>=+m[1]&&x<=+m[3]&&y>=+m[2]&&y<=+m[4]);}));
    await p.getByRole('button',{name:'Travel to The World',exact:true}).click();await p.waitForFunction(()=>document.querySelector('[data-passage-reading="true"]')?.dataset.passageChapter==='world');await wait(p,800);
    await shot(p,'world-a');await wait(p,2000);await shot(p,'world-b');
    check('Chapter footage remains protected',await p.locator('.flight-media-mask').getAttribute('data-protected')==='true'&&await p.locator('[data-tunnel-station="world"]').getAttribute('aria-hidden')==='false');
    await p.getByRole('button',{name:'Open Index',exact:true}).click();await p.locator('#monumental-index:modal').waitFor();await state(p,'paused');await paused(p,'Index pauses flight');
    check('Modal hides the family',await p.locator('.flight-environment').evaluate(e=>getComputedStyle(e).visibility==='hidden'));
    await p.keyboard.press('Escape');await state(p,'active');check('Closing Index resumes same family',(await sample(p,'modal resume',350)).draws>0);
    await p.locator('[data-tunnel-station="world"]').getByRole('button',{name:/^Play /}).click();await p.locator('.ms-player-dialog:modal').waitFor();await state(p,'paused');await paused(p,'Player pauses flight');await p.keyboard.press('Escape');await state(p,'active');
    await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await state(p,'paused');await paused(p,'Hidden tab suspends flight');
    await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await state(p,'active');
    check('Visibility resumes one canvas',(await sample(p,'visibility resume',400)).draws>0&&await p.locator('.flight-canvas').count()===1);
    await route(p,'/world','.cultural-atlas__viewport canvas');await state(p,'active');await shot(p,'world-route');
    check('Routes preserve the original renderer',await p.evaluate(()=>document.querySelector('.flight-canvas')===window.__originalFlightCanvas));
    const before=await p.evaluate(()=>scrollY);await p.mouse.move(1390,800);await p.mouse.wheel(0,500);await wait(p,500);check('Flight preserves native scrolling',await p.evaluate(y=>scrollY>y+100,before));
    await route(p,'/settings','.sound-studio');await p.getByRole('switch',{name:'Reduce motion',exact:true}).click();await state(p,'reduced');await paused(p,'Site reduced motion stops flight');
    await p.getByRole('switch',{name:'Reduce motion',exact:true}).click();await state(p,'active');await route(p,'/','.tunnel-journey[data-ready="true"]');
    check('Re-entry retains four models and no crew control',await p.locator('.flight-canvas').count()===1&&await p.locator('.flight-environment').getAttribute('data-drone-count')==='4'&&await p.locator('.flight-invitation,.flight-dialog').count()===0);
  });
  if(mode!=='remaining'){
  await scenario('compact',{viewport:{width:390,height:844},isMobile:true,hasTouch:true},async p=>{
    await home(p);await paused(p,'Compact Passage avoids continuous family drawing');await shot(p,'compact-home');
    check('Compact content fits without a crew overlay',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)&&await p.locator('.flight-dialog,.flight-invitation').count()===0);
    await route(p,'/world','.cultural-atlas__viewport canvas');await state(p,'active');check('Compact editorial routes retain lightweight flight',(await sample(p,'compact World')).draws>0);await shot(p,'compact-world');
  });
  await scenario('reduced',{reducedMotion:'reduce'},async p=>{await home(p);await state(p,'reduced');await paused(p,'OS reduced motion keeps the family still');check('Reduced mode preserves six chapters',await p.locator('.tunnel-panel').count()===6);await shot(p,'reduced-home');});
  }
  check('No runtime or WebGL errors',errors.length===0,errors);
}finally{
  await writeFile(out+'/results.json',JSON.stringify({base,checkedAt:new Date().toISOString(),checks,errors,measurements,notes:['Native Chrome with phone emulation, not physical-device certification.','Hidden state injected through document.hidden and real visibility handler.','Native matrix changes establish motion; captures judge visual quality.']},null,2));
  await browser.close();console.log(checks.filter(c=>c.passed).length+' passed; '+checks.filter(c=>!c.passed).length+' failed.');if(checks.some(c=>!c.passed)||errors.length)process.exitCode=1;
}
