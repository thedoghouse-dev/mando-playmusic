import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {parseBuffer,selectCover} from 'music-metadata';
import {scanFolder} from '../desktop/library.mjs';
import {trackFromFile} from '../src/library.js';
import {applyMetadata,metadataFields} from '../shared/metadata.js';
import {taggedWav,taggedFlac,sineWav,artwork,tags} from './fixtures/tagged-audio.js';
test('ID3 and FLAC/Vorbis tags and embedded front artwork are parsed',async()=>{
 for(const [buffer,type] of [[taggedWav(sineWav()),'audio/wav'],[taggedFlac(),'audio/flac']]){
  const parsed=await parseBuffer(buffer,{mimeType:type});const fields=metadataFields(parsed);
  for(const field of ['title','artist','album'])assert.equal(fields[field],tags[field]);
  assert.ok(fields.duration>0);assert.deepEqual(Buffer.from(selectCover(parsed.common.picture).data),artwork);
 }
});
test('native scan prefers tags without losing unreadable or untagged files',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'mando-tags-'));
 try{
  await writeFile(path.join(root,'Wrong Artist - Wrong Title.wav'),taggedWav(sineWav()));await writeFile(path.join(root,'Plain Song.wav'),sineWav());await writeFile(path.join(root,'Damaged.mp3'),'broken tags');
  const {library}=await scanFolder(root);assert.equal(library.tracks.length,3);
  const tagged=library.tracks.find(t=>t.name.startsWith('Wrong'));
  const track=applyMetadata(trackFromFile({name:tagged.name},tagged.path),tagged.metadata);
  assert.equal(track.title,tags.title);assert.equal(track.artist,tags.artist);assert.equal(track.album,tags.album);assert.match(track.artworkUrl,/^mando:\/\/artwork\//);
  const plain=library.tracks.find(t=>t.name==='Plain Song.wav');assert.equal(applyMetadata(trackFromFile({name:plain.name}),plain.metadata).title,'Plain Song');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('blank and partial tags preserve individual fallbacks and stable favorite IDs',()=>{
 const fallback=trackFromFile({name:'Artist - Song.mp3'},'Music/Artist/Album/Artist - Song.mp3');
 const track=applyMetadata(fallback,{title:' Tagged Song ',artist:' ',duration:NaN});
 assert.equal(track.title,'Tagged Song');assert.equal(track.artist,'Artist');assert.equal(track.album,'Album');assert.equal(track.id,fallback.id);assert.equal(track.duration,null);
});
