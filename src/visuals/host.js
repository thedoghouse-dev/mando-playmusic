import {BeatDetector} from './settings.js';
export class VisualizationHost {
 constructor(frame,context,onFrame,onError){
  this.frame=frame;this.context=context;this.onFrame=onFrame;this.onError=onError;this.nodes=new Set();this.requests=new Map();this.sequence=0;this.inFlight=false;this.detector=new BeatDetector();
  this.analyser=context.createAnalyser();this.analyser.fftSize=1024;this.analyser.smoothingTimeConstant=0;
  this.splitter=context.createChannelSplitter(2);this.left=context.createAnalyser();this.right=context.createAnalyser();this.left.fftSize=this.right.fftSize=1024;this.splitter.connect(this.left,0);this.splitter.connect(this.right,1);
  this.monoBytes=new Uint8Array(1024);this.leftBytes=new Uint8Array(1024);this.rightBytes=new Uint8Array(1024);this.frequency=new Float32Array(512);this.latestSignal={beat:false,pulse:0,rms:0};
 }
 start(){return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{window.removeEventListener('message',listener);reject(Error('Visualizer startup timed out. Use Restart visualizer.'));},20000);
  const listener=event=>{
   if(event.source!==this.frame.contentWindow||event.data?.type!=='mando-frame-ready')return;
   window.removeEventListener('message',listener);const channel=new MessageChannel();this.port=channel.port1;
   this.port.onmessage=({data})=>{
    if(data?.type==='ready'){clearTimeout(timer);resolve(data.presets);}
    else if(data?.type==='idle'){this.inFlight=false;}
    else if(data?.type==='result') {const pending=this.requests.get(data.request);if(!pending)return;clearTimeout(pending.timer);this.requests.delete(data.request);data.ok?pending.resolve(data):pending.reject(Error(String(data.error||'Preset failed').slice(0,300)));}
    else if(data?.type==='frame'){this.inFlight=false;this.onFrame?.(data);}
    else if(data?.type==='error'){this.inFlight=false;this.onError?.(String(data.error||'Render failed').slice(0,300));}
   };
   this.frame.contentWindow.postMessage({type:'mando-init',sampleRate:this.context.sampleRate,width:this.frame.clientWidth||800,height:this.frame.clientHeight||350},'*',[channel.port2]);
  };
  window.addEventListener('message',listener);this.frame.src=new URL('./visualizer.html',location.href).href;
 });}
 connectAudio(node){if(this.nodes.has(node))return;node.connect(this.analyser);node.connect(this.splitter);this.nodes.add(node);}
 disconnectAudio(node){if(!this.nodes.has(node))return;try{node.disconnect(this.analyser);node.disconnect(this.splitter);}catch{}this.nodes.delete(node);}
 setSettings(settings){this.settings=settings;this.port?.postMessage({type:'settings',settings});}
 setRendererSize(width,height){this.port?.postMessage({type:'resize',width,height});}
 request(type,payload,timeout=15000){return new Promise((resolve,reject)=>{const request=++this.sequence;const timer=setTimeout(()=>{this.requests.delete(request);reject(Error('Preset took too long. Restart the visualizer and try another.'));},timeout);this.requests.set(request,{resolve,reject,timer});this.port.postMessage({type,request,...payload});});}
 loadPreset(entry,blend){return this.request('load',{id:entry.id,preset:entry.definition,textures:entry.textures||[],blend});}
 validate(presets,textures=[]){return this.request('validate',{presets,textures},30000);}
 render(time,playing,preview=false){
  if(!this.port)return this.latestSignal;
  this.analyser.getByteTimeDomainData(this.monoBytes);this.left.getByteTimeDomainData(this.leftBytes);this.right.getByteTimeDomainData(this.rightBytes);this.analyser.getFloatFrequencyData(this.frequency);
  let rms=0;for(let i=0;i<1024;i++){const v=(this.monoBytes[i]-128)/128;rms+=v*v;}rms=Math.sqrt(rms/1024);
  let bass=0,n=0;for(let i=1;i<this.frequency.length;i++){const hz=i*this.context.sampleRate/1024;if(hz>300)break;bass+=Number.isFinite(this.frequency[i])?Math.pow(10,this.frequency[i]/20):0;n++;}
  this.latestSignal=this.detector.update(playing?bass/Math.max(1,n):0,playing?rms:0,time,this.settings?.sensitivity||1);
  if(!playing){this.monoBytes.fill(128);this.leftBytes.fill(128);this.rightBytes.fill(128);}
  const samples={type:'render',mono:this.monoBytes,left:this.leftBytes,right:this.rightBytes,signal:this.latestSignal,preview};
  this.onSamples?.(samples);
  if(!this.inFlight){this.inFlight=true;this.port.postMessage(samples);}
  return this.latestSignal;
 }
 dispose(){for(const node of [...this.nodes])this.disconnectAudio(node);this.splitter.disconnect();this.port?.close();for(const pending of this.requests.values()){clearTimeout(pending.timer);pending.reject(Error('Visualizer restarted.'));}this.requests.clear();}
}
