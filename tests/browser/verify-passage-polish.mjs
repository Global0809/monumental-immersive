import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.SITE_URL || 'http://127.0.0.1:5184/';
const output = process.env.POLISH_OUTPUT || 'output/playwright/passage-polish';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [], errors = [];
const check = (name, passed, detail) => { checks.push({ name, passed, detail }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); };
const chapters = [['The World','world'],['Time Machine','time-machine'],['The Cinema','movies'],['Music','music'],['Culture','culture'],['My World','my-world']];
try {
  for (const [name, viewport] of [['desktop',{width:1440,height:900}],['laptop',{width:1120,height:720}]]) {
    const context = await browser.newContext({ viewport }); const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (/WebGLProgram|shader error/i.test(message.text())) errors.push(message.text()); });
    await page.goto(base); await page.locator('.tunnel-journey[data-ready="true"]').waitFor();
    await page.waitForTimeout(950); await page.screenshot({path:`${output}/${name}-opening.png`});
    for (const [title,id] of chapters) {
      await page.getByRole('button',{name:`Travel to ${title}`,exact:true}).click();
      await page.waitForFunction(id => document.querySelector('[data-passage-reading="true"]')?.dataset.passageChapter === id,id);
      const mount = page.locator(`[data-tunnel-station="${id}"]`), heading = mount.locator('h2');
      await page.waitForTimeout(750);
      const before = await heading.boundingBox();
      await page.getByRole('button',{name:`Inspect ${title} exhibit`,exact:true}).click();
      await page.waitForTimeout(650); const after = await heading.boundingBox();
      const close = await page.getByRole('button',{name:`Close ${title} exhibit`,exact:true}).boundingBox();
      const footer = await mount.locator('.tunnel-panel-foot').boundingBox();
      const inspector = await mount.locator('.tunnel-inspection').boundingBox();
      const nav = await page.locator('.tunnel-wayfinder').boundingBox();
      check(`${name} ${id} headline stays anchored`,Math.abs(before.y-after.y)<2,{before:before.y,after:after.y});
      check(`${name} ${id} complete inspection stays above navigation`,Math.max(footer.y+footer.height,inspector.y+inspector.height)<nav.y+1 && close.y>76,{bottom:footer.y+footer.height,inspector:inspector.y+inspector.height,nav:nav.y,top:close.y});
      await page.screenshot({path:`${output}/${name}-${id}-inspection.png`});
      await page.keyboard.press('Escape');
      check(`${name} ${id} Escape restores focus`,await page.getByRole('button',{name:`Inspect ${title} exhibit`,exact:true}).evaluate(el=>el===document.activeElement));
    }
    await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
    await page.waitForTimeout(800);
    check(`${name} final chapter keeps quiet reading`,await page.locator('[data-passage-reading]').getAttribute('data-passage-reading')==='true' && await page.locator('.flight-environment').getAttribute('data-activity')==='fly');
    for(const top of [0,9000,2000,16000,0]) {await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),top);await page.waitForTimeout(90);}
    await page.waitForTimeout(500);
    const final = await page.evaluate(()=>({chapter:document.querySelector('[data-passage-chapter]')?.dataset.passageChapter,y:scrollY,canvases:document.querySelectorAll('canvas.spatial-world-canvas').length}));
    check(`${name} fast jumps return a valid entrance`,final.chapter==='entrance'&&final.canvases===1,final);
    await context.close();
  }
} catch(error) {check('runner',false,error.stack);}
finally {await browser.close();await writeFile(`${output}/verification.json`,JSON.stringify({checks,errors},null,2));}
if(checks.some(check=>!check.passed)||errors.length)process.exitCode=1;
