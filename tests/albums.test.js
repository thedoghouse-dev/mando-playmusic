import {test} from 'node:test';import assert from 'node:assert/strict';
import {groupAlbums,matchingAlbums,queueTracks} from '../src/albums.js';
import {applyMetadata,metadataFields} from '../shared/metadata.js';
const track=(id,album,artist,extra={})=>({id,album,artist,title:id,path:id,...extra});
test('groups same album by album artist, keeping unrelated same-title albums separate',()=>{
 const tracks=[track('a','Greatest Hits','Singer One'),track('b','Greatest Hits','Singer Two'),track('c','Compilation','Singer One',{albumArtist:'Various Artists'}),track('d','Compilation','Singer Two',{albumArtist:'Various Artists'})];
 const albums=groupAlbums(tracks);assert.equal(albums.length,3);assert.equal(albums.find(a=>a.title==='Compilation').tracks.length,2);
 assert.equal(groupAlbums([track('a',' ALBUM ','Artist'),track('b','album','ARTIST')]).length,1);
});
test('album order follows disc and track tags, with natural filename fallback',()=>{
 const tracks=[track('d2t1','Album','Artist',{discNumber:2,trackNumber:1}),track('d1t2','Album','Artist',{trackNumber:2}),track('d1t1','Album','Artist',{trackNumber:1})];
 assert.deepEqual(groupAlbums(tracks)[0].tracks.map(t=>t.id),['d1t1','d1t2','d2t1']);
 assert.deepEqual(groupAlbums([track('10 Song','Album','Artist'),track('2 Song','Album','Artist')])[0].tracks.map(t=>t.id),['2 Song','10 Song']);
});
test('album search matches artists and songs without shrinking its playback queue',()=>{
 const tracks=[track('first','Album','Artist'),track('second','Album','Artist')];const albums=matchingAlbums(groupAlbums(tracks),'SECOND');assert.equal(albums.length,1);assert.equal(albums[0].tracks.length,2);
 assert.deepEqual(queueTracks(tracks,['second','missing','first']).map(t=>t.id),['second','first']);
});
test('album artist, disc, and track tags survive metadata normalization',()=>{
 const metadata=metadataFields({common:{albumartist:'Various Artists',track:{no:3},disk:{no:2}}});
 const result=applyMetadata(track('id','Album','Singer'),metadata);assert.equal(result.albumArtist,'Various Artists');assert.equal(result.trackNumber,3);assert.equal(result.discNumber,2);
});
