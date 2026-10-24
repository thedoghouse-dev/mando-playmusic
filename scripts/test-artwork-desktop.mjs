import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { sineWav, taggedWav } from '../tests/fixtures/tagged-audio.js';
const root = await fs.mkdtemp(path.resolve('.desktop-test/artwork-'));
const music = path.join(root,'Music'), profile = path.join(root,'profile');
await fs.mkdir(music); await fs.mkdir(profile);
const names = ['Embedded','Folder','Cover','Front','Corrupt','Missing'];
for (const name of names) {
  const directory=path.join(music,name); await fs.mkdir(directory);
  await fs.writeFile(path.join(directory,'song.wav'),name==='Embedded'?taggedWav(sineWav(1),{title:name,artist:'Test',album:name}):sineWav(1));
}
const app = await electron.launch({...(process.env.MANDO_TEST_EXECUTABLE?{executablePath:path.resolve(process.env.MANDO_TEST_EXECUTABLE),args:[]}:{args:['.']}),env:{...process.env,MANDO_TEST_PROFILE:profile}});
try {
  const page=await app.firstWindow(); await page.waitForLoadState();
  const images=await app.evaluate(({nativeImage})=>{
    const make=(r,g,b)=>nativeImage.createFromBitmap(Buffer.from([b,g,r,255,b,g,r,255,b,g,r,255,b,g,r,255]),{width:2,height:2}).toPNG().toString('base64');
    return {red:make(255,0,0),blue:make(0,0,255)};
  });
  const write=async(folder,name,color)=>fs.writeFile(path.join(music,folder,name),Buffer.from(images[color],'base64'));
  await write('Embedded','folder.jpg','red');
  await write('Folder','FOLDER.JPG','red'); await write('Folder','cover.jpg','blue');
  await write('Cover','CoVeR.JpG','blue'); await write('Front','FRONT.PNG','red');
  await fs.writeFile(path.join(music,'Corrupt','folder.jpg'),'broken image'); await write('Corrupt','cover.jpg','blue');
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},music);
  await page.locator('#add-folder').click(); await expect(page.locator('.track-row')).toHaveCount(6);
  async function covers() {
    return page.evaluate(async()=>{
      const library=await window.mandoDesktop.restoreFolder(), results={};
      for(const track of library.tracks){
        const response=await fetch(track.metadata.artworkUrl);
        const name=track.path.split('/').at(-2);
        if(!response.ok){results[name]=null;continue;}
        const image=await createImageBitmap(await response.blob());
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
        const context=canvas.getContext('2d');context.drawImage(image,0,0);
        results[name]={width:image.width,pixel:[...context.getImageData(0,0,1,1).data]}; image.close();
      }
      return results;
    });
  }
  let result=await covers();
  assert.equal(result.Embedded.width,256); // Embedded icon takes priority over the red folder cover.
  for(const name of ['Folder','Front']) assert.deepEqual(result[name].pixel,[255,0,0,255]);
  for(const name of ['Cover','Corrupt']) assert.deepEqual(result[name].pixel,[0,0,255,255]);
  assert.equal(result.Missing,null);
  await page.locator('#nav-albums').click(); await expect(page.locator('.album-card')).toHaveCount(6);
  await expect.poll(()=>page.locator('.album-card img').evaluateAll(images=>images.filter(image=>image.complete&&image.naturalWidth>0).length)).toBe(5);
  await write('Missing','front.png','blue'); await write('Folder','FOLDER.JPG','blue');
  result=await covers(); // Restoring/rescanning clears both artwork caches and issues fresh URLs.
  assert.deepEqual(result.Missing.pixel,[0,0,255,255]); assert.deepEqual(result.Folder.pixel,[0,0,255,255]);
  console.log('Artwork checks passed: embedded priority, case-insensitive folder/cover/front fallback, corrupt-image skip, missing-cover placeholder, album grid, and cover refresh after rescan.');
} finally { await app.close(); }
