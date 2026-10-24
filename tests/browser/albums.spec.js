import {test,expect} from '@playwright/test';
import {taggedWav,sineWav} from '../fixtures/tagged-audio.js';
const fixture=(name,values)=>({name,mimeType:'audio/wav',buffer:taggedWav(sineWav(2),values)});
test('album artwork grid, disc order, detail playback queue and back navigation',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.locator('#file-input').setInputFiles([
 fixture('z.wav',{title:'Opening',artist:'First Singer',album:'Compilation',albumArtist:'Various Artists',trackNumber:1,discNumber:1}),
 fixture('a.wav',{title:'Finale',artist:'Second Singer',album:'Compilation',albumArtist:'Various Artists',trackNumber:2,discNumber:1}),
 fixture('b.wav',{title:'Bonus',artist:'Third Singer',album:'Compilation',albumArtist:'Various Artists',trackNumber:1,discNumber:2}),
 fixture('other.wav',{title:'Unrelated',artist:'Different Artist',album:'Compilation',trackNumber:1})]);
 await expect(page.locator('.track-name strong').filter({hasText:'Opening'})).toHaveCount(1);
 await page.locator('#nav-albums').click();await expect(page.locator('.album-card')).toHaveCount(2);
 await expect.poll(()=>page.locator('.album-card img').first().evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
 await page.locator('#search').fill('Various Artists');await expect(page.locator('.album-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Open album Compilation by Various Artists',exact:true}).click();
 await expect(page.locator('#album-detail h2')).toHaveText('Compilation');await expect(page.locator('.track-name strong')).toHaveText(['Opening','Finale','Bonus']);
 await page.locator('#play-album').click();await expect(page.locator('#now-title')).toHaveText('Opening');
 await page.locator('#next').click();await expect(page.locator('#now-title')).toHaveText('Finale');
 await page.locator('#album-back').click();await expect(page.locator('#search')).toHaveValue('Various Artists');
 await page.locator('#nav-all').click(); // Browsing must not change the album playback queue.
 await expect.poll(()=>page.locator('#now-title').textContent(),{timeout:8000}).toBe('Bonus');
 await expect(page.locator('#play')).toHaveAttribute('aria-label','Play',{timeout:8000});await expect(page.locator('#now-title')).toHaveText('Bonus');
 await page.locator('#nav-albums').click();await page.locator('#search').fill('nothing-matches');await expect(page.getByRole('heading',{name:'No albums found.'})).toBeVisible();
 await page.locator('#search').fill('');await page.setViewportSize({width:390,height:844});await expect(page.locator('.album-card')).toHaveCount(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/albums-mobile.png',fullPage:true});expect(errors).toEqual([]);
});
