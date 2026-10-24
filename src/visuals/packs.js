import {unzipSync,strFromU8} from 'fflate';
export const PACK_LIMITS={file:128*1024*1024,expanded:256*1024*1024,preset:2*1024*1024,count:30000,archiveEntries:50000};
function presetEntry(name,value){
 if(typeof value==='string') {if(!/\[preset00\]/i.test(value))throw Error(`${name}: missing [preset00] header`);return {id:crypto.randomUUID(),name,format:'milk',source:value.replace(/\[preset00\]/i,'[preset00]')};}
 if(!value||typeof value!=='object'||Array.isArray(value)||!value.baseVals||typeof value.baseVals!=='object')throw Error(`${name}: invalid converted preset`);
 return {id:crypto.randomUUID(),name,format:'json',source:JSON.stringify(value)};
}
function parsePresetFile(name,source){
 if(source.length>PACK_LIMITS.preset)throw Error(`${name}: preset exceeds 2 MB`);
 const stem=name.split(/[\\/]/).at(-1).replace(/\.(milk|json)$/i,'');
 if(/\.milk$/i.test(name))return [presetEntry(stem,source)];
 const json=JSON.parse(source);
 if(json.format==='mando-visual-pack'&&Array.isArray(json.presets))return json.presets.map(p=>presetEntry(String(p.name||'Untitled'),p.format==='milk'?p.source:typeof p.source==='string'?JSON.parse(p.source):p.preset||p.source));
 if(json.baseVals)return [presetEntry(json.name||stem,json)];
 return Object.entries(json).map(([title,preset])=>presetEntry(title,preset));
}
export function readPackBytes(name,bytes){
 if(bytes.length>PACK_LIMITS.file)throw Error('Pack is larger than 128 MB.');
 const entries=[],errors=[],textures=[];
 if(/\.zip$/i.test(name)){
  let expanded=0,count=0;
  const files=unzipSync(bytes,{filter:file=>{
   if(++count>PACK_LIMITS.archiveEntries)throw Error('ZIP exceeds the 50,000 archive-entry limit.');
   if(/(^|[\\/])\.\.?([\\/]|$)/.test(file.name)||/^[\\/]|^[a-z]:/i.test(file.name))throw Error('ZIP contains an invalid path.');
   const supported=/\.(milk|json|png|jpe?g|webp)$/i.test(file.name)&&!file.name.startsWith('__MACOSX/');
   if(!supported)return false;
   const limit=/\.(milk|json)$/i.test(file.name)?PACK_LIMITS.preset:4*1024*1024;
   if(file.originalSize>limit){errors.push(`${file.name}: file exceeds its size limit; skipped.`);return false;}
   expanded+=file.originalSize;if(expanded>PACK_LIMITS.expanded)throw Error('Supported ZIP contents exceed 256 MB expanded.');
   return true;
  }});
  for(const [filename,content] of Object.entries(files)){try{
    if(/\.(png|jpe?g|webp)$/i.test(filename)){
      if(content.length>4*1024*1024||textures.length>=64)throw Error('Texture skipped (4 MB / 64 image limit).');
      const key=filename.split(/[\\/]/).at(-1).replace(/\.[^.]+$/,'');if(!/^[a-z0-9_-]+$/i.test(key))throw Error('Texture name is not supported.');
      let binary='';for(let i=0;i<content.length;i+=8192)binary+=String.fromCharCode(...content.subarray(i,i+8192));
      const mime=/\.png$/i.test(filename)?'image/png':/\.webp$/i.test(filename)?'image/webp':'image/jpeg';
      textures.push({name:key,data:'data:'+mime+';base64,'+btoa(binary)});
    }else entries.push(...parsePresetFile(filename,strFromU8(content)));
   }catch(error){errors.push(`${filename}: ${error.message}`);}}
 }else{try{entries.push(...parsePresetFile(name,strFromU8(bytes)));}catch(error){errors.push(error.message);}}
 if(entries.length>PACK_LIMITS.count)throw Error('Pack exceeds 30,000 presets. Split it into smaller packs.');
 if(!entries.length)throw Error(errors[0]||'No .milk or converted .json presets found.');
 return {id:crypto.randomUUID(),name:name.replace(/\.(zip|json|milk)$/i,''),presets:entries,textures,errors,installedAt:Date.now()};
}
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('mando-visual-packs',1);r.onupgradeneeded=()=>r.result.createObjectStore('packs',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function transaction(mode,operation){const database=await db();try{return await new Promise((resolve,reject)=>{const tx=database.transaction('packs',mode),request=operation(tx.objectStore('packs'));let result;request.onsuccess=()=>result=request.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Pack storage aborted'));});}finally{database.close();}}
export const packStorage={list:()=>transaction('readonly',s=>s.getAll()),put:pack=>transaction('readwrite',s=>s.put(pack)),remove:id=>transaction('readwrite',s=>s.delete(id))};
