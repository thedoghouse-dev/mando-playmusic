import {test} from 'node:test';import assert from 'node:assert/strict';import {zipSync,strToU8} from 'fflate';
import {DEFAULT_VISUAL_SETTINGS,normalizeVisualSettings,BeatDetector,shouldTransition} from '../src/visuals/settings.js';
import {readPackBytes} from '../src/visuals/packs.js';import {makeMandoPreset,customizePreset,normalizeRendererPreset} from '../src/visuals/mando-plugin.js';
import {MILK_PRESET,CONVERTED_PRESET} from './fixtures/visual-pack.js';
test('visual controls normalize and constrain saved settings',()=>{const s=normalizeVisualSettings({sensitivity:999,colorA:'url(evil)',blend:-2,interval:1,engine:'unknown'});assert.equal(s.sensitivity,3);assert.equal(s.colorA,DEFAULT_VISUAL_SETTINGS.colorA);assert.equal(s.blend,0);assert.equal(s.interval,5);assert.equal(s.engine,'mando');});
test('beat detection needs real signal, suppresses silence, and respects sensitivity',()=>{
 const silence=new BeatDetector();for(let i=0;i<100;i++)assert.equal(silence.update(0,0,i*33,3).beat,false);
 const count=sensitivity=>{const detector=new BeatDetector();let beats=0;for(let i=0;i<200;i++){const energy=i%20===0?.14:.1;beats+=+detector.update(energy,.1,i*33,sensitivity).beat;}return beats;};assert.ok(count(3)>count(.25));
 const d=new BeatDetector();assert.equal(d.update(.4,.1,0).beat,true);assert.equal(d.update(.8,.1,50).beat,false);assert.ok(d.update(.1,.1,150).pulse<1);
});
test('automatic transitions wait for interval and beat, with a bounded fallback',()=>{const s={...DEFAULT_VISUAL_SETTINGS,interval:10};assert.equal(shouldTransition(s,9000,0,true,true),false);assert.equal(shouldTransition(s,10000,0,false,true),false);assert.equal(shouldTransition(s,11000,0,true,true),true);assert.equal(shouldTransition(s,13000,0,false,true),true);assert.equal(shouldTransition(s,20000,0,true,false),false);});
test('ZIP packs import MilkDrop and converted JSON without executing their code',()=>{
 const bytes=zipSync({'demo.milk':strToU8(MILK_PRESET),'json-preset.json':strToU8(JSON.stringify(CONVERTED_PRESET)),'bad.json':strToU8('{broken'),'ignore.js':strToU8('throw Error("not executed")')});
 const pack=readPackBytes('Demo.zip',bytes);assert.equal(pack.name,'Demo');assert.equal(pack.presets.length,2);assert.equal(pack.errors.length,1);assert.deepEqual(pack.presets.map(p=>p.format),['milk','json']);
 assert.throws(()=>readPackBytes('bad.zip',zipSync({'../bad.milk':strToU8(MILK_PRESET)})),/invalid path/);assert.throws(()=>readPackBytes('bad.json',strToU8('{bad')),/JSON/);
});
test('Mando plugin changes palette and beat zoom while Classic keeps original equations',()=>{
 const original=makeMandoPreset('mando:aurora'),m={time:0,bass_att:1,wave_scale:2};let settings=normalizeVisualSettings({colorA:'#ff0000',colorB:'#ff0000'});
 const customized=customizePreset(original,()=>settings,()=>({pulse:1}));const output=customized.frame_eqs({...m});assert.equal(output.wave_r,1);assert.equal(output.wave_g,0);assert.ok(output.zoom>original.frame_eqs({...m}).zoom);
 settings={...settings,engine:'classic'};assert.deepEqual(customized.frame_eqs({...m}),original.frame_eqs({...m}));
});

test('large ZIP collections exceed old file and preset limits without counting unrelated data',()=>{const files={};for(let i=0;i<5200;i++)files['presets/'+i+'.milk']=strToU8(MILK_PRESET);files['unrelated.bin']=new Uint8Array(85*1024*1024);const pack=readPackBytes('Large.zip',zipSync(files));assert.equal(pack.presets.length,5200);});
test('oversized preset is skipped before decompression while valid presets remain usable',()=>{const pack=readPackBytes('Limited.zip',zipSync({'huge.milk':new Uint8Array(3*1024*1024),'valid.milk':strToU8(MILK_PRESET)}));assert.equal(pack.presets.length,1);assert.match(pack.errors[0],/size limit/);});

test('single-shape presets fill the four Butterchurn slots for rendering and blending',()=>{const orbit=normalizeRendererPreset(makeMandoPreset('mando:orbit'));assert.equal(orbit.shapes.length,4);assert.equal(orbit.shapes[0].baseVals.enabled,1);assert.equal(orbit.shapes[3].baseVals.enabled,0);assert.equal(orbit.waves.length,0);});
