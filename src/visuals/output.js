// Only the trusted player and output wrapper share this channel. Imported presets
// run in opaque-origin sandboxed frames and cannot join it.
export class VisualizerOutput {
 constructor(manager){
  this.manager=manager;this.active=false;
  if(!window.mandoDesktop?.openVisualizer)return;
  this.channel=new BroadcastChannel('mando-visualizer-output-v1');
  this.channel.onmessage=({data})=>{
   if(data?.type==='ready'){this.active=true;this.sync();}
   else if(data?.type==='step'&&this.active&&(data.direction===1||data.direction===-1))this.manager.step(data.direction);
  };
  this.unsubscribe=window.mandoDesktop.onVisualizerClosed(()=>{this.active=false;});
 }
 async restore(){try{if(await window.mandoDesktop?.restoreVisualizer?.())await this.open();}catch(error){this.manager.toast('Could not restore visualizer window: '+error.message);}}
 async open(){
  if(!this.channel)return;
  try{await this.manager.ensureAudio();await window.mandoDesktop.openVisualizer();this.active=true;this.sync();}
  catch(error){this.manager.toast('Could not open visualizer window: '+error.message);}
 }
 sync(){
  if(!this.active)return;
  const entry=this.manager.catalog.find(e=>e.id===this.manager.settings.presetId);if(!entry)return;
  this.channel.postMessage({type:'state',sampleRate:this.manager.context.sampleRate,settings:this.manager.settings,entry:{id:entry.id,name:entry.name,definition:entry.definition,textures:entry.textures||[]}});
 }
 sendAudio(samples){if(this.active)this.channel?.postMessage({...samples,preview:false});}
 dispose(){this.active=false;this.unsubscribe?.();this.channel?.close();}
}
