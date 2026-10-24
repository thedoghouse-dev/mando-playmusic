import butterchurn from 'butterchurn';
import library from 'butterchurn-presets';
import {MANDO_SCENES,makeMandoPreset,customizePreset,normalizeRendererPreset} from './mando-plugin.js';
import {normalizeVisualSettings} from './settings.js';
const helper={sqr:x=>x*x,div:(a,b)=>b?a/b:0,mod:(a,b)=>b?a%b:0,above:(a,b)=>+(a>b),below:(a,b)=>+(a<b),equal:(a,b)=>+(Math.abs(a-b)<.00001),rand:n=>Math.random()*n};
 for(const name of Object.getOwnPropertyNames(Math))if(typeof Math[name]==='function')helper[name]=Math[name];
 Object.assign(globalThis,helper);
let viewportKey='';
function resizeViewport(){
 if(!visualizer)return;
 const canvas=document.querySelector('#scene'),width=Math.max(1,innerWidth),height=Math.max(1,innerHeight);
 const ratio=Math.min(devicePixelRatio||1,1.5,4096/width,4096/height);
 const key=`${width}:${height}:${ratio}`;if(key===viewportKey)return;viewportKey=key;
 // Butterchurn resizes textures, but leaves the output canvas buffer to its host.
 canvas.width=Math.max(1,Math.floor(width*ratio));canvas.height=Math.max(1,Math.floor(height*ratio));
 // Butterchurn output width/height are drawing-buffer pixels, not CSS pixels.
 visualizer.setRendererSize(canvas.width,canvas.height,{pixelRatio:1});
}
window.addEventListener('resize',resizeViewport);
let port,visualizer,settings=normalizeVisualSettings(),signal={pulse:0},busy=false;
const builtins=library.getPresets(),converted=new Map();
function decode(preset){
 if(converted.has(preset.id))return converted.get(preset.id);
 return (async()=>{
  const converter=preset.format==='milk'?await import('milkdrop-preset-converter'):null;
  let result=converter?await (converter.default||converter).convertPreset(preset.source):JSON.parse(preset.source);
  const compile=(object)=>{
   const copy={...object};
   for(const key of ['init_eqs','frame_eqs','pixel_eqs','point_eqs']){
    const text=copy[`${key}_str`];if(typeof text==='string')copy[key]=key==='pixel_eqs'&&!text?'':new Function('a',`${text};return a;`);else if(typeof copy[key]!=='function')copy[key]=key==='pixel_eqs'?'':a=>a;
   }
   return copy;
  };
  result=compile(result);result.waves=(result.waves||[]).map(compile);result.shapes=(result.shapes||[]).map(compile);
  converted.set(preset.id,result);while(converted.size>100)converted.delete(converted.keys().next().value);return result;
 })();
}
const textureCache=new Map(),originalTextures=new Map();
function restoreTexture(name){
 const textures=visualizer.renderer.image.samplers,current=textures[name],original=originalTextures.get(name);
 if(current&&current!==original)visualizer.renderer.gl.deleteTexture(current);
 if(original)textures[name]=original;else delete textures[name];
 textureCache.delete(name);originalTextures.delete(name);
}
async function loadTextures(textures=[]){
 const names=new Set(textures.map(t=>t.name));let pixels=0;
 for(const name of [...textureCache.keys()])if(!names.has(name))restoreTexture(name);
 for(const texture of textures){
  const cached=textureCache.get(texture.name);
  if(cached?.data===texture.data){pixels+=cached.pixels;continue;}
  const image=new Image();image.src=texture.data;await image.decode();pixels+=image.width*image.height;
  if(image.width>4096||image.height>4096||pixels>16*1024*1024)throw Error('Texture pack exceeds its pixel budget.');
  if(cached)restoreTexture(texture.name);
  const renderer=visualizer.renderer,images=renderer.image;
  originalTextures.set(texture.name,images.samplers[texture.name]||null);
  images.samplers[texture.name]=renderer.gl.createTexture();images.bindTexture(images.samplers[texture.name],image,image.width,image.height);
  textureCache.set(texture.name,{data:texture.data,pixels:image.width*image.height});
 }
}
async function load(data){
 await loadTextures(data.textures);
 let preset=data.preset?await decode(data.preset):data.id.startsWith('mando:')?makeMandoPreset(data.id):builtins[data.id.slice(8)];
 if(!preset)throw Error('Preset is unavailable.');
 visualizer.loadPreset(customizePreset(normalizeRendererPreset(preset),()=>settings,()=>signal),data.blend||0);
}
window.addEventListener('message',event=>{
 if(event.source!==parent||event.data?.type!=='mando-init'||!event.ports[0]||port)return;
 port=event.ports[0];
 try{
  const context=new AudioContext({sampleRate:event.data.sampleRate||44100});
  visualizer=butterchurn.createVisualizer(context,document.querySelector('#scene'),{width:event.data.width,height:event.data.height,pixelRatio:1});
  resizeViewport();
  port.onmessage=async({data})=>{
   try{
    if(data.type==='render'){
     if(busy){port.postMessage({type:'idle'});return;}resizeViewport();signal=data.signal;
     visualizer.render({audioLevels:{timeByteArray:data.mono,timeByteArrayL:data.left,timeByteArrayR:data.right}});
     const message={type:'frame',rms:signal.rms,pulse:signal.pulse};
     if(data.preview && performance.now()-(window.lastPreview||0)>900){window.lastPreview=performance.now();const preview=document.createElement('canvas');preview.width=360;preview.height=200;preview.getContext('2d').drawImage(document.querySelector('#scene'),0,0,360,200);message.preview=preview.toDataURL('image/jpeg',.65);}
     port.postMessage(message);return;
    }
    if(data.type==='settings'){settings=normalizeVisualSettings(data.settings);return;}
    if(data.type==='resize'){resizeViewport();return;}
    if(data.type==='load'){busy=true;try{await load(data);}finally{busy=false;}port.postMessage({type:'result',request:data.request,ok:true});return;}
    if(data.type==='validate'){
     const results=[];busy=true;
     try{await loadTextures(data.textures);for(const preset of data.presets){try{const result=await decode(preset);visualizer.loadPreset(normalizeRendererPreset(result),0);const silent=new Uint8Array(1024).fill(128);visualizer.render({audioLevels:{timeByteArray:silent,timeByteArrayL:silent,timeByteArrayR:silent}});results.push({id:preset.id,ok:true});}catch(error){results.push({id:preset.id,ok:false,error:String(error.message).slice(0,300)});}}}finally{busy=false;}
     port.postMessage({type:'result',request:data.request,ok:true,results});return;
    }
   }catch(error){if(data.request)port.postMessage({type:'result',request:data.request,ok:false,error:String(error.message).slice(0,300)});else port.postMessage({type:'error',error:String(error.message).slice(0,300)});}
  };
  port.postMessage({type:'ready',presets:[...MANDO_SCENES,...Object.keys(builtins).map(name=>({id:'builtin:'+name,name}))]});
 }catch(error){port.postMessage({type:'error',error:String(error.message).slice(0,300)});}
});
parent.postMessage({type:'mando-frame-ready'},'*');
