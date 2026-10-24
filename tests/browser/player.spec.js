import { test, expect } from '@playwright/test';
function wav() {
 const rate=22050, seconds=3, buffer=Buffer.alloc(44+rate*seconds*2);
 buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVE',8);buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(buffer.length-44,40);
 for(let i=0;i<rate*seconds;i++) buffer.writeInt16LE(Math.sin(i/rate*2*Math.PI*220)*2000,44+i*2);
 return buffer;
}
test('local file playback, MilkDrop, favorites, searching and controls', async ({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('heading',{name:'Your music, in motion.'})).toBeVisible();
 await page.locator('#file-input').setInputFiles([{name:'Test Artist - Night Drive.wav',mimeType:'audio/wav',buffer:wav()},{name:'Other Artist - Morning.wav',mimeType:'audio/wav',buffer:wav()}]);
 await expect(page.locator('.track-row')).toHaveCount(2);
 await page.getByRole('button',{name:'Play Night Drive',exact:true}).click();
 await expect(page.locator('#now-title')).toHaveText('Night Drive');await expect(page.locator('#duration')).toHaveText('0:03');
 await expect(page.locator('#milkdrop')).toHaveClass('ready',{timeout:45000});
 await expect.poll(()=>page.locator('#elapsed').textContent()).not.toBe('0:00');
 await page.locator('#play').click();await expect(page.locator('#play')).toHaveAttribute('aria-label','Play');
 await page.getByRole('button',{name:'Favorite Night Drive',exact:true}).click();await page.locator('#nav-favorites').click();await expect(page.locator('.track-row')).toHaveCount(1);
 await page.locator('#nav-all').click();await page.locator('#search').fill('other');await expect(page.locator('.track-row')).toHaveCount(1);await page.locator('#search').fill('nothing');await expect(page.getByRole('heading',{name:'No tracks found.'})).toBeVisible();await page.locator('#search').fill('');
 const preset=await page.locator('#preset-label').textContent();await page.locator('#preset-next').click();await expect(page.locator('#preset-label')).not.toHaveText(preset);
 await page.locator('#preset-label').click();await expect(page.locator('#preset-dialog')).toBeVisible();await page.locator('#preset-search').fill('this preset does not exist');await expect(page.locator('.preset-option')).toHaveCount(0);await page.keyboard.press('Escape');await expect(page.locator('#preset-dialog')).not.toBeVisible();
 await page.locator('#shuffle').click();await expect(page.locator('#shuffle')).toHaveAttribute('aria-pressed','true');await page.locator('#repeat').click();await expect(page.locator('#repeat')).toHaveAttribute('aria-pressed','true');
 await page.locator('#volume').fill('0.25');await expect(page.locator('#volume')).toHaveValue('0.25');
 await page.screenshot({path:'test-results/desktop.png',fullPage:true});expect(errors).toEqual([]);
});
test('demo and mobile layout',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.locator('#demo').click();await expect(page.locator('#now-title')).toHaveText('Midnight signal');await expect(page.locator('#milkdrop')).toHaveClass('ready',{timeout:45000});
 await page.locator('#play').click();await expect(page.locator('#now-title')).toHaveText('A little silence, for now.');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/mobile.png',fullPage:true});expect(errors).toEqual([]);
});
