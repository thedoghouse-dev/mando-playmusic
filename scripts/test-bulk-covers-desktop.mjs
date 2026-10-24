import {_electron as electron,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {sineWav,taggedWav,artwork} from '../tests/fixtures/tagged-audio.js';
const root=await fs.mkdtemp(path.resolve('.desktop-test/bulk-covers-')),music=path.join(root,'Music','Test Artist'),profile=path.join(root,'profile');
await fs.mkdir(profile,{recursive:true});
for(const name of ['Embedded','Folder','Missing','Unmatched']){
 const directory=path.join(music,name);await fs.mkdir(directory,{recursive:true});
 await fs.writeFile(path.join(directory,'song.wav'),name==='Embedded'?taggedWav(sineWav(1),{artist:'Test Artist',album:name,title:'song'}):sineWav(1));
 if(name==='Folder')await fs.writeFile(path.join(directory,'folder.jpg'),artwork);
 if(name==='Missing')await fs.writeFile(path.join(directory,'second.wav'),sineWav(1));
}
const id='12345678-1234-1234-1234-123456789abc';
const app=await electron.launch({...(process.env.MANDO_TEST_EXECUTABLE?{executablePath:path.resolve(process.env.MANDO_TEST_EXECUTABLE),args:[]}:{args:['.']}),env:{...process.env,MANDO_TEST_PROFILE:profile}});
try{
 const page=await app.firstWindow();await page.waitForLoadState();
 await app.evaluate(({},data)=>{
  globalThis.bulkRequests=[];globalThis.fetch=async url=>{
   const address=String(url);globalThis.bulkRequests.push(address);
   if(address.startsWith('https://musicbrainz.org/')){
    const query=new URL(address).searchParams.get('query');return new Response(JSON.stringify({'release-groups':query.includes('Missing')?[{id:data.id,title:'Missing','artist-credit':[{name:'Test Artist'}]}]:[]}));
   }
   if(address===`https://coverartarchive.org/release-group/${data.id}/front-500`)return new Response(Buffer.from(data.artwork,'base64'));
   throw Error('Unexpected request');
  };
 },{id,artwork:artwork.toString('base64')});
 await app.evaluate(({dialog},music)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[music]});},path.join(root,'Music'));
 await page.locator('#add-folder').click();await expect(page.locator('.track-row')).toHaveCount(5);
 await page.locator('#nav-albums').click();await page.locator('#search').fill('Missing');
 await page.locator('#find-missing-covers').click();await expect(page.locator('.bulk-description')).toContainText('all 4 albums');
 assert.equal(await app.evaluate(()=>globalThis.bulkRequests.length),0);
 await page.getByRole('button',{name:'Start downloads',exact:true}).click();
 await expect(page.locator('.bulk-status')).toContainText('Finished.',{timeout:30000});
 await expect(page.locator('.bulk-status')).toContainText('1 downloaded · 2 already covered · 1 unmatched · 0 failed');
 const requests=await app.evaluate(()=>globalThis.bulkRequests);assert.equal(requests.length,3);assert.ok(requests.filter(value=>value.includes('musicbrainz')).every(value=>!value.includes('Embedded')&&!value.includes('Folder')));
 const index=JSON.parse(await fs.readFile(path.join(profile,'downloaded-covers','index.json'),'utf8'));assert.equal(Object.keys(index).length,2);
 await page.screenshot({path:path.join(root,'bulk-covers.png')});console.log('Bulk cover screenshot:',path.join(root,'bulk-covers.png'));
 await page.getByRole('button',{name:'Run again',exact:true}).click();await expect(page.locator('.bulk-current')).toContainText('Unmatched: Searching');
 await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.locator('.bulk-status')).toContainText('Stopped.',{timeout:10000});
 assert.equal(await app.evaluate(()=>globalThis.bulkRequests.length),3);
 await page.locator('.bulk-close').click();await expect(page.locator('.album-card img')).toHaveCount(1);
 await expect.poll(()=>page.locator('.album-card img').evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
 await assert.rejects(page.evaluate(()=>window.mandoDesktop.hasAlbumArtwork(['mando://music/not-authorized'])));
 console.log('Bulk cover checks passed: entire library despite filters, existing artwork skipped without online requests, exact-match download for all album tracks, immediate refresh, unmatched results, retry skips downloaded covers, stop, and native authorization.');
}finally{await app.close();}
