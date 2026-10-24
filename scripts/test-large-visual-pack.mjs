import {_electron as electron,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
const archive=process.argv[2];if(!archive)throw Error('Pass a local MilkDrop ZIP path.');
await fs.mkdir(path.resolve('.desktop-test/large-pack'),{recursive:true});const profile=await fs.mkdtemp(path.resolve('.desktop-test/large-pack/profile-'));
const app=await electron.launch({...(process.env.MANDO_TEST_EXECUTABLE?{executablePath:path.resolve(process.env.MANDO_TEST_EXECUTABLE),args:[]}:{args:['.']}),env:{...process.env,MANDO_TEST_PROFILE:profile}});
try{
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.locator('#demo').click();await page.locator('#nav-visualizer').click();await page.locator('#visual-auto').uncheck();
 await expect(page.locator('#preset-dialog')).toBeVisible();const remove=page.getByRole('button',{name:/Remove preset pack presets-cream/});while(await remove.count())await remove.first().click();
 await page.locator('#visual-pack-input').setInputFiles(archive);
 await expect(page.locator('#visual-install-report')).toContainText('installed 9795 presets',{timeout:120000});
 await expect(page.locator('#visual-install-report')).toContainText('Compatibility is checked when each preset plays');
 const options=page.locator('#visual-pack-filter option');const option=options.filter({hasText:'presets-cream'});await page.locator('#visual-pack-filter').selectOption(await option.getAttribute('value'));
 await expect(page.locator('.preset-option')).toHaveCount(100);await page.getByRole('button',{name:'Show more (100 of 9795)',exact:true}).click();await expect(page.locator('.preset-option')).toHaveCount(200);
 const name=await page.locator('.preset-option').first().textContent();await page.locator('.preset-option').first().click();await expect(page.locator('#preset-label')).toContainText(name,{timeout:30000});
 await page.locator('#visual-start').click();await expect(page.locator('#preset-dialog')).not.toBeVisible();await expect(page.locator('#visualizer-intro')).toBeHidden();await expect(page.locator('#milkdrop')).toHaveClass('ready');
 await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.isCurrentlyAudible())).toBe(true);
 await page.locator('#nav-visualizer').click();await expect.poll(()=>page.locator('#visual-preview-image').getAttribute('src')).not.toBeNull();await page.screenshot({path:'.desktop-test/large-pack/installed.png'});
 if(errors.length)throw Error(errors.join('\n'));
 console.log('Large pack checks passed: all 9,795 presets installed, paged browsing, real preset playback, Start visualizer, live preview, audible music.');
}finally{await app.close();}
