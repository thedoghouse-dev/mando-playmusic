import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackFromFile, filterTracks, formatTime, nextIndex, AUDIO_EXTENSIONS } from '../src/library.js';
test('imports nested artist/album folders and strips track numbers', () => {
 const track = trackFromFile({name:'03 - Night Drive.flac'},'Music/An Artist/An Album/03 - Night Drive.flac');
 assert.equal(track.title,'Night Drive'); assert.equal(track.artist,'An Artist'); assert.equal(track.album,'An Album'); assert.equal(track.format,'FLAC');
});
test('artist - title filenames and safe filenames remain intact', () => {
 const track = trackFromFile({name:'Artist - Song.mp3'}); assert.equal(track.title,'Song'); assert.equal(track.artist,'Artist');
 assert.equal(trackFromFile({name:'<song>.wav'}).title,'<song>');
});
test('filters favorites and case insensitive artist matches', () => {
 const tracks=[{id:'a',title:'First',artist:'Björk',album:'Debut',path:'a'},{id:'b',title:'Other',artist:'Someone',album:'Album',path:'b'}];
 assert.deepEqual(filterTracks(tracks,'BJÖRK',true,new Set(['a'])),[tracks[0]]); assert.equal(filterTracks(tracks,'',true,new Set()).length,0);
});
test('shuffle avoids replaying current track and handles empty libraries', () => {
 for(let i=0;i<10;i++) assert.notEqual(nextIndex(10,4,1,true,()=>i/10),4);
 assert.equal(nextIndex(0,-1,1,false),-1); assert.equal(nextIndex(3,0,-1,false),2); assert.equal(nextIndex(1,0,1,true),0);
});
test('formats durations and limits imports to audio extensions',()=>{
 assert.equal(formatTime(125.9),'2:05'); assert.equal(formatTime(Infinity),'0:00'); assert.equal(AUDIO_EXTENSIONS.test('track.FLAC'),true); assert.equal(AUDIO_EXTENSIONS.test('cover.jpg'),false);
});
