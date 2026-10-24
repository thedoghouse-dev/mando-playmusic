import {taggedWav,tags} from '../tests/fixtures/tagged-audio.js';
import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(process.env.MANDO_TEST_EXECUTABLE ? '.desktop-test/packaged' : '.desktop-test');await fs.mkdir(root,{recursive:true});
const music=path.join(root,'Music','Test Artist','Test Album');await fs.mkdir(music,{recursive:true});
const sampleRate=22050,seconds=8,buffer=Buffer.alloc(44+sampleRate*seconds*2);
buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVE',8);buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(sampleRate,24);buffer.writeUInt32LE(sampleRate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(buffer.length-44,40);
for(let i=0;i<sampleRate*seconds;i++)buffer.writeInt16LE(Math.sin(i/sampleRate*Math.PI*2*220)*2000,44+i*2);
await fs.writeFile(path.join(music,'01 - Desktop Test.wav'),taggedWav(buffer,{...tags,albumArtist:'Tagged Album Artist',trackNumber:3,discNumber:1}));
const profile=path.join(root,'profile');await fs.mkdir(profile,{recursive:true});
let errors=[];
async function launch() {
 const options={...(process.env.MANDO_TEST_EXECUTABLE ? {executablePath:path.resolve(process.env.MANDO_TEST_EXECUTABLE),args:[]} : {args:['.']}),env:{...process.env,MANDO_TEST_PROFILE:profile},timeout:30000};
 const instance=await electron.launch(options);const page=await instance.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForLoadState();return {instance,page};
}
let instance;
try {
 let session=await launch();instance=session.instance;let page=session.page;
 await expect(page.locator('#page-title')).toHaveText('Your music, in motion.');
 assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
 await instance.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},path.join(root,'Music'));
 await page.locator('#add-folder').click();await expect(page.locator('.track-row')).toHaveCount(1);
 await expect(page.locator('.track-name small')).toHaveText('Tagged Artist');
 await expect(page.locator('.album-cell')).toHaveText('Tagged Album');
 await expect(page.locator('.row-duration')).toHaveText('0:08');
 await expect.poll(()=>page.locator('.mini-cover img').evaluate(image=>image.complete && image.naturalWidth>0)).toBe(true);
 await page.evaluate(() => {
  const original = AudioContext.prototype.createMediaElementSource;
  AudioContext.prototype.createMediaElementSource = function(element) {
    const node = original.call(this,element), analyser = this.createAnalyser();
    node.connect(analyser); window.audioProbe = { element, analyser }; return node;
  };
 });
 await page.getByRole('button',{name:'Play Desktop Test',exact:true}).click();await expect(page.locator('#duration')).toHaveText('0:08');
 await expect(page.locator('#now-artist')).toHaveText('Tagged Artist');
 await expect.poll(()=>page.locator('#cover img').evaluate(image=>image.complete && image.naturalWidth>0)).toBe(true);
 await expect(page.locator('#milkdrop')).toHaveClass('ready',{timeout:45000});
 await expect.poll(()=>page.locator('#elapsed').textContent()).not.toBe('0:00');
 // An advancing clock does not prove audible audio: a CORS-tainted source outputs zeros.
 await expect.poll(() => page.evaluate(() => {
   const analyser=window.audioProbe.analyser, samples=new Float32Array(analyser.fftSize);
   analyser.getFloatTimeDomainData(samples);
   return Math.sqrt(samples.reduce((sum,sample)=>sum+sample*sample,0)/samples.length);
 })).toBeGreaterThan(0.01);
 await expect.poll(() => instance.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].webContents.isCurrentlyAudible())).toBe(true);
 assert.equal(await page.evaluate(()=>window.audioProbe.element.crossOrigin),'anonymous');
 const range=await page.evaluate(async()=>{const library=await window.mandoDesktop.restoreFolder();const response=await fetch(library.tracks[0].url,{headers:{Range:'bytes=44-63'}});return {status:response.status,length:(await response.arrayBuffer()).byteLength,range:response.headers.get('content-range')};});
 assert.equal(range.status,206);assert.equal(range.length,20);assert.match(range.range,/bytes 44-63\//);
 const denied=await page.evaluate(async()=>{const response=await fetch('mando://music/not-authorized');return response.status;});assert.equal(denied,404);
 await page.locator('#seek').fill('5');await expect.poll(()=>page.locator('#elapsed').textContent()).toMatch(/0:0[5-7]/);
 await page.locator('#play').click();
 await page.locator('#fullscreen').click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);await page.evaluate(()=>document.exitFullscreen());
 await page.screenshot({path:path.join(root,'desktop-window.png')});
 await page.locator('#nav-albums').click();
 await expect(page.locator('.album-card')).toHaveCount(1);
 await expect.poll(()=>page.locator('.album-card img').evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
 await page.screenshot({path:path.join(root,'album-grid.png')});
 await page.getByRole('button',{name:'Open album Tagged Album by Tagged Album Artist',exact:true}).click();
 await expect(page.locator('#album-detail h2')).toHaveText('Tagged Album');
 await expect(page.locator('.row-number')).toHaveText('03');
 await page.locator('#play-album').click();await expect(page.locator('#now-title')).toHaveText('Desktop Test');
 await expect(page.locator('#elapsed')).toHaveText('0:00');
 await expect.poll(()=>instance.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.isCurrentlyAudible())).toBe(true);
 await page.locator('#play').click();
 await page.screenshot({path:path.join(root,'album-detail.png')});
 await instance.close();instance=null;
 session=await launch();instance=session.instance;page=session.page;
 await expect(page.locator('.track-row')).toHaveCount(1);await expect(page.locator('#folder-name')).toHaveText('Music');
 await instance.close();instance=null;
 assert.deepEqual(errors,[]);console.log('Desktop checks passed: native folder selection, nonzero audio signal and audible output, playback, MilkDrop, byte-range streaming, seeking, fullscreen, isolated renderer, and folder restoration after restart.');
} finally { if(instance)await instance.close(); }
