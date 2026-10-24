import {test,expect} from '@playwright/test';
import {taggedWav,sineWav} from '../fixtures/tagged-audio.js';
const files=()=>['Alpha','Bravo','Charlie'].map((title,index)=>({name:`${title}.wav`,mimeType:'audio/wav',buffer:taggedWav(sineWav(),{title,artist:'Test Artist',album:index<2?'First Album':'Other Album',trackNumber:index+1})}));
async function imported(page){await page.locator('#file-input').setInputFiles(files());await expect(page.locator('.album-cell').first()).toHaveText('First Album');}
async function addSong(page,title){await page.getByRole('button',{name:`Add ${title} to playlist`,exact:true}).click();await page.locator('#submit-playlist-dialog').click();}
test('create, add songs and albums, reorder live playback, and restore saved playlists',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await imported(page);
 await page.locator('#nav-playlists').click();await page.locator('#new-playlist').click();await page.locator('#playlist-name').fill('Evening Mix');await page.locator('#submit-playlist-dialog').click();
 await expect(page.locator('#playlist-panel h2')).toHaveText('Evening Mix');await expect(page.locator('#play-playlist')).toBeDisabled();
 await page.locator('#nav-all').click();await addSong(page,'Alpha');
 await page.locator('#nav-albums').click();await page.getByRole('button',{name:'Open album First Album by Test Artist',exact:true}).click();await page.locator('#add-album-playlist').click();await page.locator('#submit-playlist-dialog').click();
 await page.locator('#nav-all').click();await addSong(page,'Charlie');
 await page.getByRole('button',{name:'Evening Mix 3',exact:true}).click();await expect(page.locator('.playlist-song-play strong')).toHaveText(['Alpha','Bravo','Charlie']);
 await page.getByRole('button',{name:'Move Charlie up',exact:true}).click();await expect(page.locator('.playlist-song-play strong')).toHaveText(['Alpha','Charlie','Bravo']);
 const rows=page.locator('.playlist-song');await rows.nth(1).dragTo(rows.nth(0));await expect(page.locator('.playlist-song-play strong')).toHaveText(['Charlie','Alpha','Bravo']);
 await page.locator('#play-playlist').click();await expect(page.locator('#now-title')).toHaveText('Charlie');
 await page.getByRole('button',{name:'Move Bravo up',exact:true}).click();await page.getByRole('button',{name:'Move Bravo up',exact:true}).click();await expect(page.locator('.playlist-song-play strong')).toHaveText(['Bravo','Charlie','Alpha']);
 await page.locator('#next').click();await expect(page.locator('#now-title')).toHaveText('Alpha');
 await page.locator('#rename-playlist').click();await page.locator('#playlist-name').fill('Night <mix>');await page.locator('#submit-playlist-dialog').click();await expect(page.locator('#playlist-panel h2')).toHaveText('Night <mix>');
 await page.locator('#play').click();await page.reload();await page.locator('#nav-playlists').click();await page.getByRole('button',{name:'Open playlist Night <mix>',exact:true}).click();
 await expect(page.locator('.playlist-song.unavailable')).toHaveCount(3);await expect(page.locator('#play-playlist')).toBeDisabled();
 await page.locator('#file-input').setInputFiles(files());await expect(page.locator('.playlist-song.unavailable')).toHaveCount(0);await expect(page.locator('.playlist-song-play strong')).toHaveText(['Bravo','Charlie','Alpha']);
 const saved=await page.evaluate(()=>localStorage.getItem('mando-playlists-v1'));expect(saved).not.toContain('blob:');expect(saved).not.toContain('mando://');
 await page.locator('#search').fill('Bravo');await expect(page.locator('.playlist-song')).toHaveCount(1);await expect(page.getByRole('button',{name:'Move Bravo down',exact:true})).toBeDisabled();await page.locator('#search').fill('');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/playlists-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Remove Charlie from playlist',exact:true}).click();await expect(page.locator('.playlist-song')).toHaveCount(2);
 await page.locator('#delete-playlist').click();await page.locator('#submit-playlist-dialog').click();await expect(page.locator('.playlist-card')).toHaveCount(0);expect(errors).toEqual([]);
});
test('failed persistence keeps the previous playlist and shows the save failure',async({page})=>{
 await page.goto('/');await page.locator('#nav-playlists').click();await page.locator('#new-playlist').click();await page.locator('#playlist-name').fill('Do not lose this');
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='mando-playlists-v1')throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};});
 await page.locator('#submit-playlist-dialog').click();await expect(page.locator('#playlist-dialog')).toBeVisible();await expect(page.locator('#toast')).toContainText('Could not save');expect(await page.evaluate(()=>localStorage.getItem('mando-playlists-v1'))).toBeNull();
});
test('playlist auto-advances after removing the current song and stops at its own end',async({page})=>{
 await page.goto('/');await page.locator('#file-input').setInputFiles(['Alpha','Bravo','Charlie'].map(title=>({name:`${title}.wav`,mimeType:'audio/wav',buffer:taggedWav(sineWav(2),{title,artist:'Artist',album:'Album'})})));
 await page.evaluate(()=>localStorage.setItem('mando-playlists-v1',JSON.stringify([{id:'test',name:'Short Mix',entries:['Charlie','Alpha'].map(title=>({trackId:`${title}.wav`,title,artist:'Artist',album:'Album'}))}])));
 // Reload to read the saved playlist, then reconnect the same selected files.
 await page.reload();await page.locator('#file-input').setInputFiles(['Alpha','Bravo','Charlie'].map(title=>({name:`${title}.wav`,mimeType:'audio/wav',buffer:taggedWav(sineWav(2),{title,artist:'Artist',album:'Album'})})));
 await page.locator('#nav-playlists').click();await page.getByRole('button',{name:'Open playlist Short Mix',exact:true}).click();await page.locator('#play-playlist').click();await expect(page.locator('#now-title')).toHaveText('Charlie');
 await page.getByRole('button',{name:'Remove Charlie from playlist',exact:true}).click();await expect(page.locator('.playlist-song')).toHaveCount(1);await expect(page.locator('#now-title')).toHaveText('Charlie');
 await expect(page.locator('#now-title')).toHaveText('Alpha',{timeout:8000});await expect(page.locator('#play')).toHaveAttribute('aria-label','Play',{timeout:8000});await expect(page.locator('#now-title')).toHaveText('Alpha');
});
