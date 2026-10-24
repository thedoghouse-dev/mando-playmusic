import { test, expect } from '@playwright/test';
import { taggedWav, sineWav } from '../fixtures/tagged-audio.js';
test('embedded tags override filenames and artwork appears in library and player',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
 const title='Tag <title> & "mix"';
 await page.locator('#file-input').setInputFiles([{name:'Wrong Artist - Wrong Title.wav',mimeType:'audio/wav',buffer:taggedWav(sineWav(),{title,artist:'Björk',album:'Embedded Album'})}]);
 await expect(page.locator('.track-name strong')).toHaveText(title);await expect(page.locator('.track-name small')).toHaveText('Björk');await expect(page.locator('.album-cell')).toHaveText('Embedded Album');
 await expect.poll(()=>page.locator('.mini-cover img').evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
 await page.locator('#search').fill('björk');await expect(page.locator('.track-row')).toHaveCount(1);
 await page.getByRole('button',{name:`Play ${title}`,exact:true}).click();await expect(page.locator('#now-title')).toHaveText(title);await expect(page.locator('#now-artist')).toHaveText('Björk');
 await expect.poll(()=>page.locator('#cover img').evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
 await page.locator('#play').click();
 await page.locator('#file-input').setInputFiles([{name:'Untagged Song.wav',mimeType:'audio/wav',buffer:sineWav()}]);await page.locator('#search').fill('');
 await expect(page.locator('.track-name strong')).toHaveText('Untagged Song');await expect(page.locator('#cover img')).toHaveCount(0);expect(errors).toEqual([]);
});
