import { readFileSync } from 'node:fs';
export const artwork = readFileSync(new URL('../../build/icon.png',import.meta.url));
export const tags={title:'Desktop Test',artist:'Tagged Artist',album:'Tagged Album'};
const uint32be=value=>{const b=Buffer.alloc(4);b.writeUInt32BE(value);return b;};
const uint32le=value=>{const b=Buffer.alloc(4);b.writeUInt32LE(value);return b;};
function id3Frame(name,data){return Buffer.concat([Buffer.from(name),uint32be(data.length),Buffer.alloc(2),data]);}
export function taggedWav(wav,values=tags){
 const frames=Buffer.concat([
  ...Object.entries({TIT2:values.title,TPE1:values.artist,TALB:values.album,TCON:values.genre,TPE2:values.albumArtist,TRCK:values.trackNumber===undefined?undefined:String(values.trackNumber),TPOS:values.discNumber===undefined?undefined:String(values.discNumber)}).filter(([,value])=>value!==undefined).map(([name,value])=>id3Frame(name,Buffer.concat([Buffer.from([1,255,254]),Buffer.from(value,'utf16le')]))),
  id3Frame('APIC',Buffer.concat([Buffer.from([0]),Buffer.from('image/png\0'),Buffer.from([3,0]),artwork]))
 ]);
 const size=frames.length,header=Buffer.from([73,68,51,3,0,0,(size>>21)&127,(size>>14)&127,(size>>7)&127,size&127]);
 const id3=Buffer.concat([header,frames]);
 const result=Buffer.concat([wav,Buffer.from('id3 '),uint32le(id3.length),id3,...(id3.length%2?[Buffer.alloc(1)]:[])]);result.writeUInt32LE(result.length-8,4);return result;
}
export function taggedFlac(){
 const block=(type,bytes,last=false)=>{const h=Buffer.alloc(4);h[0]=type|(last?128:0);h.writeUIntBE(bytes.length,1,3);return Buffer.concat([h,bytes]);};
 const stream=Buffer.alloc(34);stream.writeUInt16BE(4096,0);stream.writeUInt16BE(4096,2);stream.writeBigUInt64BE((22050n<<44n)|(15n<<36n)|176400n,10);
 const entries=Object.entries(tags).map(([key,value])=>Buffer.from(`${key.toUpperCase()}=${value}`));
 const comments=Buffer.concat([uint32le(5),Buffer.from('Mando'),uint32le(entries.length),...entries.flatMap(b=>[uint32le(b.length),b])]);
 const mime=Buffer.from('image/png');const picture=Buffer.concat([uint32be(3),uint32be(mime.length),mime,uint32be(0),uint32be(256),uint32be(256),uint32be(24),uint32be(0),uint32be(artwork.length),artwork]);
 return Buffer.concat([Buffer.from('fLaC'),block(0,stream),block(4,comments),block(6,picture,true)]);
}
export function sineWav(seconds=8){const rate=22050,b=Buffer.alloc(44+rate*seconds*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);for(let i=0;i<rate*seconds;i++)b.writeInt16LE(Math.sin(i/rate*Math.PI*2*220)*2000,44+i*2);return b;}
