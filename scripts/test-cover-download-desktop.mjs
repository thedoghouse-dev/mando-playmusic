import {_electron as electron,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {sineWav,artwork} from '../tests/fixtures/tagged-audio.js';
const root=await fs.mkdtemp(path.resolve('.desktop-test/cover-download-'));
const music=path.join(root,'Test Artist','Test Album'),profile=path.join(root,'profile');
await fs.mkdir(music,{recursive:true});await fs.mkdir(profile);
await fs.writeFile(path.join(music,'song.wav'),sineWav(1));
const id='12345678-1234-1234-1234-123456789abc';
async function launch(){const app=await electron.launch({...(process.env.MANDO_TEST_EXECUTABLE?{executablePath:path.resolve(process.env.MANDO_TEST_EXECUTABLE),args:[]}:{args:['.']}),env:{...process.env,MANDO_TEST_PROFILE:profile}});const page=await app.firstWindow();await page.waitForLoadState();return {app,page};}
let {app,page}=await launch();
try{
  await app.evaluate(({},data)=>{
    globalThis.coverRequests=[];
    globalThis.fetch=async(url,options)=>{
      const address=String(url);globalThis.coverRequests.push(address);
      if(address.startsWith('https://musicbrainz.org/ws/2/release-group/'))return new Response(JSON.stringify({'release-groups':[{id:data.id,title:'Test Album','artist-credit':[{name:'Test Artist'}],'first-release-date':'2000','primary-type':'Album'}]}));
      if(address===`https://coverartarchive.org/release-group/${data.id}/front-500`)return new Response(Buffer.from(data.artwork,'base64'));
      throw Error('Unexpected network request: '+address);
    };
  },{id,artwork:artwork.toString('base64')});
  await app.evaluate(({dialog},music)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[music]});},path.join(root,'Test Artist'));
  await page.locator('#add-folder').click();await expect(page.locator('.track-row')).toHaveCount(1);
  await page.locator('#nav-albums').click();await page.locator('.album-card').click();
  await page.locator('#find-cover').click();await expect(page.locator('.cover-search-dialog')).toBeVisible();
  assert.equal(await app.evaluate(()=>globalThis.coverRequests.length),0);
  await page.locator('.close-cover').click();assert.equal(await app.evaluate(()=>globalThis.coverRequests.length),0);
  await page.locator('#find-cover').click();await page.getByRole('button',{name:'Search covers',exact:true}).click();
  await expect(page.locator('.cover-result')).toHaveCount(1);await page.locator('.cover-result').click();
  await expect(page.locator('.cover-preview')).toBeVisible();
  await page.screenshot({path:path.join(root,'cover-search.png')});
  console.log('Cover search screenshot:',path.join(root,'cover-search.png'));
  await assert.rejects(fs.access(path.join(profile,'downloaded-covers','index.json')));
  await page.getByRole('button',{name:'Use this cover',exact:true}).click();
  await expect(page.locator('.cover-search-dialog')).toHaveCount(0);
  await expect.poll(()=>page.locator('.album-large img').evaluate(image=>image.complete&&image.naturalWidth)).toBe(256);
  const index=JSON.parse(await fs.readFile(path.join(profile,'downloaded-covers','index.json'),'utf8'));assert.deepEqual(Object.values(index),[id]);
  const requests=await app.evaluate(()=>globalThis.coverRequests);assert.equal(requests.length,2);assert.match(requests[0],/releasegroup/);
  await assert.rejects(page.evaluate(()=>window.mandoDesktop.saveCover('bad',['mando://music/unknown'])));
  await app.close();({app,page}=await launch());await expect(page.locator('.track-row')).toHaveCount(1);
  await expect.poll(()=>page.locator('.mini-cover img').evaluate(image=>image.complete&&image.naturalWidth)).toBe(256);
  assert.deepEqual(await fs.readFile(path.join(music,'song.wav')),sineWav(1));
  console.log('Download checks passed: opt-in search, cancel, preview before saving, native download/save, immediate album refresh, unauthorized-track rejection, offline restart persistence, and unchanged audio files.');
}finally{await app.close();}
