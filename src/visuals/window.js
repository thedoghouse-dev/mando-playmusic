import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/600.css';
import './window.css';
const $=id=>document.getElementById(id),frame=$('output-frame');
const channel=new BroadcastChannel('mando-visualizer-output-v1');
let port,desired,loaded,loading,inFlight=false,latestAudio,toolbarTimer,ready=false,frameReady=false;
function status(message){$('output-status').textContent=message;$('output-status').hidden=!message;}
function showToolbar(){document.body.classList.remove('quiet');clearTimeout(toolbarTimer);toolbarTimer=setTimeout(()=>{if(document.body.classList.contains('fullscreen')&&!document.activeElement?.matches(':focus-visible'))document.body.classList.add('quiet');},2500);}
function applyState(){
 if(!ready||!desired)return;
 port.postMessage({type:'settings',settings:desired.settings});
 if(loading||loaded===desired.entry.id)return;
 const entry=desired.entry;loading=entry.id;status('Loading '+entry.name+'…');
 port.postMessage({type:'load',request:1,id:entry.id,preset:entry.definition,textures:entry.textures,blend:loaded?desired.settings.blend:0});
}
function renderLatest(){if(!ready||!loaded||inFlight||loading||!latestAudio)return;inFlight=true;port.postMessage(latestAudio);}
channel.onmessage=({data})=>{
 if(data?.type==='state'&&data.entry&&data.settings){desired=data;clearInterval(readyTimer);initialize();applyState();}
 else if(data?.type==='render'){latestAudio=data;renderLatest();}
};
const readyTimer=setInterval(()=>channel.postMessage({type:'ready'}),1000);
window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.data?.type!=='mando-frame-ready')return;frameReady=true;initialize();});
function initialize(){
 if(!frameReady||!desired||port)return;
 const link=new MessageChannel();port=link.port1;
 port.onmessage=({data})=>{
  if(data.type==='ready'){ready=true;channel.postMessage({type:'ready'});applyState();}
  else if(data.type==='result'){
   const id=loading;loading=null;
   if(data.ok){loaded=id;frame.classList.add('ready');$('output-preset').textContent=desired?.entry.name||'Mando Visuals';status('');}
   else{loaded=null;status('Could not display preset: '+data.error+'. Choose another preset in the player.');}
   if(desired?.entry.id!==id)applyState();renderLatest();
  }else if(data.type==='frame'){
   inFlight=false;frame.dataset.audioRms=String(Number(data.rms)||0);frame.dataset.frames=String((Number(frame.dataset.frames)||0)+1);
  }else if(data.type==='idle')inFlight=false;
  else if(data.type==='error'){inFlight=false;status('Visualizer stopped: '+data.error+'. Close and reopen this window to retry.');}
 };
 frame.contentWindow.postMessage({type:'mando-init',sampleRate:desired.sampleRate,width:innerWidth,height:innerHeight},'*',[link.port2]);
}
frame.src=new URL('./visualizer.html',location.href).href;
$('output-fullscreen').onclick=()=>window.mandoVisualizer.toggleFullscreen();
$('output-player').onclick=()=>window.mandoVisualizer.focusPlayer();
$('output-previous').onclick=()=>channel.postMessage({type:'step',direction:-1});
$('output-next').onclick=()=>channel.postMessage({type:'step',direction:1});
document.addEventListener('dblclick',event=>{if(!event.target.closest('button'))window.mandoVisualizer.toggleFullscreen();});
document.addEventListener('keydown',event=>{if(!event.ctrlKey&&!event.altKey&&!event.metaKey){if(event.key==='Escape')window.mandoVisualizer.exitFullscreen();else if(event.key.toLowerCase()==='f'||event.key==='F11'){event.preventDefault();window.mandoVisualizer.toggleFullscreen();}}if(event.target.closest('button')&&event.code==='Space')return;if(event.key.toLowerCase()==='n')channel.postMessage({type:'step',direction:1});if(event.key.toLowerCase()==='p')channel.postMessage({type:'step',direction:-1});showToolbar();});
document.addEventListener('pointermove',showToolbar);
window.mandoVisualizer.onFullscreen(value=>{document.body.classList.toggle('fullscreen',value);$('output-fullscreen').textContent=value?'Exit fullscreen':'Fullscreen';showToolbar();});
window.addEventListener('pagehide',()=>{clearInterval(readyTimer);clearTimeout(toolbarTimer);port?.close();channel.close();});
