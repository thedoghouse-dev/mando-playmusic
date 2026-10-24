import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCoverService} from '../desktop/cover-downloads.mjs';
const id='12345678-1234-1234-1234-123456789abc';
test('cover search quotes entered terms, identifies the app, and throttles repeated requests',async()=>{
 let calls=0;
 const service=createCoverService({directory:'.',version:'test',fetch:async(url,options)=>{
   calls++;assert.equal(url.hostname,'musicbrainz.org');assert.equal(url.searchParams.get('query'),'releasegroup:"Album\\" OR *" AND artist:"Artist"');assert.match(options.headers['User-Agent'],/MandoPlayMusic\/test/);
   return new Response(JSON.stringify({'release-groups':[{id,title:'Album','artist-credit':[{name:'Artist'}]},{id:'invalid'}]}));
 }});
 assert.equal((await service.search('Artist','Album" OR *')).length,1);
 await assert.rejects(service.search('Artist','Album'),/wait a moment/);assert.equal(calls,1);
});
test('invalid input and saving before preview cannot make requests or write files',async()=>{
 const service=createCoverService({directory:'.',fetch:async()=>{throw Error('Unexpected request');}});
 await assert.rejects(service.search('a',''),/Enter an artist/);
 await assert.rejects(service.preview('../escape'),/Choose an album/);
 await assert.rejects(service.save(id,['track']),/Preview this cover/);
});
test('missing covers, busy services, and oversized responses have actionable errors',async()=>{
 const make=fetch=>createCoverService({directory:'.',version:'test',fetch});
 await assert.rejects(make(async()=>new Response(null,{status:404})).preview(id),/No front cover/);
 await assert.rejects(make(async()=>new Response(null,{status:503})).search('Artist','Album'),/busy/);
 await assert.rejects(make(async()=>new Response('x',{headers:{'content-length':'99999999'}})).preview(id),/too large/);
 await assert.rejects(make(async()=>{throw new TypeError('fetch failed');}).search('Artist','Album'),/internet connection/);
});
