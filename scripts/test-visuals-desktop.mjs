import {_electron as electron,expect} from '@playwright/test';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {zipSync,strToU8} from 'fflate';
import {MILK_PRESET,SHADER_PRESET,CONVERTED_PRESET} from '../tests/fixtures/visual-pack.js';
const root=path.resolve(process.env.MANDO_TEST_EXECUTABLE?'.desktop-test/packaged-visuals':'.desktop-test/visuals'),profile=path.join(root,'profile');await fs.mkdir(profile,{recursive:true});
const image=await fs.readFile('build/icon.png');const buffer=Buffer.from(zipSync({'aurora.milk':strToU8(MILK_PRESET),'shader.milk':strToU8(SHADER_PRESET),'Textures/mando_grain.png':image,'blocked.json':strToU8(JSON.stringify({...CONVERTED_PRESET,init_eqs_str:'try{parent.localStorage.setItem("external-preset-access","yes")}catch(e){}'}))}));
let instance;const errors=[];
async function launch(){const instance=await electron.launch({...(process.env.MANDO_TEST_EXECUTABLE?{executablePath:path.resolve(process.env.MANDO_TEST_EXECUTABLE),args:[]}:{args:['.']}),env:{...process.env,MANDO_TEST_PROFILE:profile}});const page=await instance.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForLoadState();return {instance,page};}
try{
 let session=await launch();instance=session.instance;let page=session.page;
 await page.locator('#nav-visualizer').click();await expect(page.locator('#preset-dialog')).toBeVisible();
 // Isolated test profiles can be reused; remove this test's previous pack first.
 for(const remove of await page.getByRole('button',{name:'Remove preset pack Windows Demo',exact:true}).all())await remove.click();
 await page.locator('#visual-sensitivity').fill('1.8');await page.locator('#visual-color-a').fill('#ee3355');await page.locator('#visual-blend').fill('1');await page.locator('#visual-auto').uncheck();
 await page.locator('#visual-pack-input').setInputFiles({name:'Windows Demo.zip',mimeType:'application/zip',buffer});await expect(page.locator('#visual-install-report')).toContainText('installed 3 presets',{timeout:45000});
 await page.locator('#preset-search').fill('Windows Demo / aurora');await page.locator('.preset-option').click();await expect(page.locator('#preset-label')).toContainText('Windows Demo / aurora');
 const frame=page.frames().find(f=>f.url().includes('visualizer.html'));assert.equal(await frame.evaluate(()=>typeof window.mandoDesktop),'undefined');assert.equal(await frame.evaluate(()=>{try{void parent.document;return false;}catch{return true;}}),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('external-preset-access')),null);
 await page.locator('#close-presets').click();await page.locator('#demo').click();await expect.poll(()=>instance.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.isCurrentlyAudible())).toBe(true);
 await expect.poll(async()=>Number(await page.locator('#milkdrop').getAttribute('data-audio-rms'))).toBeGreaterThan(.005);
 await page.locator('#nav-visualizer').click();await expect.poll(()=>page.locator('#visual-preview-image').getAttribute('src')).not.toBeNull();await page.locator('#visual-restart').click();await expect(page.locator('#toast')).toContainText('Visualizer restarted',{timeout:30000});await expect(page.locator('#preset-dialog')).not.toBeVisible();
 assert.equal(await instance.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.isCurrentlyAudible()),true);
 await page.screenshot({path:path.join(root,'visual-manager.png')});await instance.close();instance=null;
 session=await launch();instance=session.instance;page=session.page;await page.locator('#nav-visualizer').click();await expect(page.locator('#visual-sensitivity')).toHaveValue('1.8');await expect(page.locator('#visual-color-a')).toHaveValue('#ee3355');await expect(page.locator('#visual-packs')).toContainText('Windows Demo');await expect(page.locator('#preset-label')).toContainText('Windows Demo / aurora');
 await page.getByRole('button',{name:'Remove preset pack Windows Demo',exact:true}).click();await expect(page.locator('#visual-packs')).not.toContainText('Windows Demo');await instance.close();instance=null;assert.deepEqual(errors,[]);
 console.log('Desktop visualization checks passed: local MilkDrop/shader ZIP imports and textures, saved controls and packs after restart, isolated preset execution, audible playback, nonzero audio delivery, preview, recovery, and uninstall.');
}finally{if(instance)await instance.close();}
