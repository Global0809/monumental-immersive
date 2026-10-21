import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = (process.env.SITE_URL || 'http://127.0.0.1:5175/').replace(/\/?$/, '/');
const minutes = Math.max(1, Number(process.env.SOAK_MINUTES || 30));
const out = process.env.SOAK_OUTPUT || 'test-results/endurance';
await mkdir(out, { recursive: true });
// This switch mutes only this isolated browser's output; synthesis and analyser output remain real.
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true, args: ['--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  const audit = window.__endurance = { webgl: [], media: [], audio: [], analysers: [], rafCount: 0, maxRafWork: 0, maxFrameGap: 0, lastFrame: 0, longTasks: [], pulses: 0 };
  const nativeCreateElement = Document.prototype.createElement;
  Document.prototype.createElement = function(...args) {
    const element = nativeCreateElement.apply(this, args);
    if (element instanceof HTMLMediaElement) audit.media.push(new WeakRef(element));
    return element;
  };
  const nativeGetContext = HTMLCanvasElement.prototype.getContext;
  const seen = new WeakMap();
  HTMLCanvasElement.prototype.getContext = function(...args) {
    const result = nativeGetContext.apply(this,args);
    if(result && /^webgl|experimental-webgl/.test(String(args[0])) && !seen.has(result)) {
      const entry = { canvas:new WeakRef(this), context:new WeakRef(result), created:performance.now(), frames:0, draws:0, lost:0, restored:0, lostWhileConnected:0 };
      seen.set(result,entry);audit.webgl.push(entry);
      this.addEventListener('webglcontextlost',()=>{entry.lost++;if(entry.canvas.deref()?.isConnected)entry.lostWhileConnected++;});
      this.addEventListener('webglcontextrestored',()=>entry.restored++);
    }
    return result;
  };
  for(const Constructor of [window.WebGLRenderingContext,window.WebGL2RenderingContext]) {
    if(!Constructor) continue;
    for(const method of ['clear','drawElements','drawArrays']) {
      const native = Constructor.prototype[method];
      Constructor.prototype[method] = function(...args) {const entry=seen.get(this);if(entry){if(method==='clear')entry.frames++;else entry.draws++;}return native.apply(this,args);};
    }
  }
  const NativeAudio=window.AudioContext;
  if(NativeAudio)window.AudioContext=class extends NativeAudio {
    constructor(...args){super(...args);audit.audio.push(new WeakRef(this));}
    createAnalyser(){const analyser=super.createAnalyser();audit.analysers.push(new WeakRef(analyser));return analyser;}
  };
  const nativeRaf=window.requestAnimationFrame;
  window.requestAnimationFrame=callback=>nativeRaf(time=>{
    const gap=time-audit.lastFrame;
    if(!document.hidden&&gap>0&&gap<500)audit.maxFrameGap=Math.max(audit.maxFrameGap,gap);
    audit.lastFrame=time;audit.rafCount++;
    const start=performance.now();try{return callback(time);}finally{audit.maxRafWork=Math.max(audit.maxRafWork,performance.now()-start);}
  });
  window.addEventListener('monumental:sonic-pulse',()=>audit.pulses++);
  try{new PerformanceObserver(list=>{for(const entry of list.getEntries()){if(audit.longTasks.length<2000)audit.longTasks.push({start:entry.startTime,duration:entry.duration});}}).observe({type:'longtask',buffered:true});}catch{}
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Performance.enable'); await cdp.send('HeapProfiler.enable');
page.setDefaultTimeout(15000);
const errors=[], failures=[], limitations=[], samples=[], actions=[];
page.on('pageerror',error=>errors.push({at:new Date().toISOString(),message:error.message}));
page.on('crash',()=>failures.push({at:new Date().toISOString(),message:'Renderer page crashed'}));
const started=Date.now(),deadline=started+minutes*60000;
let iteration=0, previousSnapshot, buildAssets=[];
const log=(name,detail={})=>{const entry={at:new Date().toISOString(),elapsedSeconds:Math.round((Date.now()-started)/1000),name,...detail};actions.push(entry);console.log(JSON.stringify(entry));};
const sleep=ms=>page.waitForTimeout(Math.min(ms,Math.max(0,deadline-Date.now())));
class BrowserStall extends Error {}
async function bounded(action,label,timeout=45000){
  let timer;
  try{return await Promise.race([action(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new BrowserStall(`Browser command stalled: ${label} after ${timeout}ms`)),timeout);})]);}
  finally{clearTimeout(timer);}
}
async function snapshot(label) {
  await cdp.send('HeapProfiler.collectGarbage');
  const [heap,dom,metrics,client] = await Promise.all([
    cdp.send('Runtime.getHeapUsage'),cdp.send('Memory.getDOMCounters'),cdp.send('Performance.getMetrics'),
    page.evaluate(()=>{
      const a=window.__endurance;
      const gl=a.webgl.map(entry=>{const canvas=entry.canvas.deref(),gl=entry.context.deref();return {alive:!!gl,connected:!!canvas?.isConnected,lost:entry.lost,restored:entry.restored,lostWhileConnected:entry.lostWhileConnected,contextLost:gl?.isContextLost(),frames:entry.frames,draws:entry.draws};});
      const audio=a.audio.map(ref=>ref.deref()?.state||'collected');
      const media=a.media.map(ref=>{const element=ref.deref();return element?{alive:true,connected:element.isConnected,paused:element.paused,time:element.currentTime,duration:Number.isFinite(element.duration)?element.duration:null,hasSourceAttribute:element.hasAttribute('src'),readyState:element.readyState,networkState:element.networkState}: {alive:false};});
      let peak=0,rms=0;
      for(const ref of a.analysers){const analyser=ref.deref();if(!analyser)continue;const buffer=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(buffer);let energy=0;for(const value of buffer){peak=Math.max(peak,Math.abs(value));energy+=value*value;}rms=Math.max(rms,Math.sqrt(energy/buffer.length));}
      return {route:location.hash,visibility:document.visibilityState,canvases:document.querySelectorAll('canvas').length,gl,media,audio,peak,rms,rafCount:a.rafCount,maxRafWork:a.maxRafWork,maxFrameGap:a.maxFrameGap,longTasks:a.longTasks.length,longestTask:Math.max(0,...a.longTasks.map(item=>item.duration)),pulses:a.pulses,scrollY,overflow:document.documentElement.scrollWidth-innerWidth};
    })
  ]);
  const counters=Object.fromEntries(metrics.metrics.map(metric=>[metric.name,metric.value]));
  const sample={at:new Date().toISOString(),elapsedSeconds:Math.round((Date.now()-started)/1000),label,heapUsed:heap.usedSize,heapTotal:heap.totalSize,backingStorage:heap.backingStorageSize,dom,taskDuration:counters.TaskDuration,...client};
  if(previousSnapshot){sample.intervalFrames=client.gl.reduce((sum,entry)=>sum+entry.frames,0)-previousSnapshot.gl.reduce((sum,entry)=>sum+entry.frames,0);sample.intervalRaf=client.rafCount-previousSnapshot.rafCount;}
  samples.push(sample);previousSnapshot=sample;
  if(client.media.some(element=>element.alive&&!element.connected&&!element.paused))failures.push({at:sample.at,label,message:'Detached media remains playing after garbage collection'});
  if(client.gl.some(entry=>entry.connected&&entry.contextLost))failures.push({at:sample.at,label,message:'A connected WebGL scene has an unrecovered lost context'});
  await writeReport(false);log('sample',{label,heapMB:Number((heap.usedSize/1048576).toFixed(2)),nodes:dom.nodes,listeners:dom.jsEventListeners,connectedGL:client.gl.filter(entry=>entry.connected).length,detachedAliveGL:client.gl.filter(entry=>entry.alive&&!entry.connected).length,liveMedia:client.media.filter(entry=>entry.alive).length,detachedMedia:client.media.filter(entry=>entry.alive&&!entry.connected).length,detachedPlayingMedia:client.media.filter(entry=>entry.alive&&!entry.connected&&!entry.paused).length,audio:client.audio,clearCalls:sample.intervalFrames});
  return sample;
}
async function writeReport(complete) {
  const settled=samples.filter(sample=>sample.label.endsWith('-settled'));
  const report={complete,passed:complete&&errors.length===0&&failures.length===0,site:base,buildAssets,requestedMinutes:minutes,startedAt:new Date(started).toISOString(),elapsedSeconds:Math.round((Date.now()-started)/1000),audioOutput:'Muted only in the isolated Chrome instance; real AudioContext graph at 15% is measured.',measurementNotes:['The legacy frames/intervalFrames fields count WebGL clear calls, not displayed animation frames or FPS.','requestAnimationFrame work and gap maxima include cold shader compilation, navigation and forced garbage collection; they are not a steady-state FPS benchmark.','DOM counters include browser-native media controls and documents. WeakRef media and WebGL records distinguish live detached resources; a retained paused element alone is not proof of an application leak.'],errors,failures,limitations,actions,samples,summary:{samples:samples.length,visits:iteration,maximumHeapMB:Math.max(0,...samples.map(sample=>sample.heapUsed))/1048576,maximumDetachedAliveGL:Math.max(0,...settled.map(sample=>sample.gl.filter(entry=>entry.alive&&!entry.connected).length)),maximumDetachedPlayingMedia:Math.max(0,...settled.map(sample=>sample.media.filter(entry=>entry.alive&&!entry.connected&&!entry.paused).length)),maximumRafWorkMs:Math.max(0,...samples.map(sample=>sample.maxRafWork)),maximumFrameGapMs:Math.max(0,...samples.map(sample=>sample.maxFrameGap))}};
  await writeFile(out+'/report.json',JSON.stringify(report,null,2));
  return report;
}
async function route(path) {
  log('route-start',{path});
  if(await page.locator('.ms-player-dialog[open]').count())await page.keyboard.press('Escape');
  const link=page.locator(`a[href="#${path}"]`).first();
  await link.click();await page.waitForURL(url=>url.hash.split('?')[0]==='#'+path);await sleep(1500);
  log('route-ready',{path});
}
async function setupSound() {
  await page.goto(base+'#/settings');buildAssets=await page.locator('script[src]').evaluateAll(scripts=>scripts.map(script=>script.getAttribute('src')));await page.getByRole('switch',{name:'Interface sound',exact:true}).first().click();
  await page.getByRole('slider',{name:/Master volume/}).first().fill('15');
  await page.getByRole('switch',{name:'Ambient atmosphere',exact:true}).first().click();
  await page.getByRole('slider',{name:/Atmosphere mix/}).first().fill('10');
  await page.getByRole('button',{name:'Audition glass sound',exact:true}).first().click();log('audio-opt-in');
}
async function interact(path) {
  const cycle=Math.floor(iteration/6);
  log('interaction-start',{path,cycle});
  if(path==='/'){
    const sculpture=page.getByRole('group',{name:'Interactive cultural sculpture',exact:true});await sculpture.scrollIntoViewIfNeeded();
    await page.getByRole('button',{name:'Unfold',exact:true}).click();
    await page.getByRole('button',{name:'Resonate. Hold to charge, release to send a signal.',exact:true}).click({delay:450});
    const box=await sculpture.boundingBox();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.58,{steps:12});await page.mouse.up();
    await page.getByRole('button',{name:'Reset sculpture',exact:true}).click();
  }else if(path==='/world'){
    await page.locator('.ex-destinations button').nth(cycle%6).click();
    await page.getByRole('button',{name:/Cultural connections (on|off)/}).click();await page.getByRole('button',{name:/Cultural connections (on|off)/}).click();
    await page.getByRole('button',{name:'Take a different turn',exact:false}).click();
    await page.locator('.ex-orbit-stage').scrollIntoViewIfNeeded();
    const canvas=page.locator('.ex-orbit-stage canvas');if(await canvas.count()){const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.4);await page.mouse.down();await page.mouse.move(box.x+box.width*.72,box.y+box.height*.5,{steps:10});await page.mouse.up();}
  }else if(path==='/time-machine'){
    await page.getByRole('slider',{name:/DRAG TO TRAVEL/}).fill(String(cycle%6));
    await page.getByRole('button',{name:'Compare another era',exact:false}).click();
    await page.getByRole('combobox',{name:'Comparison era',exact:true}).selectOption({index:(cycle+1)%5});
    await page.getByRole('button',{name:'Close era comparison',exact:true}).click();
    await page.getByRole('button',{name:'Contact sheet',exact:false}).click();await page.getByRole('button',{name:'Film strip',exact:false}).click();
  }else if(path==='/settings'){
    await page.getByRole('button',{name:'Audition resonance sound',exact:true}).first().click();
  }else if(path==='/my-world'){
    const card=page.locator('.passport-card').nth(cycle%6);await card.click();
    const collect=page.locator('.passport-detail-place').getByRole('button');if(await collect.count())await collect.click();
    await page.locator('.passport-detail-place').scrollIntoViewIfNeeded();
  }else if(path==='/journey'){
    await page.getByRole('combobox',{name:'Journey duration',exact:true}).selectOption('5');
    await page.getByRole('button',{name:'Find my journey',exact:true}).click();
    const down=page.getByRole('button',{name:/^Move .+ down$/}).first();if(await down.isEnabled())await down.click();
    await page.getByRole('button',{name:'Play entire journey',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.ms-player-dialog video')?.readyState>=2);
  }
  log('interacted',{path,cycle});
}
async function rapidBurst(){log('rapid-route-burst');for(const path of ['/','/world','/time-machine','/','/world','/settings'])await bounded(()=>route(path),`burst route ${path}`);await bounded(()=>snapshot('burst-settled'),'burst metrics');}
try {
  await setupSound();await snapshot('initial-audio');
  const routes=['/','/world','/time-machine','/settings','/my-world','/journey'];
  while(Date.now()<deadline){
    const visitStart=Date.now(),path=routes[iteration%routes.length];
    try{
      await bounded(()=>route(path),`route ${path}`);await bounded(()=>interact(path),`interaction ${path}`);await bounded(()=>snapshot(`${iteration}-${path}-entered`),`entered metrics ${path}`);
      if(iteration===3){
        log('idle-suspension-start');await sleep(100000);
        const idle=await snapshot('idle-audio-settled');assert.ok(idle.audio.every(state=>state==='suspended'||state==='collected'),'Opted-in audio must suspend after idle');
        await page.getByRole('button',{name:'Audition magnetic sound',exact:true}).first().click();log('idle-suspension-resumed');
      }else{
        for(let beat=1;beat<=4&&Date.now()<deadline;beat++){
          await sleep(18000);
          if(path==='/journey'){
            if(beat===1){await page.getByRole('button',{name:'Keep this moment',exact:true}).click();await page.getByRole('textbox',{name:'Moment note',exact:true}).fill(`Endurance session ${iteration}`);await page.getByRole('button',{name:'Keep moment',exact:true}).click();}
            if(beat===3){await page.getByRole('button',{name:'Forward 10 seconds',exact:true}).click();}
          }else{await bounded(async()=>{await page.mouse.wheel(0,beat%2?400:-400);await page.mouse.move(700+beat*30,300+beat*35,{steps:6});},`scroll gesture ${path}`);}
          log('dwell-beat',{path,beat});
        }
      }
      if(iteration===9){
        const quiet=await context.newPage();
        try {
          await quiet.goto('about:blank');await quiet.bringToFront();await sleep(10000);
          const background=await snapshot('background-tab');
          if(background.visibility==='hidden')assert.ok(background.audio.every(state=>state!=='running'),'Hidden-page audio must suspend');
          else {const limitation={at:new Date().toISOString(),check:'background-tab',message:'This headless Chrome reports the original page as visible after another page is brought to front, so actual hidden-tab suspension is not verified by this run.'};limitations.push(limitation);log('unsupported-environment',limitation);}
        } finally {await page.bringToFront();await quiet.close();}
        await sleep(1000);await page.getByRole('button',{name:'Audition magnetic sound',exact:true}).first().click();log('background-return-gesture');
      }
      if(path!=='/journey'){await page.mouse.wheel(0,-20000);await sleep(1000);}
      await snapshot(`${iteration}-${path}-settled`);
      if(iteration>0&&iteration%6===5&&Date.now()+30000<deadline)await rapidBurst();
    }catch(error){if(error instanceof BrowserStall)throw error;failures.push({at:new Date().toISOString(),iteration,path,message:error.message});log('visit-failure',{path,message:error.message});await page.screenshot({path:out+`/failure-${iteration}.png`,timeout:10000}).catch(()=>{});}
    iteration++;await writeReport(false);
    await sleep(Math.max(0,90000-(Date.now()-visitStart)));
  }
  if(await page.locator('.ms-player-dialog[open]').count())await page.keyboard.press('Escape');
  await route('/settings');await snapshot('final-settings-settled');await page.screenshot({path:out+'/final-settings.png'});
  const final=await writeReport(true);console.log(JSON.stringify({complete:final.complete,passed:final.passed,elapsedSeconds:final.elapsedSeconds,errors,failures,summary:final.summary}));
  if(!final.passed)process.exitCode=1;
}catch(error){failures.push({at:new Date().toISOString(),message:error.message});await writeReport(false);throw error;}
finally{
  const closeDeadline=setTimeout(()=>{console.error('Owned test browser did not close within15seconds; stopping this test process.');process.exit(1);},15000);
  try{await browser.close();}finally{clearTimeout(closeDeadline);}
}
