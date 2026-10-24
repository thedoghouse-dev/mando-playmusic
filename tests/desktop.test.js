import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { scanFolder, parseRange } from '../desktop/library.mjs';
test('native folder scan includes nested audio, skips non-audio, and issues opaque URLs',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'mando-scan-'));
 try {await mkdir(path.join(root,'Artist','Album'),{recursive:true});await writeFile(path.join(root,'Artist','Album','song.FLAC'),'audio');await writeFile(path.join(root,'cover.jpg'),'image');
 const {library,allowed}=await scanFolder(root);assert.equal(library.tracks.length,1);assert.equal(library.tracks[0].name,'song.FLAC');assert.match(library.tracks[0].path,/Artist\/Album\/song.FLAC$/);assert.match(library.tracks[0].url,/^mando:\/\/music\/[a-f0-9-]+$/);assert.equal(allowed.size,1);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('range parsing supports seeking and rejects invalid ranges',()=>{
 assert.equal(parseRange(null,100),null);assert.deepEqual(parseRange('bytes=10-19',100),{start:10,end:19});assert.deepEqual(parseRange('bytes=50-',100),{start:50,end:99});assert.deepEqual(parseRange('bytes=-20',100),{start:80,end:99});assert.deepEqual(parseRange('bytes=90-200',100),{start:90,end:99});for(const range of ['bytes=100-','bytes=20-10','bytes=-0','bytes=1-2,4-5','bytes=-','bad'])assert.equal(parseRange(range,100),false);
});
