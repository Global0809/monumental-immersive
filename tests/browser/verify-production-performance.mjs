import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
const base=process.env.SITE_URL || 'http://127.0.0.1:5175/';
const out='test-results/production-performance';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
const reports=[];
for(const profile of [{name:'desktop-cold',width:1440,height:1000,cpu:1},{name:'mobile-cold-4x-cpu',width:390,height:844,cpu:4},{name:'mobile-4x-cpu-1.6mbps',width:390,height:844,cpu:4,network:true}]){
  const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:1});
  const page=await context.newPage();const cdp=await context.newCDPSession(page);const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpu});
  if(profile.network){await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750,connectionType:'cellular4g'});}
  await page.addInitScript(()=>{
    window.__quality={longTasks:[],lcp:null,cls:0,sceneReady:null};
    new PerformanceObserver(list=>{for(const entry of list.getEntries())window.__quality.longTasks.push({start:entry.startTime,duration:entry.duration});}).observe({type:'longtask',buffered:true});
    new PerformanceObserver(list=>{for(const entry of list.getEntries())window.__quality.lcp={time:entry.startTime,size:entry.size,element:entry.element?.tagName};}).observe({type:'largest-contentful-paint',buffered:true});
    new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__quality.cls+=entry.value;}).observe({type:'layout-shift',buffered:true});
    const observer=new MutationObserver(()=>{if(document.querySelector('.culture-sculpture.is-ready')&&!window.__quality.sceneReady){window.__quality.sceneReady=performance.now();observer.disconnect();}});observer.observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  });
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:90000});
  await page.locator('.culture-sculpture.is-ready').waitFor({timeout:90000});
  await page.waitForTimeout(5000);
  const snapshot=await page.evaluate(()=>({...window.__quality,paint:performance.getEntriesByType('paint').map(e=>({name:e.name,time:e.startTime})),resources:performance.getEntriesByType('resource').map(e=>({name:e.name.split('/').pop(),transfer:e.transferSize,decoded:e.decodedBodySize,duration:e.duration})),overflow:document.documentElement.scrollWidth>innerWidth}));
  // Measure user-visible command response separately from resource loading.
  const start=Date.now();await page.getByRole('link',{name:'Search',exact:true}).click();await page.getByRole('combobox',{name:'Search everything'}).waitFor();
  const commandMs=Date.now()-start;
  await page.getByRole('combobox',{name:'Search everything'}).fill('Miami');
  await page.locator('.command-results li').first().waitFor();
  await page.screenshot({path:`${out}/${profile.name}.png`});
  reports.push({profile,metrics:snapshot,commandResponseMs:commandMs,errors});
  console.log(JSON.stringify({name:profile.name,lcp:snapshot.lcp,sceneReadyMs:snapshot.sceneReady,cls:snapshot.cls,longestTaskMs:Math.max(0,...snapshot.longTasks.map(t=>t.duration)),totalBlockingMs:snapshot.longTasks.reduce((sum,t)=>sum+Math.max(0,t.duration-50),0),commandResponseMs:commandMs,overflow:snapshot.overflow,errors}));
  await context.close();
}
await writeFile(out+'/report.json',JSON.stringify({note:'Synthetic local Vite preview measurements, not field Core Web Vitals. Network profile uses uncompressed local assets; hosting compression may differ. Canvas readiness is reported separately from LCP.',reports},null,2));
await browser.close();
