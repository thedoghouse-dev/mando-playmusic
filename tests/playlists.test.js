import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizePlaylists,addPlaylistTracks,movePlaylistTrack,resolvePlaylist} from '../src/playlists.js';
const tracks=['a','b','c'].map(id=>({id,title:id.toUpperCase(),artist:'Artist',album:'Album',url:'mando://music/session-token'}));
const empty={id:'mix',name:'Mix',entries:[]};
test('playlist additions append in supplied order, skip duplicates, and store stable references',()=>{
 const result=addPlaylistTracks(addPlaylistTracks(empty,[tracks[1]]),tracks);
 assert.deepEqual(result.entries.map(e=>e.trackId),['b','a','c']);assert.equal(result.entries[0].title,'B');assert.equal(JSON.stringify(result).includes('session-token'),false);assert.deepEqual(empty.entries,[]);
});
test('reordering keeps every song once and ignores invalid positions',()=>{
 const playlist=addPlaylistTracks(empty,tracks),moved=movePlaylistTrack(playlist,2,0);
 assert.deepEqual(moved.entries.map(e=>e.trackId),['c','a','b']);assert.deepEqual(playlist.entries.map(e=>e.trackId),['a','b','c']);assert.equal(movePlaylistTrack(playlist,-1,0),playlist);assert.equal(movePlaylistTrack(playlist,0,3),playlist);
});
test('missing music stays saved and resolves again when the same files return',()=>{
 const playlist=addPlaylistTracks(empty,tracks),partial=resolvePlaylist(playlist,[tracks[1]]);
 assert.equal(partial.length,3);assert.equal(partial[0].track,null);assert.equal(partial[1].track,tracks[1]);assert.deepEqual(resolvePlaylist(playlist,tracks).map(e=>e.track.id),['a','b','c']);
});
test('saved playlists tolerate malformed entries and duplicate IDs',()=>{
 assert.deepEqual(normalizePlaylists({}),[]);
 const clean=normalizePlaylists([{id:'mix',name:' Mix ',entries:[null,{trackId:'a',title:'A'},{trackId:'a',title:'A'}]},{id:'mix',name:'Duplicate',entries:[]},{id:2,name:'Bad',entries:[]}]);
 assert.equal(clean.length,1);assert.equal(clean[0].name,'Mix');assert.equal(clean[0].entries.length,1);
});
