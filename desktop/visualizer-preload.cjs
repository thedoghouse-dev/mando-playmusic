const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('mandoVisualizer',Object.freeze({
 exitFullscreen:()=>ipcRenderer.invoke('visualizer:exit-fullscreen'),
 toggleFullscreen:()=>ipcRenderer.invoke('visualizer:fullscreen'),
 focusPlayer:()=>ipcRenderer.invoke('visualizer:focus-player'),
 onFullscreen:callback=>{const listener=(_event,value)=>callback(value===true);ipcRenderer.on('visualizer:fullscreen',listener);return()=>ipcRenderer.removeListener('visualizer:fullscreen',listener);}
}));
