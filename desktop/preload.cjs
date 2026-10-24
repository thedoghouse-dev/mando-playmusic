const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mandoDesktop', Object.freeze({
  restoreVisualizer: () => ipcRenderer.invoke('visualizer:restore'),
  openVisualizer: () => ipcRenderer.invoke('visualizer:open'),
  onVisualizerClosed: callback => {const listener=()=>callback();ipcRenderer.on('visualizer:closed',listener);return()=>ipcRenderer.removeListener('visualizer:closed',listener);},
  hasAlbumArtwork: urls => ipcRenderer.invoke('covers:has-artwork',urls),
  searchCovers: (artist,album) => ipcRenderer.invoke('covers:search',artist,album),
  previewCover: id => ipcRenderer.invoke('covers:preview',id),
  saveCover: (id,urls) => ipcRenderer.invoke('covers:save',id,urls),
  chooseFolder: () => ipcRenderer.invoke('library:choose'),
  restoreFolder: () => ipcRenderer.invoke('library:restore'),
  onCommand: callback => { const listener = (_event, command) => callback(command); ipcRenderer.on('player:command', listener); return () => ipcRenderer.removeListener('player:command', listener); }
}));
