const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, nativeImage, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const {resolveVisualizerState}=require('./window-state.cjs');
const { Readable } = require('node:stream');
protocol.registerSchemesAsPrivileged([{ scheme: 'mando', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
app.setAppUserModelId('com.mandomusic.player');
let visualWindow,outputClosing=false,closingPlayer=false,quitting=false,saveVisualTimer;
let window, allowedFiles = new Map(), folderOperation;
const testProfile = process.env.MANDO_TEST_PROFILE;
if (testProfile) app.setPath('userData', testProfile);
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
app.on('second-instance', () => { if (window) { if(window.isMinimized()) window.restore(); window.show(); window.focus(); } });
function command(name) { window?.webContents.send('player:command', name); }
const contentTypes = { '.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.oga':'audio/ogg','.flac':'audio/flac','.m4a':'audio/mp4','.aac':'audio/aac','.opus':'audio/ogg','.webm':'audio/webm','.aif':'audio/aiff','.aiff':'audio/aiff' };
async function main() {
  const { scanFolder, parseRange } = await import('./library.mjs');
  const { parseFile, selectCover } = await import('music-metadata');
  const { createArtworkLoader } = await import('./artwork.mjs');
  const { createCoverService } = await import('./cover-downloads.mjs');
  const coverService=createCoverService({directory:path.join(app.getPath('userData'),'downloaded-covers'),nativeImage,version:app.getVersion()});
  const artwork = createArtworkLoader({parseFile,selectCover,nativeImage,downloaded:coverService.read});
  const visualStatePath=path.join(app.getPath('userData'),'visualizer-window.json');
  let savedVisualState;try{savedVisualState=JSON.parse(fs.readFileSync(visualStatePath,'utf8'));}catch{}
  function writeVisualState(state){savedVisualState=state;try{fs.mkdirSync(path.dirname(visualStatePath),{recursive:true});fs.writeFileSync(visualStatePath+'.tmp',JSON.stringify(state));fs.renameSync(visualStatePath+'.tmp',visualStatePath);}catch(error){console.error('Could not save visualizer window:',error.message);}}
  function persistOutput(open){
    if(!visualWindow||visualWindow.isDestroyed()||outputClosing)return;
    const display=screen.getDisplayMatching(visualWindow.getBounds());
    writeVisualState({open,displayId:display.id,workArea:display.workArea,bounds:visualWindow.getNormalBounds(),fullscreen:visualWindow.isFullScreen()});
  }
  function queueVisualSave(){clearTimeout(saveVisualTimer);if(!closingPlayer&&!quitting&&!outputClosing)saveVisualTimer=setTimeout(()=>{if(!closingPlayer&&!quitting&&!outputClosing)persistOutput(true);},200);}
  app.on('before-quit',()=>{quitting=true;clearTimeout(saveVisualTimer);persistOutput(true);});
  const settingsPath = path.join(app.getPath('userData'), 'music-folder.json');
  async function savedFolder() { try { const settings = JSON.parse(await fsp.readFile(settingsPath,'utf8')); return typeof settings.folder === 'string' ? settings.folder : null; } catch { return null; } }
  async function importFolder(root) {
    const result = await scanFolder(root);
    artwork.clear();
    // Keep previous tokens valid until the renderer has stopped its previous track.
    for (const [token,file] of result.allowed) allowedFiles.set(token,file);
    if (allowedFiles.size > result.allowed.size * 2 + 1000) allowedFiles = result.allowed;
    return result.library;
  }
  function trusted(event) { if (event.sender !== window?.webContents || event.senderFrame !== event.sender.mainFrame || event.senderFrame?.url !== 'mando://app/index.html') throw new Error('Unauthorized request'); }
  async function serialize(operation) { if (folderOperation) return null; folderOperation = operation(); try { return await folderOperation; } finally { folderOperation = null; } }
  ipcMain.handle('library:choose', async event => {
    trusted(event);
    return serialize(async () => {
      const picked = await dialog.showOpenDialog(window, { title:'Choose your music folder', properties:['openDirectory'], defaultPath: await savedFolder() || app.getPath('music') });
      if (picked.canceled || !picked.filePaths.length) return null;
      const root = picked.filePaths[0], library = await importFolder(root);
      await fsp.mkdir(path.dirname(settingsPath),{recursive:true});
      await fsp.writeFile(settingsPath, JSON.stringify({folder:root}));
      return library;
    });
  });
  ipcMain.handle('library:restore', async event => { trusted(event); return serialize(async () => { const root = await savedFolder(); return root ? importFolder(root) : null; }); });
  function coverFiles(urls){
    if(!Array.isArray(urls)||!urls.length||urls.length>2000)throw Error('Choose an available album.');
    const files=urls.map(value=>{const url=new URL(value);if(url.protocol!=='mando:'||url.hostname!=='music')throw Error('Invalid track.');const file=allowedFiles.get(url.pathname.slice(1));if(!file)throw Error('The album is no longer available.');return file;});
    return files;
  }
  ipcMain.handle('covers:has-artwork',async(event,urls)=>{
    trusted(event);
    for(const file of coverFiles(urls))if(await artwork(file))return true;
    return false;
  });
  let coverSaving=false;
  ipcMain.handle('covers:search',async(event,artist,album)=>{trusted(event);return coverService.search(artist,album);});
  ipcMain.handle('covers:preview',async(event,id)=>{trusted(event);const bytes=await coverService.preview(id);return 'data:image/png;base64,'+bytes.toString('base64');});
  ipcMain.handle('covers:save',async(event,id,urls)=>{
    trusted(event);
    if(coverSaving)throw Error('A cover is already being saved.');
    const files=coverFiles(urls);
    coverSaving=true;try{await coverService.save(id,files);artwork.clear();return true;}finally{coverSaving=false;}
  });
  function trustedOutput(event){if(event.sender!==visualWindow?.webContents||event.senderFrame!==event.sender.mainFrame||event.senderFrame?.url!=='mando://app/visualizer-window.html')throw Error('Unauthorized request');}
  function toggleOutputFullscreen(){if(visualWindow&&!visualWindow.isDestroyed())visualWindow.setFullScreen(!visualWindow.isFullScreen());}
  ipcMain.handle('visualizer:restore',event=>{trusted(event);return savedVisualState?.open===true;});
  ipcMain.handle('visualizer:open',async event=>{
    trusted(event);
    if(visualWindow&&!visualWindow.isDestroyed()){if(visualWindow.isMinimized())visualWindow.restore();visualWindow.show();visualWindow.focus();return;}
    const current=screen.getDisplayMatching(window.getBounds()),displays=screen.getAllDisplays();
    const fallback=savedVisualState?screen.getPrimaryDisplay():displays.find(d=>d.id!==current.id)||current;
    const restored=resolveVisualizerState(savedVisualState,displays,fallback),bounds=restored.bounds;
    outputClosing=false;const output=visualWindow=new BrowserWindow({...bounds,minWidth:400,minHeight:300,title:'Mando Play Music · Visualizer',backgroundColor:'#07100d',show:false,icon:path.join(__dirname,'../build/icon.png'),webPreferences:{preload:path.join(__dirname,'visualizer-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
    output.setMenu(null);output.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    output.webContents.on('will-navigate',(event,url)=>{if(url!=='mando://app/visualizer-window.html')event.preventDefault();});
    output.webContents.on('before-input-event',(event,input)=>{if(input.type!=='keyDown'||input.control||input.alt||input.meta)return;const key=input.key.toLowerCase();if(key==='f'||key==='f11'){event.preventDefault();toggleOutputFullscreen();}else if(key==='escape'&&output.isFullScreen()){event.preventDefault();output.setFullScreen(false);}});
    for(const [name,value]of [['enter-full-screen',true],['leave-full-screen',false]])output.on(name,()=>{output.webContents.send('visualizer:fullscreen',value);if(!closingPlayer&&!quitting&&!outputClosing)persistOutput(true);});
    output.once('ready-to-show',()=>{if(restored.fullscreen)output.setFullScreen(true);output.show();persistOutput(true);});
    output.on('move',queueVisualSave);output.on('resize',queueVisualSave);
    output.on('close',()=>{clearTimeout(saveVisualTimer);if(!closingPlayer&&!quitting&&!outputClosing)persistOutput(false);outputClosing=true;});
    output.on('closed',()=>{clearTimeout(saveVisualTimer);if(!closingPlayer&&!quitting&&savedVisualState)writeVisualState({...savedVisualState,open:false});visualWindow=null;if(window&&!window.isDestroyed())window.webContents.send('visualizer:closed');});
    try{await output.loadURL('mando://app/visualizer-window.html');}catch(error){output.destroy();throw error;}
  });
  ipcMain.handle('visualizer:fullscreen',event=>{trustedOutput(event);toggleOutputFullscreen();});
  ipcMain.handle('visualizer:exit-fullscreen',event=>{trustedOutput(event);visualWindow.setFullScreen(false);});
  ipcMain.handle('visualizer:focus-player',event=>{trustedOutput(event);if(window.isMinimized())window.restore();window.show();window.focus();});
  protocol.handle('mando', async request => {
    try {
      const url = new URL(request.url);
      if (url.hostname === 'artwork') {
        const file = allowedFiles.get(url.pathname.slice(1));
        if (!file || request.method !== 'GET') return new Response(null,{status:404});
        const bytes = await artwork(file);
        return bytes ? new Response(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=3600'}}) : new Response(null,{status:404});
      }
      if (url.hostname === 'music') {
        const file = allowedFiles.get(url.pathname.slice(1));
        if (!file || !['GET','HEAD'].includes(request.method)) return new Response('Not found',{status:404});
        const info = await fsp.stat(file);
        const range = parseRange(request.headers.get('range'), info.size);
        if (range === false) return new Response(null,{status:416,headers:{'Content-Range':`bytes */${info.size}`}});
        const headers = { 'Content-Type':contentTypes[path.extname(file).toLowerCase()] || 'application/octet-stream','Accept-Ranges':'bytes','Access-Control-Allow-Origin':'mando://app','Content-Length':String(range ? range.end-range.start+1 : info.size) };
        if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${info.size}`;
        const stream = request.method === 'HEAD' ? null : Readable.toWeb(fs.createReadStream(file,range || undefined));
        return new Response(stream,{status:range ? 206 : 200,headers});
      }
      if (url.hostname !== 'app' || !['GET','HEAD'].includes(request.method)) return new Response('Not found',{status:404});
      const root = path.join(app.getAppPath(),'dist');
      const assetPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const target = path.resolve(root,`.${assetPath}`);
      if (!target.startsWith(root+path.sep)) return new Response('Forbidden',{status:403});
      const response = await net.fetch(pathToFileURL(target).toString());
      const headers = new Headers(response.headers);
      if(request.headers.get('origin')==='null' && /\.(js|css|woff2?)$/.test(url.pathname)) headers.set('Access-Control-Allow-Origin','null');
      headers.set('Content-Security-Policy', url.pathname==='/visualizer.html' ? "default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'" : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' mando://artwork blob: data:; media-src 'self' mando: blob:; connect-src 'self' mando:; object-src 'none'; base-uri 'none'; frame-src 'self'");
      return new Response(response.body,{status:response.status,headers});
    } catch { return new Response('File unavailable',{status:404}); }
  });
  window = new BrowserWindow({ width:1320,height:940,minWidth:800,minHeight:600,title:'Mando Play Music',backgroundColor:'#101310',show:false,icon:path.join(__dirname,'../build/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false} });
  window.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  window.webContents.on('will-navigate', (event,url) => { if (url !== 'mando://app/index.html') event.preventDefault(); });
  window.webContents.session.setPermissionRequestHandler((contents,permission,callback) => callback(permission === 'fullscreen' && contents.getURL() === 'mando://app/index.html'));
  window.webContents.session.setPermissionCheckHandler((contents,permission) => permission === 'fullscreen' && contents?.getURL() === 'mando://app/index.html');
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'File',submenu:[{label:'Open music folder…',accelerator:'CmdOrCtrl+O',click:()=>command('open-folder')},{label:'Rescan music folder',accelerator:'F5',click:()=>command('rescan')},{type:'separator'},{role:'quit'}]},
    {label:'Playback',submenu:[{label:'Play / Pause',accelerator:'MediaPlayPause',click:()=>command('play')},{label:'Next track',accelerator:'MediaNextTrack',click:()=>command('next')},{label:'Previous track',accelerator:'MediaPreviousTrack',click:()=>command('previous')}]},
    {label:'View',submenu:[{label:'Open visualizer window',accelerator:'CmdOrCtrl+Shift+V',click:()=>command('popout-visualizer')},{label:'Fullscreen visualizer',accelerator:'F11',click:()=>command('fullscreen')},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'}]},
    {label:'Help',submenu:[{label:'Keyboard shortcuts',click:()=>command('help')},{label:'About Mando Play Music',click:()=>dialog.showMessageBox(window,{type:'info',title:'Mando Play Music',message:`Mando Play Music ${app.getVersion()}`,detail:'Your music, in motion.\nLocal music playback and MilkDrop visuals powered by Butterchurn.'})}]}
  ]));
  window.once('ready-to-show',()=>window.show());
  window.on('close',()=>{closingPlayer=true;clearTimeout(saveVisualTimer);persistOutput(true);});
  window.on('closed',()=>{window=null;if(visualWindow&&!visualWindow.isDestroyed())visualWindow.destroy();});
  await window.loadURL('mando://app/index.html');
}
if (singleInstance) app.whenReady().then(main).catch(error=>{dialog.showErrorBox('Mando Play Music could not start',error.message);app.quit();});
app.on('window-all-closed',()=>app.quit());
