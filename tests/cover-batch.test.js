import {test} from 'node:test';
import assert from 'node:assert/strict';
import {downloadMissingCovers,exactCoverMatch} from '../shared/cover-batch.js';
const album=title=>({title,artist:'Test Artist',tracks:[{url:title}]});
const match=title=>({id:title,title,artist:'Test Artist'});
test('bulk matching accepts case/punctuation, skips editions, different artists and ambiguity',()=>{
 assert.equal(exactCoverMatch(album('Test Album'),[{...match('test-album'),id:'yes'}]).id,'yes');
 for(const results of [[match('Test Album (Deluxe)')],[{...match('Test Album'),artist:'Other'}],[match('Test Album'),match('Test Album')]])assert.equal(exactCoverMatch(album('Test Album'),results),null);
 assert.equal(exactCoverMatch({...album('Test Album'),artist:'Unknown artist'},[match('Test Album')]),null);
});
test('bulk skips existing artwork, paces missing searches, rechecks before save and reports results',async()=>{
 const searched=[],saved=[],phases=[];let checks=0,waits=0;
 const summary=await downloadMissingCovers(['Existing','Download','Unmatched','Appeared'].map(album),{
  hasArtwork:async a=>a.title==='Existing'||(a.title==='Appeared'&&++checks===2),
  search:async(artist,title)=>{searched.push(title);return title==='Unmatched'?[]:[match(title)];},
  preview:async()=>{},save:async(id)=>saved.push(id),wait:async ms=>{assert.equal(ms,1200);waits++;},onProgress:event=>phases.push(event.phase)
 });
 assert.deepEqual(searched,['Download','Unmatched','Appeared']);assert.deepEqual(saved,['Download']);assert.equal(waits,3);
 assert.equal(summary.saved,1);assert.equal(summary.existing,2);assert.equal(summary.unmatched,1);assert.equal(summary.checked,4);assert.equal(phases.at(-1),'done');
});
test('stop during search does not start a preview or save',async()=>{
 let stop=false;
 const summary=await downloadMissingCovers([album('First'),album('Second')],{hasArtwork:async()=>false,search:async()=>{stop=true;return[match('First')];},preview:async()=>assert.fail('preview after stop'),save:async()=>assert.fail('save after stop'),wait:async()=>{},stopped:()=>stop});
 assert.equal(summary.stopped,true);assert.equal(summary.saved,0);
});
test('search failures pause the bulk run rather than repeatedly querying the provider',async()=>{
 let requests=0;
 const summary=await downloadMissingCovers([album('First'),album('Second')],{hasArtwork:async()=>false,search:async()=>{requests++;throw Error('Service busy');},wait:async()=>{}});
 assert.equal(summary.paused,true);assert.equal(summary.failed,1);assert.equal(requests,1);assert.match(summary.reason,/Service busy/);
});
