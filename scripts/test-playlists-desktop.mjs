import {_electron as electron,expect} from '@playwright/test';
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {taggedWav,sineWav} from '../tests/fixtures/tagged-audio.js';
const root=path.resolve(process.env.MANDO_TEST_EXECUTABLE?'.desktop-test/packaged-playlists':'.desktop-test/playlists'),music=path.join(root,'Music'),profile=path.join(root,'profile');
await fs.mkdir(music,{recursive:true});await fs.mkdir(profile,{recursive:true});
for(const [index,title] of ['Alpha','Bravo','Charlie'].entries())await fs.writeFile(path.join(music,`${title}.wav`),taggedWav(sineWav(),{title,artist:'Test Artist',album:index<2?'First Album':'Other Album',trackNumber:index+1}));
const errors=[];
async function launch(){const instance=await electron.launch({...(process.env.MANDO_TEST_EXECUTABLE?{executablePath:path.resolve(process.env.MANDO_TEST_EXECUTABLE),args:[]}:{args:['.']}),env:{...process.env,MANDO_TEST_PROFILE:profile}});const page=await instance.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForLoadState();return {instance,page};}
let instance;
try{
 let session=await launch();instance=session.instance;let page=session.page;
 await page.evaluate(()=>localStorage.removeItem('mando-playlists-v1'));await page.reload();
 await instance.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},music);
 await page.locator('#add-folder').click();await expect(page.locator('.track-row')).toHaveCount(3);
 await page.getByRole('button',{name:'Add Alpha to playlist',exact:true}).click();await page.locator('#playlist-name').fill('Road Mix');await page.locator('#submit-playlist-dialog').click();
 await page.locator('#nav-albums').click();await page.getByRole('button',{name:'Open album First Album by Test Artist',exact:true}).click();await page.locator('#add-album-playlist').click();await page.locator('#submit-playlist-dialog').click();
 await page.locator('#nav-all').click();await page.getByRole('button',{name:'Add Charlie to playlist',exact:true}).click();await page.locator('#submit-playlist-dialog').click();
 await page.locator('#nav-playlists').click();await page.getByRole('button',{name:'Open playlist Road Mix',exact:true}).click();await expect(page.locator('.playlist-song-play strong')).toHaveText(['Alpha','Bravo','Charlie']);
 await page.getByRole('button',{name:'Move Charlie up',exact:true}).click();await page.getByRole('button',{name:'Move Charlie up',exact:true}).click();await expect(page.locator('.playlist-song-play strong')).toHaveText(['Charlie','Alpha','Bravo']);
 await page.locator('#play-playlist').click();await expect(page.locator('#now-title')).toHaveText('Charlie');await expect.poll(()=>instance.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.isCurrentlyAudible())).toBe(true);
 await page.locator('#next').click();await expect(page.locator('#now-title')).toHaveText('Alpha');await page.locator('#play').click();
 await page.locator('#rename-playlist').click();await page.locator('#playlist-name').fill('Saved Mix');await page.locator('#submit-playlist-dialog').click();
 await page.screenshot({path:path.join(root,'playlists.png')});
 await instance.close();instance=null;
 session=await launch();instance=session.instance;page=session.page;
 await expect(page.locator('.track-row')).toHaveCount(3);await page.locator('#nav-playlists').click();await page.getByRole('button',{name:'Open playlist Saved Mix',exact:true}).click();
 await expect(page.locator('.playlist-song-play strong')).toHaveText(['Charlie','Alpha','Bravo']);await expect(page.locator('.playlist-song.unavailable')).toHaveCount(0);
 await page.locator('#play-playlist').click();await expect(page.locator('#now-title')).toHaveText('Charlie');await expect.poll(()=>instance.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.isCurrentlyAudible())).toBe(true);
 await instance.close();instance=null;assert.deepEqual(errors,[]);console.log('Desktop playlist checks passed: native songs and album additions, saved order, rename, audible playlist playback, next-song order, and persistence after a full app restart.');
}finally{if(instance)await instance.close();}
