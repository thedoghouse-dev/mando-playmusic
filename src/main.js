import {genreOptions,filterByGenre,matchesGenre} from '../shared/genres.js';
import {VisualizerOutput} from './visuals/output.js';
import {VisualizationManager,managerMarkup} from './visuals/manager.js';
import { normalizePlaylists, addPlaylistTracks, movePlaylistTrack, resolvePlaylist } from './playlists.js';
import { groupAlbums, matchingAlbums, queueTracks } from './albums.js';
import { applyMetadata } from '../shared/metadata.js';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/800.css';
import { createIcons, icons } from 'lucide';
import './style.css';
import { AUDIO_EXTENSIONS, trackFromFile, formatTime, filterTracks, nextIndex, compareLibraryItems } from './library.js';
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const $ = id => document.getElementById(id);
const readSetting = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const state = { tracks: [], current: -1, view: 'all', query: '', genre:'', genreResults:[], albumId: null, albumSearch: '', queue: [], activePlaylistId: null, playlistId: null, playlists: normalizePlaylists(readSetting('mando-playlists-v1', [])), shuffle: false, repeat: false, favorites: new Set(readSetting('mando-favorites', [])), volume: readSetting('mando-volume', 0.75), preset: 0, auto: true, importing: false };
let audioContext, source, visualizer, presets, presetNames = [], objectUrl, demo, demoNodes = [], frame, lastPreset = performance.now(), visualizerPromise;
const audio = new Audio();
// Native streams use mando://music, a different origin from mando://app.
// Request CORS access before setting src so Web Audio can output their samples.
audio.crossOrigin = 'anonymous';
audio.preload = 'metadata';
audio.volume = state.volume;
document.querySelector('#app').innerHTML = `
<aside class="sidebar">
  <a class="brand" href="/" aria-label="Mando home"><span class="brand-mark">${icon('audio-lines')}</span>mando<span class="brand-dot">.</span></a>
  <div class="workspace-label">YOUR LISTENING SPACE</div>
  <nav aria-label="Music library">
    <button class="nav-item active" id="nav-all">${icon('library')}<span>All music</span><span class="nav-count" id="side-count">0</span></button>
    <button class="nav-item" id="nav-albums">${icon('disc-3')}<span>Albums</span><span class="nav-count" id="album-count">0</span></button>
    <button class="nav-item" id="nav-playlists">${icon('list-music')}<span>Playlists</span><span class="nav-count" id="playlist-count">0</span></button>
    <button class="nav-item" id="nav-favorites">${icon('heart')}<span>Favorites</span><span class="nav-count" id="favorite-count">0</span></button>
    <button class="nav-item" id="nav-visualizer">${icon('orbit')}<span>Visualizer</span><span class="tiny-dot"></span></button>
  </nav>
  <div class="sidebar-heading"><span>YOUR FOLDERS</span><button id="add-folder-small" class="icon-button" aria-label="Add music folder">${icon('plus')}</button></div>
  <button id="folder-entry" class="folder-entry">${icon('folder')}<span id="folder-name">No folder connected</span></button>
  <div class="sidebar-heading playlists-heading"><span>YOUR PLAYLISTS</span><button id="new-playlist-small" class="icon-button" aria-label="Create playlist">${icon('plus')}</button></div><div id="sidebar-playlists" class="sidebar-playlists"></div>
  <div class="sidebar-bottom"><span class="local-indicator"></span><div>Locally played. Yours forever.<small>Your music stays on your device.</small></div></div>
</aside>
<main>
  <header><div class="breadcrumb">Your library <span>/</span> <strong id="breadcrumb">All music</strong></div><div class="header-right"><span class="local-badge">${icon('hard-drive')} LOCAL PLAYER</span><button class="icon-button" id="help" aria-label="Keyboard shortcuts and help">${icon('circle-help')}</button></div></header>
  <section class="page-heading"><div><div class="eyebrow">GOOD MUSIC. NO DISTRACTIONS.</div><h1 id="page-title">Your music, <span>in motion.</span></h1><p>A familiar feeling. A whole new frequency.</p></div><button class="primary" id="add-folder">${icon('folder-plus')} Open music folder</button></section>
  <section class="visualizer-panel" id="visualizer-panel" aria-label="Music visualizer">
    <canvas id="ambient"></canvas><iframe id="milkdrop" title="MilkDrop visualizer" sandbox="allow-scripts"></iframe><div class="visualizer-shade"></div>
    <div class="visualizer-top"><span class="viz-badge"><span></span> LIVE VISUALIZER</span><div class="visualizer-actions"><button id="auto" class="glass-button active" title="Automatically change presets" aria-pressed="true">${icon('shuffle')} Auto</button><button id="popout-visualizer" class="glass-button" aria-label="Open visualizer in separate window" hidden>${icon('external-link')} Pop out</button><button id="fullscreen" class="glass-button square" aria-label="Fullscreen visualizer">${icon('maximize')}</button></div></div>
    <div class="visualizer-center" id="visualizer-intro"><div class="orbit-symbol">${icon('orbit')}</div><h2>See what you hear.</h2><p>Your music comes alive with MilkDrop visuals.</p><button id="demo" class="demo-button">${icon('play')} Try a sound & visual demo</button></div>
    <div class="visualizer-bottom"><div><div class="preset-eyebrow">MILKDROP / BUTTERCHURN</div><button id="preset-label" class="preset-label" title="Choose a visualizer preset">Electric daydream ${icon('chevron-down')}</button></div><div class="preset-controls"><button id="preset-prev" class="glass-button square" aria-label="Previous visualizer preset">${icon('chevron-left')}</button><button id="preset-next" class="glass-button square" aria-label="Next visualizer preset">${icon('chevron-right')}</button></div></div>
  </section>
  <section class="library-section"><div class="library-toolbar"><div class="library-tabs"><button class="tab active" id="tab-tracks">Tracks <span id="track-count">0</span></button><button class="tab" id="tab-albums">Albums <span id="album-tab-count">0</span></button><span id="library-caption">Your personal rotation</span></div><label class="search">${icon('search')}<input id="search" type="search" placeholder="Search your music" aria-label="Search your music"><kbd>/</kbd></label><select id="sort" aria-label="Sort tracks"><option value="title">Title A–Z</option><option value="artist">Artist A–Z</option><option value="album">Album A–Z</option><option value="genre">Genre A–Z</option></select></div>
<div id="genre-bar" class="genre-bar"><label for="genre-filter">Genre<select id="genre-filter" aria-label="Filter by genre"><option value="">All genres</option></select></label><span id="genre-match-count" role="status" aria-live="polite"></span><div id="genre-actions" class="genre-actions" hidden><button id="play-genre" class="primary">${icon('play')} Play genre</button><button id="shuffle-genre" class="secondary">${icon('shuffle')} Shuffle genre</button><button id="clear-genre" class="text-button">Clear filter</button></div></div>
    <div id="playlist-panel" hidden></div>
    <div id="album-detail" class="album-detail" hidden></div><div id="album-grid" class="album-grid" hidden></div>
    <div class="table-head" id="table-head"><span>#</span><span>TITLE</span><span>ALBUM</span><span id="track-category-heading">FORMAT</span><span>${icon('clock-3')}</span><span></span><span></span></div>
    <div id="tracks" class="tracks"></div>
    <div id="empty" class="empty-state"><div class="empty-icon">${icon('music-2')}</div><h3>A home for your entire collection.</h3><p>Open a folder to bring your favorite tracks together.<br>MP3, FLAC, WAV, M4A, OGG & more.</p><button id="empty-add" class="text-button">Choose your music folder ${icon('arrow-up-right')}</button></div>
    <div class="library-footer"><span id="library-summary">Ready when you are.</span><span>${icon('shield-check')} Private by design</span></div>
  </section>
</main>
<footer class="player"><div class="now-playing"><div class="cover" id="cover">${icon('disc-3')}</div><div class="track-info"><strong id="now-title">A little silence, for now.</strong><span id="now-artist">Pick a track. Find your frequency.</span></div><button id="now-favorite" class="icon-button" aria-label="Favorite current track" disabled>${icon('heart')}</button></div>
  <div class="transport"><div class="transport-buttons"><button id="shuffle" class="icon-button" aria-label="Shuffle" aria-pressed="false">${icon('shuffle')}</button><button id="previous" class="icon-button" aria-label="Previous track">${icon('skip-back')}</button><button id="play" class="play-button" aria-label="Play">${icon('play')}</button><button id="next" class="icon-button" aria-label="Next track">${icon('skip-forward')}</button><button id="repeat" class="icon-button" aria-label="Repeat track" aria-pressed="false">${icon('repeat')}</button></div><div class="timeline"><span id="elapsed">0:00</span><input id="seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="Seek track" disabled><span id="duration">0:00</span></div></div>
  <div class="volume-controls"><span class="quality-label" id="quality">LOCAL AUDIO</span><button id="mute" class="icon-button" aria-label="Mute">${icon('volume-2')}</button><input id="volume" type="range" min="0" max="1" step="0.01" value="${state.volume}" aria-label="Volume"><button id="focus-visualizer" class="icon-button" aria-label="Focus visualizer">${icon('scan')}</button></div>
</footer>
<input type="file" id="folder-input" webkitdirectory multiple hidden><input type="file" id="file-input" accept="audio/*,.flac,.m4a,.opus" multiple hidden>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
${managerMarkup(icon)}
<dialog id="help-dialog"><div class="dialog-heading"><h2>Make yourself at home.</h2><button id="close-help" class="icon-button" aria-label="Close help">${icon('x')}</button></div><p>Choose a music folder or drag audio files into this window. Subfolders are included. Files stay on your device.</p><dl><dt>Space</dt><dd>Play / pause</dd><dt>← / →</dt><dd>Seek 5 seconds</dd><dt>N / P</dt><dd>Next / previous visual preset</dd><dt>F</dt><dd>Fullscreen visualizer</dd><dt>/</dt><dd>Search your library</dd></dl><p class="help-note">Your chosen folder is remembered in the Windows app and rescanned at launch. Use File → Rescan music folder to refresh it. Artist, album, title, and cover artwork come from embedded tags. Missing tags use filenames and folders. Audio format support depends on the file codec.</p><button id="add-files" class="primary">${icon('file-audio')} Add individual files</button></dialog>
<dialog id="playlist-dialog"><form id="playlist-form"><div class="dialog-heading"><h2 id="playlist-dialog-title">Create playlist</h2><button type="button" id="close-playlist-dialog" class="icon-button" aria-label="Close playlist dialog">${icon('x')}</button></div><p id="playlist-dialog-description"></p><label class="playlist-field" id="playlist-picker-label">Playlist<select id="playlist-picker" aria-label="Choose playlist"></select></label><label class="playlist-field" id="playlist-name-label">Name<input id="playlist-name" maxlength="120" autocomplete="off" placeholder="Give your playlist a name" aria-label="Playlist name"></label><p class="playlist-save-note">Saved automatically on this device.</p><div class="playlist-dialog-actions"><button type="button" id="cancel-playlist-dialog" class="secondary">Cancel</button><button type="submit" id="submit-playlist-dialog" class="primary">Create playlist</button></div></form></dialog>`;
const visualManager=new VisualizationManager($('milkdrop'),{
 toast:message=>toast(message),icons:()=>refreshIcons(),ensureAudio:async()=>{await ensureAudio();await initVisualizer();},
 onCatalog:entries=>{presetNames=entries.map(e=>e.name);},
 onSelection:(entry,index)=>{state.preset=index;$('preset-label').innerHTML=`${safeText(entry.name)} ${icon('chevron-down')}`;refreshIcons();},
 onSettings:settings=>{state.auto=settings.auto;$('auto').classList.toggle('active',settings.auto);$('auto').setAttribute('aria-pressed',settings.auto);}
});
const visualOutput=new VisualizerOutput(visualManager);visualManager.output=visualOutput;
$('popout-visualizer').hidden=!window.mandoDesktop?.openVisualizer;$('popout-visualizer').onclick=()=>visualOutput.open();
state.auto=visualManager.settings.auto;$('auto').classList.toggle('active',state.auto);$('auto').setAttribute('aria-pressed',state.auto);
function refreshIcons() { createIcons({ icons }); }
refreshIcons();
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 5500); }
function safeText(text) { return String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function artworkMarkup(track, fallback, lazy = true) {
  return track?.artworkUrl ? `<img src="${safeText(track.artworkUrl)}" alt="${safeText(track.album)} album artwork" ${lazy ? 'loading="lazy"' : ''} data-fallbacks="${safeText(JSON.stringify(track.artworkUrls?.slice(1) || []))}">${fallback}` : fallback;
}
function handleArtworkErrors(container) {
  container.querySelectorAll('img').forEach(image => {
    const show = () => image.classList.add('loaded');
    image.onload = show;
    image.onerror = () => {
      const remaining=JSON.parse(image.dataset.fallbacks || '[]');
      if(remaining.length) {image.src=remaining.shift();image.dataset.fallbacks=JSON.stringify(remaining);}
      else image.remove();
    };
    if(image.complete && image.naturalWidth) show();
  });
}
function renderGenreFilter(){
 const select=$('genre-filter'),options=genreOptions(state.tracks),fragment=document.createDocumentFragment();
 const all=document.createElement('option');all.value='';all.textContent='All genres';fragment.append(all);
 for(const genre of options){const option=document.createElement('option');option.value=genre.value;option.textContent=genre.label+' ('+genre.count+')';fragment.append(option);}
 if(state.genre&&!options.some(option=>option.value===state.genre)){const option=document.createElement('option');option.value=state.genre;option.textContent=(state.genre==='untagged'?'Unknown genre':state.genre.slice(6))+' (0)';fragment.append(option);}
 select.replaceChildren(fragment);select.value=state.genre;$('genre-bar').hidden=state.view==='playlists';$('genre-actions').hidden=!state.genre;
}
function genreResults(queue){state.genreResults=queue;$('genre-match-count').textContent=state.genre?queue.length+' matching '+(queue.length===1?'song':'songs'):'';$('play-genre').disabled=$('shuffle-genre').disabled=!queue.length;}
function setShuffle(enabled){state.shuffle=enabled;$('shuffle').classList.toggle('active',enabled);$('shuffle').setAttribute('aria-pressed',enabled);}
async function playGenreResults(shuffle){const queue=state.genreResults;if(!queue.length){toast('No songs match this genre and search.');return;}setShuffle(shuffle);const track=queue[shuffle?Math.floor(Math.random()*queue.length):0];await playTrack(state.tracks.indexOf(track),queue);}
function renderLibrary() {
  renderGenreFilter();
  renderPlaylistSidebar();
  $('playlist-panel').hidden=state.view!=='playlists';
  if(state.view==='playlists') {
    $('album-grid').hidden=true; $('album-detail').hidden=true; $('table-head').hidden=true; $('tracks').hidden=true; $('empty').hidden=true; $('sort').hidden=true;
    $('side-count').textContent=state.tracks.length; $('track-count').textContent=state.tracks.length;
    $('favorite-count').textContent=state.tracks.filter(t=>state.favorites.has(t.id)).length;
    const albums=groupAlbums(state.tracks); $('album-count').textContent=albums.length; $('album-tab-count').textContent=albums.length;
    renderPlaylistPanel();refreshIcons();return;
  }
  const libraryAlbums=groupAlbums(state.tracks),genreTracks=filterByGenre(state.tracks,state.genre);
  const albums=state.genre?groupAlbums(genreTracks):libraryAlbums;
  const album=state.view==='albums' ? albums.find(a=>a.id===state.albumId) : null;
  const grid=state.view==='albums' && !album;
  const shownAlbums=matchingAlbums(albums,state.query).sort((a,b)=>compareLibraryItems(a,b,$('sort').value==='album'?'title':$('sort').value));
  let tracks=grid ? [] : filterTracks(album?.tracks || genreTracks,state.query,state.view==='favorites',state.favorites);
  if(!album) tracks.sort((a,b)=>compareLibraryItems(a,b,$('sort').value));
  genreResults(grid?shownAlbums.flatMap(item=>item.tracks):tracks);
  renderAlbumPanels(albums,shownAlbums,album,grid);
  $('table-head').hidden=grid; $('tracks').hidden=grid;
  $('sort').hidden=!!album;
  $('track-category-heading').textContent=$('sort').value==='genre'&&!album?'GENRE':'FORMAT';
  $('track-count').textContent=album ? album.tracks.length : state.tracks.length;
  $('album-count').textContent=libraryAlbums.length; $('album-tab-count').textContent=libraryAlbums.length;
  if(!grid) $('track-count').textContent = tracks.length; $('side-count').textContent = state.tracks.length;
  $('favorite-count').textContent = state.tracks.filter(t => state.favorites.has(t.id)).length;
  const fragment = document.createDocumentFragment();
  tracks.forEach((track, i) => {
    const row = document.createElement('div'); row.className = `track-row ${state.tracks[state.current] === track ? 'selected' : ''}`;
    row.innerHTML = `<button class="row-number" aria-label="Play ${safeText(track.title)}">${state.tracks[state.current] === track && !audio.paused ? icon('audio-lines') : String(album ? track.trackNumber || i+1 : i+1).padStart(2,'0')}</button><button class="track-name"><span class="mini-cover color-${i%5}">${artworkMarkup(track, icon('music-2'))}</span><span><strong>${safeText(track.title)}</strong><small>${safeText(track.artist)}</small></span></button><span class="album-cell">${safeText(track.album)}</span><span class="format" title="${safeText(track.genre||'Unknown genre')}">${safeText($('sort').value==='genre'&&!album?(track.genre||'Unknown genre'):track.format)}</span><span class="row-duration">${track.duration ? formatTime(track.duration) : '—'}</span><button class="icon-button add-playlist" aria-label="Add ${safeText(track.title)} to playlist" title="Add to playlist">${icon('list-plus')}</button><button class="icon-button favorite ${state.favorites.has(track.id) ? 'active' : ''}" aria-label="${state.favorites.has(track.id) ? 'Unfavorite' : 'Favorite'} ${safeText(track.title)}" aria-pressed="${state.favorites.has(track.id)}">${icon('heart')}</button>`;
    row.querySelectorAll('.row-number,.track-name').forEach(button => button.onclick = () => playTrack(state.tracks.indexOf(track),state.genre?tracks:album?.tracks||tracks));
    row.querySelector('.add-playlist').onclick=()=>showPlaylistDialog('add',[track]);
    row.querySelector('.favorite').onclick = () => toggleFavorite(track); fragment.append(row);
  });
  $('tracks').replaceChildren(fragment); handleArtworkErrors($('tracks')); $('empty').hidden = tracks.length > 0;
  if (!tracks.length) { $('empty').querySelector('h3').textContent = state.query ? 'No tracks found.' : state.view === 'favorites' ? 'Keep your favorites close.' : 'A home for your entire collection.'; $('empty').querySelector('p').innerHTML = state.query ? 'Try a different title, artist, or album.' : state.view === 'favorites' ? 'Tap the heart beside a track to save it here.' : 'Open a folder to bring your favorite tracks together.<br>MP3, FLAC, WAV, M4A, OGG & more.'; }
  if(!tracks.length&&state.genre&&!grid){$('empty').querySelector('h3').textContent='No matching songs.';$('empty').querySelector('p').textContent='Try another genre, clear your search, or clear the genre filter.';}
  $('library-summary').textContent = `${state.tracks.length} tracks in your library${state.query||state.genre ? ` · ${tracks.length} matches` : ''}`;
  if(grid) {
    $('empty').hidden=shownAlbums.length>0;
    if(!shownAlbums.length) {
      $('empty').querySelector('h3').textContent=state.query ? 'No albums found.' : 'Your albums belong here.';
      $('empty').querySelector('p').textContent=state.query ? 'Try an album, artist, or song title.' : 'Open your music folder to browse your collection by cover.';
    }
    $('library-summary').textContent=`${shownAlbums.length} albums · ${state.genreResults.length} tracks`;
  }
  refreshIcons();
}
function toggleFavorite(track = state.tracks[state.current]) { if (!track) return; state.favorites.has(track.id) ? state.favorites.delete(track.id) : state.favorites.add(track.id); save('mando-favorites', [...state.favorites]); renderLibrary(); updateNow(); }
function updateNow() {
  const t = state.tracks[state.current];
  const coverTrack = demo ? null : t;
  const coverKey = coverTrack?.artworkUrl || '';
  if ($('cover').dataset.artwork !== coverKey) {
    $('cover').dataset.artwork = coverKey;
    $('cover').innerHTML = artworkMarkup(coverTrack,icon('disc-3'),false);
    handleArtworkErrors($('cover'));
  }
  $('now-artist').title = t ? `${t.artist} · ${t.album}` : '';
  $('now-title').textContent = demo ? 'Midnight signal' : t?.title || 'A little silence, for now.';
  $('now-artist').textContent = demo ? 'Mando · synthesized demo' : t?.artist || 'Pick a track. Find your frequency.';
  $('quality').textContent = demo ? 'LIVE SYNTH' : t?.format || 'LOCAL AUDIO';
  $('now-favorite').disabled = !t || !!demo; $('now-favorite').classList.toggle('active', !!t && state.favorites.has(t.id));
  const playing = !!demo || !audio.paused;
  $('play').innerHTML = icon(playing ? 'pause' : 'play'); $('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  $('cover').classList.toggle('playing', playing); $('visualizer-intro').hidden = !!t || !!demo;
  refreshIcons();
}
async function ensureAudio() {
  if (!audioContext) { audioContext = new AudioContext(); source = audioContext.createMediaElementSource(audio); source.connect(audioContext.destination); }
  await audioContext.resume();
  // Visualizer failure must never prevent audio playback.
  initVisualizer();
}
async function initVisualizer() {
 if(visualizerPromise)return visualizerPromise;
 visualizerPromise=(async()=>{try{
  visualizer=await visualManager.start(audioContext);
  visualManager.host.connectAudio(source);if(demo)visualManager.host.connectAudio(demo);
 }catch(error){visualizerPromise=undefined;toast('Visualizer could not start: '+error.message);}})();
 return visualizerPromise;
}
async function loadPreset(index,blend=visualManager.settings.blend){await visualManager.selectIndex(index,blend);}
async function playTrack(index,queue = null,playlistId = null) {
  if (!state.tracks[index]) return;
  if(queue) {
    state.activePlaylistId=playlistId; state.queue=queue.map(track=>track.id);
    // An explicit song/album selection starts fresh; transport Play resumes.
    if(state.current===index && audio.src) audio.currentTime=0;
  }
  stopDemo();
  try {
    await ensureAudio();
    if (state.current !== index || !audio.src) { audio.pause(); if (objectUrl) URL.revokeObjectURL(objectUrl); state.current = index; objectUrl = state.tracks[index].url || URL.createObjectURL(state.tracks[index].file); audio.src = objectUrl; }
    await audio.play(); if(state.activePlaylistId) syncPlaylistQueue(); updateNow(); renderLibrary();
  } catch (error) { if(error.name==='AbortError')return; toast(`Cannot play this file. Your browser may not support its codec. (${error.name})`); updateNow(); }
}
async function togglePlay() { if (demo) { stopDemo(); return; } if (!state.tracks.length) { toast('Open a music folder, or try the sound & visual demo.'); return; } if (audio.paused) { if(state.genre&&state.view!=='playlists'){const current=state.tracks[state.current],queue=playbackQueue();if(!current||!matchesGenre(current,state.genre)||queue.some(track=>!matchesGenre(track,state.genre)))return playGenreResults(state.shuffle);}
const queue=playbackQueue(); await playTrack(state.current < 0 ? state.tracks.indexOf(queue[0]) : state.current); } else audio.pause(); }
function skip(direction) {
  const queue=playbackQueue();
  if(queue.length) {const index=queue.indexOf(state.tracks[state.current]);playTrack(state.tracks.indexOf(queue[nextIndex(queue.length,index,direction,state.shuffle)]));}
}
function stopDemo() { if (!demo) return; demoNodes.forEach(n => { try { n.stop(); } catch {} n.disconnect(); }); demoNodes = []; try { visualManager.host?.disconnectAudio(demo); } catch {} demo.disconnect(); demo = undefined; $('demo').innerHTML = `${icon('play')} Try a sound & visual demo`; updateNow(); }
async function startDemo() {
  if (demo) { stopDemo(); return; }
  audio.pause();
  try {
    await ensureAudio(); demo = audioContext.createGain(); demo.gain.value = state.volume * 0.25; demo.connect(audioContext.destination);
    // A quiet generated chord gives a real audio source to preview the reactive visualizer.
    [110,164.81,220,261.63,329.63].forEach((frequency,i) => { const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); oscillator.type = i < 2 ? 'sine' : 'triangle'; oscillator.frequency.value = frequency; gain.gain.value = 0.16; oscillator.connect(gain); gain.connect(demo); oscillator.start(); demoNodes.push(oscillator); const lfo = audioContext.createOscillator(); const lfoGain = audioContext.createGain(); lfo.frequency.value = 0.45 + i * 0.17; lfoGain.gain.value = 0.1; lfo.connect(lfoGain); lfoGain.connect(gain.gain); lfo.start(); demoNodes.push(lfo); });
    visualManager.host?.connectAudio(demo); updateNow(); toast('Playing a generated ambient chord. Press pause to stop.');
  } catch { toast('Audio could not start. Try pressing Play again.'); }
}
async function rememberFolder(handle) { try { const db = await openDb(); await new Promise((resolve,reject) => { const tx = db.transaction('settings','readwrite'); tx.objectStore('settings').put(handle,'folder'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close(); } catch {} }
function openDb() { return new Promise((resolve,reject) => { const request = indexedDB.open('mando-library',1); request.onupgradeneeded = () => request.result.createObjectStore('settings'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
let rememberedFolder;
async function restoreFolder() { if (window.mandoDesktop) return loadNativeFolder(false); try { const db = await openDb(); rememberedFolder = await new Promise((resolve,reject) => { const request = db.transaction('settings').objectStore('settings').get('folder'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); db.close(); if (rememberedFolder) { $('folder-name').textContent = rememberedFolder.name; if (await rememberedFolder.queryPermission({mode:'read'}) === 'granted') await importHandle(rememberedFolder); else toast('Click your saved folder in the sidebar to reconnect your library.'); } } catch {} }
async function walkDirectory(handle, prefix = handle.name) { const files = []; for await (const entry of handle.values()) { if (entry.kind === 'directory') files.push(...await walkDirectory(entry, `${prefix}/${entry.name}`)); else if (AUDIO_EXTENSIONS.test(entry.name)) files.push({file:await entry.getFile(), path:`${prefix}/${entry.name}`}); } return files; }
async function importHandle(handle) { state.importing = true; $('add-folder').disabled = true; toast('Reading your music folder…'); try { const files = await walkDirectory(handle); importFiles(files, handle.name); rememberedFolder = handle; await rememberFolder(handle); } catch { toast('The folder could not be read. Reconnect it to try again.'); } finally { state.importing = false; $('add-folder').disabled = false; } }
async function chooseFolder() { if (window.mandoDesktop) return loadNativeFolder(true); if (state.importing) return; if (!window.showDirectoryPicker) { $('folder-input').click(); return; } try { const handle = await window.showDirectoryPicker({mode:'read'}); await importHandle(handle); } catch (error) { if (error.name !== 'AbortError') toast('Folder access was not granted. You can also add individual files from Help.'); } }
let metadataGeneration = 0;
function importFiles(entries, name) {
  const generation = ++metadataGeneration;
  state.queue=[]; state.activePlaylistId=null; state.albumId=null;state.genre='';
  for(const track of state.tracks) if(track.artworkUrl?.startsWith('blob:')) URL.revokeObjectURL(track.artworkUrl);
  stopDemo(); audio.pause(); audio.removeAttribute('src'); audio.load(); if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = undefined; state.current = -1;
  state.tracks = entries.filter(e => AUDIO_EXTENSIONS.test(e.file.name)).map(e => applyMetadata({ ...trackFromFile(e.file,e.path), ...(e.url ? {url:e.url} : {}) },e.metadata)).sort((a,b) => a.title.localeCompare(b.title));
  $('folder-name').textContent = name || 'Imported files'; renderLibrary(); updateNow(); $('seek').disabled = true; $('seek').value = 0; $('elapsed').textContent = '0:00'; $('duration').textContent = '0:00';
  toast(state.tracks.length ? `${state.tracks.length} tracks ready to play. Welcome to your collection.` : 'No supported audio files found in that folder.');
  const pending = state.tracks.filter(t => t.file instanceof Blob);
  if(pending.length) readImportedTags(pending,generation);
}
['add-folder','add-folder-small','empty-add'].forEach(id => $(id).onclick = chooseFolder);
$('folder-entry').onclick = async () => { if (window.mandoDesktop) return loadNativeFolder(false); if (!rememberedFolder) return chooseFolder(); try { if (await rememberedFolder.requestPermission({mode:'read'}) === 'granted') await importHandle(rememberedFolder); else toast('Folder permission is needed to read your music.'); } catch { chooseFolder(); } };
$('folder-input').onchange = e => importFiles([...e.target.files].map(file => ({file,path:file.webkitRelativePath || file.name})), e.target.files[0]?.webkitRelativePath.split('/')[0]);
$('file-input').onchange = e => importFiles([...e.target.files].map(file => ({file,path:file.name})), 'Imported files');
function setView(view) {
  state.view=view; state.albumId=null; state.playlistId=null;
  document.body.classList.toggle('album-mode',view==='albums'||view==='playlists');
  $('nav-all').classList.toggle('active',view==='all');
  $('nav-albums').classList.toggle('active',view==='albums');
  $('nav-favorites').classList.toggle('active',view==='favorites');
  $('nav-playlists').classList.toggle('active',view==='playlists');
  $('tab-tracks').classList.toggle('active',view==='all'||view==='favorites'); $('tab-albums').classList.toggle('active',view==='albums');
  $('breadcrumb').textContent=view==='all' ? 'All music' : view==='albums' ? 'Albums' : view==='playlists' ? 'Playlists' : 'Favorites';
  $('page-title').innerHTML=view==='all' ? 'Your music, <span>in motion.</span>' : view==='albums' ? 'Albums, <span>on repeat.</span>' : view==='playlists' ? 'Your mix, <span>your way.</span>' : 'The ones <span>you love.</span>';
  $('search').placeholder=view==='albums' ? 'Search albums or artists' : view==='playlists' ? 'Search your playlists' : 'Search your music';
  $('library-caption').textContent=view==='albums' ? 'A collection worth exploring' : 'Your personal rotation';
  renderLibrary();
}
$('nav-playlists').onclick=()=>setView('playlists');
$('new-playlist-small').onclick=()=>showPlaylistDialog('create');
$('nav-all').onclick=()=>setView('all'); $('nav-favorites').onclick=()=>setView('favorites');
$('nav-albums').onclick=()=>setView('albums'); $('tab-albums').onclick=()=>setView('albums'); $('tab-tracks').onclick=()=>setView('all');
$('genre-filter').onchange=()=>{state.genre=$('genre-filter').value;state.albumId=null;if(state.view==='albums')$('breadcrumb').textContent='Albums';renderLibrary();};
$('clear-genre').onclick=()=>{state.genre='';state.albumId=null;if(state.view==='albums')$('breadcrumb').textContent='Albums';renderLibrary();};
$('play-genre').onclick=()=>playGenreResults(false);$('shuffle-genre').onclick=()=>playGenreResults(true);
$('search').oninput = e => { state.query = e.target.value; renderLibrary(); }; $('sort').onchange = ()=>{save('mando-library-sort',$('sort').value);renderLibrary();};
$('play').onclick = togglePlay; $('previous').onclick = () => skip(-1); $('next').onclick = () => skip(1);
$('shuffle').onclick = () => setShuffle(!state.shuffle);
$('repeat').onclick = () => { state.repeat = !state.repeat; audio.loop = state.repeat; $('repeat').classList.toggle('active',state.repeat); $('repeat').setAttribute('aria-pressed',state.repeat); };
$('now-favorite').onclick = () => toggleFavorite();
$('volume').oninput = e => { state.volume = Number(e.target.value); audio.volume = state.volume; audio.muted = false; if (demo) demo.gain.value = state.volume * 0.25; save('mando-volume',state.volume); $('mute').classList.remove('active'); };
$('mute').onclick = () => { audio.muted = !audio.muted; if (demo) demo.gain.value = audio.muted ? 0 : state.volume * 0.25; $('mute').classList.toggle('active',audio.muted); $('mute').setAttribute('aria-label',audio.muted ? 'Unmute' : 'Mute'); };
$('seek').oninput = e => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(e.target.value); };
audio.addEventListener('timeupdate', () => { $('elapsed').textContent = formatTime(audio.currentTime); $('seek').value = audio.currentTime; });
audio.addEventListener('loadedmetadata', () => { if (state.tracks[state.current]) state.tracks[state.current].duration = audio.duration; $('duration').textContent = formatTime(audio.duration); $('seek').max = Number.isFinite(audio.duration) ? audio.duration : 100; $('seek').disabled = !Number.isFinite(audio.duration); renderLibrary(); });
audio.addEventListener('play',updateNow); audio.addEventListener('pause',updateNow); audio.addEventListener('ended',() => { const queue=playbackQueue(); if (queue.indexOf(state.tracks[state.current]) < queue.length - 1 || state.shuffle) skip(1); else { updateNow(); renderLibrary(); } });
audio.addEventListener('error', () => { if (audio.getAttribute('src')) toast('This track could not be decoded. Try another audio format.'); });
$('demo').onclick = startDemo;
$('preset-prev').onclick = async () => { await ensureAudio(); await initVisualizer(); visualManager.step(-1); };
$('preset-next').onclick = async () => { await ensureAudio(); await initVisualizer(); visualManager.step(1); };
$('auto').onclick=()=>visualManager.setSettings({auto:!visualManager.settings.auto});
async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('visualizer-panel').requestFullscreen(); } catch { toast('Fullscreen is unavailable in this window.'); } }
$('fullscreen').onclick = fullscreen; $('focus-visualizer').onclick = fullscreen; $('nav-visualizer').onclick = () => { $('visualizer-panel').scrollIntoView({behavior:'smooth',block:'center'}); };
$('preset-label').onclick=()=>visualManager.open();
$('nav-visualizer').onclick=()=>visualManager.open();
$('help').onclick = () => $('help-dialog').showModal(); $('close-help').onclick = () => $('help-dialog').close(); $('add-files').onclick = () => { $('help-dialog').close(); $('file-input').click(); };
document.addEventListener('keydown', e => { if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || document.querySelector('dialog[open]')) return; if (e.code === 'Space') { e.preventDefault(); togglePlay(); } else if (e.key === '/') { e.preventDefault(); $('search').focus(); } else if (e.key.toLowerCase() === 'f') fullscreen(); else if (e.key.toLowerCase() === 'n') $('preset-next').click(); else if (e.key.toLowerCase() === 'p') $('preset-prev').click(); else if (e.key === 'ArrowRight' && Number.isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration,audio.currentTime+5); else if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0,audio.currentTime-5); });
document.addEventListener('dragover', e => { e.preventDefault(); });
async function walkDrop(entry, prefix = '') { if (entry.isFile) { const file = await new Promise((resolve,reject) => entry.file(resolve,reject)); return [{file,path:prefix+file.name}]; } const reader = entry.createReader(); let result = [], batch; do { batch = await new Promise((resolve,reject) => reader.readEntries(resolve,reject)); for (const child of batch) result.push(...await walkDrop(child,prefix+entry.name+'/')); } while (batch.length); return result; }
document.addEventListener('drop', async e => { e.preventDefault(); try { const entries = [...e.dataTransfer.items].filter(i => i.kind === 'file').map(i => i.webkitGetAsEntry?.()).filter(Boolean); const files = entries.length ? (await Promise.all(entries.map(e => walkDrop(e)))).flat() : [...e.dataTransfer.files].map(file => ({file,path:file.name})); if (files.length) importFiles(files,'Dropped collection'); } catch { toast('Could not read the dropped files. Try Open music folder.'); } });
// A lightweight animated canvas provides a warm welcome before audio/WebGL is initialized.
const canvas = $('ambient'); const ctx = canvas.getContext('2d'); const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function resize() { const width = $('visualizer-panel').clientWidth, height = $('visualizer-panel').clientHeight; canvas.width = width; canvas.height = height; visualManager.host?.setRendererSize(width,height); }
new ResizeObserver(resize).observe($('visualizer-panel'));
let lastDraw = 0;
function animate(time) {
  frame = requestAnimationFrame(animate); if ((document.hidden&&!visualOutput.active) || time-lastDraw < 33) return; lastDraw = time;
  if(visualManager.host)visualManager.render(time,!!demo||!audio.paused);
  if($('milkdrop').classList.contains('ready'))return;
  const w=canvas.width,h=canvas.height,t=reducedMotion?0:time*0.00016; ctx.fillStyle='#0a1716';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='screen';
  const colors=['#35bb8c','#178d85','#b3b85d'];
  for(let j=0;j<3;j++){ ctx.beginPath(); for(let x=-20;x<w+20;x+=5){const y=h*(.46+j*.06)+Math.sin(x*.006+t*2+j)*h*.19+Math.sin(x*.011-t*3+j)*h*.12; x===-20?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.strokeStyle=colors[j];ctx.lineWidth=32;ctx.shadowColor=colors[j];ctx.shadowBlur=70;ctx.globalAlpha=.22;ctx.stroke();ctx.lineWidth=1;ctx.globalAlpha=.55;ctx.stroke(); }
  ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
}
const savedSort=readSetting('mando-library-sort','title');if(['title','artist','album','genre'].includes(savedSort))$('sort').value=savedSort;
resize(); frame=requestAnimationFrame(animate); renderLibrary(); restoreFolder(); visualOutput.restore();
window.addEventListener('pagehide',() => { visualOutput.dispose(); cancelAnimationFrame(frame); audio.pause(); stopDemo(); if(objectUrl) URL.revokeObjectURL(objectUrl); visualManager.host?.dispose();audioContext?.close(); });

// Close dialogs consistently even when the search field has focus.
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); dialog.close(); }
}));

async function loadNativeFolder(choose) {
  if (state.importing) return;
  state.importing = true; $('add-folder').disabled = true;
  try {
    const library = await window.mandoDesktop[choose ? 'chooseFolder' : 'restoreFolder']();
    if (library) {
      importFiles(library.tracks.map(t => ({file:{name:t.name},path:t.path,url:t.url,metadata:t.metadata})),library.name);
      if(library.skipped) toast(`Imported music; ${library.skipped} unreadable folders were skipped.`);
    }
  } catch { toast('The music folder is unavailable. Use Open music folder to reconnect it.'); }
  finally { state.importing=false; $('add-folder').disabled=false; }
}
if (window.mandoDesktop) {
  document.title='Mando';
  window.mandoDesktop.onCommand(command => {
    if(command==='open-folder') chooseFolder();
    else if(command==='rescan') loadNativeFolder(false);
    else if(command==='play') togglePlay();
    else if(command==='next') skip(1);
    else if(command==='previous') skip(-1);
    else if(command==='fullscreen') fullscreen();
    else if(command==='popout-visualizer') visualOutput.open();
    else if(command==='help') $('help-dialog').showModal();
  });
}

async function readImportedTags(tracks,generation) {
  try {
    const {readBrowserTags} = await import('./tags.js');
    let next=0, completed=0;
    await Promise.all(Array.from({length:Math.min(4,tracks.length)},async()=>{
      while(next<tracks.length && generation===metadataGeneration) {
        const track=tracks[next++];
        try {
          const fields=await readBrowserTags(track.file);
          if(generation!==metadataGeneration) { if(fields.artworkUrl) URL.revokeObjectURL(fields.artworkUrl); return; }
          Object.assign(track,applyMetadata(track,fields));
        } catch {} // Keep filename/folder fallbacks for absent or unreadable tags.
        completed++;
        if(completed%20===0 && generation===metadataGeneration) {renderLibrary();updateNow();}
      }
    }));
    if(generation===metadataGeneration) {renderLibrary();updateNow();}
  } catch { /* Metadata support is optional; playback remains available. */ }
}

function openAlbum(album) {
  state.albumId=album.id; state.albumSearch=state.query; state.query=''; $('search').value='';
  $('breadcrumb').textContent=`Albums / ${album.title}`;renderLibrary();
  $('album-detail').scrollIntoView({behavior:'smooth',block:'start'});$('album-back').focus({preventScroll:true});
}
function renderAlbumPanels(albums,shown,album,grid) {
  $('album-grid').hidden=!grid; $('album-detail').hidden=!album;
  if(grid) {
    const fragment=document.createDocumentFragment();
    shown.forEach(item=>{
      const card=document.createElement('button');card.className='album-card';card.setAttribute('aria-label',`Open album ${item.title} by ${item.artist}`);
      card.innerHTML=`<span class="album-art">${artworkMarkup(item,icon('disc-3'))}<span class="album-open">${icon('arrow-up-right')}</span></span><strong>${safeText(item.title)}</strong><span class="album-artist">${safeText(item.artist)}</span><small>${item.tracks.length} ${item.tracks.length===1?'song':'songs'}${$('sort').value==='genre'?' · '+safeText(item.genre||'Unknown genre'):''}</small>`;
      card.onclick=()=>openAlbum(item);fragment.append(card);
    });
    $('album-grid').replaceChildren(fragment);handleArtworkErrors($('album-grid'));
  } else $('album-grid').replaceChildren();
  if(album) {
    const duration=album.tracks.reduce((sum,t)=>sum+(t.duration || 0),0);
    $('album-detail').innerHTML=`<button class="album-back text-button" id="album-back">${icon('arrow-left')} All albums</button><div class="album-header"><div class="album-art album-large">${artworkMarkup(album,icon('disc-3'),false)}</div><div class="album-description"><div class="eyebrow">ALBUM</div><h2>${safeText(album.title)}</h2><p>${safeText(album.artist)}</p><small>${album.tracks.length} ${album.tracks.length===1?'song':'songs'}${duration ? ' · '+formatTime(duration) : ''}</small><button class="primary" id="play-album">${icon('play')} Play album</button><button class="secondary add-album-playlist" id="add-album-playlist">${icon('list-plus')} Add album to playlist</button></div></div>`;
    $('album-back').onclick=()=>{state.albumId=null;state.query=state.albumSearch;$('search').value=state.query;$('breadcrumb').textContent='Albums';renderLibrary();};
    $('add-album-playlist').onclick=()=>showPlaylistDialog('add',album.tracks);
    $('play-album').onclick=()=>playTrack(state.tracks.indexOf(album.tracks[0]),album.tracks);
    handleArtworkErrors($('album-detail'));
  } else $('album-detail').replaceChildren();
}

function currentPlaylist() { return state.playlists.find(p=>p.id===state.playlistId); }
function playablePlaylist(playlist) { return resolvePlaylist(playlist,state.tracks).flatMap(entry=>entry.track ? [entry.track] : []); }
function playbackQueue() {
  if(state.activePlaylistId && !state.queue.length) return [];
  return queueTracks(state.tracks,state.queue);
}
function syncPlaylistQueue() {
  const playlist=state.playlists.find(p=>p.id===state.activePlaylistId);
  if(!playlist) {state.activePlaylistId=null;return;}
  const ids=playablePlaylist(playlist).map(t=>t.id),current=state.tracks[state.current]?.id;
  // Removing the playing song lets it finish; subsequent navigation follows the edited list.
  if(current && !ids.includes(current)) ids.splice(Math.min(Math.max(state.queue.indexOf(current),0),ids.length),0,current);
  state.queue=ids;
}
function commitPlaylists(playlists) {
  try { localStorage.setItem('mando-playlists-v1',JSON.stringify(playlists)); }
  catch {toast('Could not save the playlist. Device storage may be full; your previous playlists are unchanged.');return false;}
  state.playlists=playlists;
  if(state.activePlaylistId) syncPlaylistQueue();
  renderLibrary();return true;
}
function updatePlaylist(playlist) {return commitPlaylists(state.playlists.map(p=>p.id===playlist.id?playlist:p));}
function openPlaylist(id) {
  setView('playlists');state.playlistId=id;state.query='';$('search').value='';
  $('search').placeholder='Search playlist songs';renderLibrary();
}
function renderPlaylistSidebar() {
  $('playlist-count').textContent=state.playlists.length;
  const fragment=document.createDocumentFragment();
  state.playlists.forEach(playlist=>{
    const button=document.createElement('button');button.className='playlist-shortcut';
    button.classList.toggle('active',state.view==='playlists' && state.playlistId===playlist.id);
    button.innerHTML=`${icon('list-music')}<span>${safeText(playlist.name)}</span><small>${playlist.entries.length}</small>`;
    button.onclick=()=>openPlaylist(playlist.id);fragment.append(button);
  });
  if(!state.playlists.length) {const hint=document.createElement('span');hint.className='playlist-sidebar-hint';hint.textContent='Make room for your favorites.';fragment.append(hint);}
  $('sidebar-playlists').replaceChildren(fragment);
}
function renderPlaylistPanel() {
  const panel=$('playlist-panel'),playlist=currentPlaylist();
  if(!playlist) {
    const playlists=state.playlists.filter(p=>p.name.toLowerCase().includes(state.query.trim().toLowerCase()));
    panel.innerHTML=`<div class="playlist-overview-heading"><div><h2>Made by you.</h2><p>Save a mood. Build a rotation. Make it yours.</p></div><button id="new-playlist" class="primary">${icon('plus')} New playlist</button></div><div id="playlist-cards" class="playlist-cards"></div>`;
    $('new-playlist').onclick=()=>showPlaylistDialog('create');
    playlists.forEach(item=>{
      const tracks=playablePlaylist(item),cover=tracks.find(t=>t.artworkUrl);
      const button=document.createElement('button');button.className='playlist-card';button.setAttribute('aria-label',`Open playlist ${item.name}`);
      button.innerHTML=`<span class="album-art">${artworkMarkup(cover,icon('list-music'))}</span><span><strong>${safeText(item.name)}</strong><small>${item.entries.length} ${item.entries.length===1?'song':'songs'} · ${tracks.length} available</small></span>${icon('chevron-right')}`;
      button.onclick=()=>openPlaylist(item.id);$('playlist-cards').append(button);
    });
    if(!playlists.length) {const empty=document.createElement('div');empty.className='playlist-empty';empty.innerHTML=state.query ? '<h3>No playlists found.</h3><p>Try another name.</p>' : '<h3>Your next favorite mix starts here.</h3><p>Create a playlist, then add songs from the library or albums.</p>';$('playlist-cards').append(empty);}
    $('library-summary').textContent=`${state.playlists.length} saved playlists`;handleArtworkErrors(panel);return;
  }
  const resolved=resolvePlaylist(playlist,state.tracks),available=resolved.flatMap(e=>e.track?[e.track]:[]),missing=resolved.length-available.length;
  const term=state.query.trim().toLowerCase(),entries=resolved.filter(e=>`${e.track?.title || e.title} ${e.track?.artist || e.artist} ${e.track?.album || e.album}`.toLowerCase().includes(term));
  $('breadcrumb').textContent=`Playlists / ${playlist.name}`;
  panel.innerHTML=`<button id="playlist-back" class="text-button">${icon('arrow-left')} All playlists</button><div class="playlist-detail-heading"><div><div class="eyebrow">YOUR PLAYLIST</div><h2>${safeText(playlist.name)}</h2><p>${playlist.entries.length} ${playlist.entries.length===1?'song':'songs'}${missing?` · ${missing} unavailable`:''}</p></div><div class="playlist-header-actions"><button id="play-playlist" class="primary" ${available.length?'':'disabled'}>${icon('play')} Play playlist</button><button id="rename-playlist" class="secondary">${icon('pencil')} Rename</button><button id="delete-playlist" class="icon-button" aria-label="Delete playlist">${icon('trash-2')}</button></div></div><p class="playlist-order-note">${term?'Clear search to rearrange songs.':'Drag songs to rearrange, or use the arrow buttons. Changes save automatically.'}${missing?' Unavailable songs stay saved; reconnect their music folder to play them.':''}</p><div id="playlist-tracks" class="playlist-tracks"></div>`;
  $('playlist-back').onclick=()=>{state.query='';$('search').value='';setView('playlists');};
  $('play-playlist').onclick=()=>playTrack(state.tracks.indexOf(available[0]),available,playlist.id);
  $('rename-playlist').onclick=()=>showPlaylistDialog('rename',[],playlist.id);
  $('delete-playlist').onclick=()=>showPlaylistDialog('delete',[],playlist.id);
  for(const entry of entries) {
    const index=playlist.entries.findIndex(e=>e.trackId===entry.trackId),track=entry.track,title=track?.title || entry.title;
    const row=document.createElement('div');row.className=`playlist-song ${track && state.tracks[state.current]===track?'selected':''} ${track?'':'unavailable'}`;
    row.dataset.trackId=entry.trackId;row.draggable=!term;
    row.innerHTML=`<span class="playlist-grip" title="Drag to rearrange">${icon('grip-vertical')}</span><span class="playlist-position">${String(index+1).padStart(2,'0')}</span><button class="playlist-song-play" aria-label="Play ${safeText(title)}" ${track?'':'disabled'}><span class="mini-cover">${artworkMarkup(track,icon('music-2'))}</span><span><strong>${safeText(title)}</strong><small>${safeText(track?.artist || entry.artist)} · ${safeText(track?.album || entry.album)}${track?'':' · Unavailable'}</small></span></button><div class="playlist-row-actions"><button class="icon-button move-up" aria-label="Move ${safeText(title)} up" ${term || index===0?'disabled':''}>${icon('arrow-up')}</button><button class="icon-button move-down" aria-label="Move ${safeText(title)} down" ${term || index===playlist.entries.length-1?'disabled':''}>${icon('arrow-down')}</button><button class="icon-button remove-song" aria-label="Remove ${safeText(title)} from playlist">${icon('x')}</button></div>`;
    row.querySelector('.playlist-song-play').onclick=()=>playTrack(state.tracks.indexOf(track),available,playlist.id);
    const move=to=>{if(updatePlaylist(movePlaylistTrack(playlist,index,to))) {toast('Playlist order saved.');const moved=[...$('playlist-tracks').children].find(r=>r.dataset.trackId===entry.trackId);moved?.querySelector('.playlist-song-play').focus({preventScroll:true});}};
    row.querySelector('.move-up').onclick=()=>move(index-1);row.querySelector('.move-down').onclick=()=>move(index+1);
    row.querySelector('.remove-song').onclick=()=>{if(updatePlaylist({...playlist,entries:playlist.entries.filter(e=>e.trackId!==entry.trackId)}))toast('Song removed from playlist.');};
    row.ondragstart=event=>{if(term){event.preventDefault();return;}event.dataTransfer.setData('application/x-mando-playlist-track',JSON.stringify({playlistId:playlist.id,trackId:entry.trackId}));event.dataTransfer.effectAllowed='move';};
    row.ondragover=event=>{if(!term && event.dataTransfer.types.includes('application/x-mando-playlist-track')){event.preventDefault();event.dataTransfer.dropEffect='move';row.classList.add('drag-target');}};
    row.ondragleave=()=>row.classList.remove('drag-target');
    row.ondrop=event=>{
      const data=event.dataTransfer.getData('application/x-mando-playlist-track');if(!data||term)return;event.preventDefault();event.stopPropagation();row.classList.remove('drag-target');
      try{const dragged=JSON.parse(data);if(dragged.playlistId!==playlist.id)return;const from=playlist.entries.findIndex(e=>e.trackId===dragged.trackId);if(from>=0&&from!==index && updatePlaylist(movePlaylistTrack(playlist,from,index)))toast('Playlist order saved.');}catch{}
    };
    $('playlist-tracks').append(row);
  }
  if(!entries.length) {$('playlist-tracks').innerHTML=`<div class="playlist-empty"><h3>${term?'No matching songs.':'A blank canvas for your next mix.'}</h3><p>${term?'Try another song or artist.':'Use the list-plus button beside any song, or Add album to playlist on an album.'}</p><button id="browse-playlist-music" class="text-button">Browse your music ${icon('arrow-up-right')}</button></div>`;$('browse-playlist-music').onclick=()=>{state.query='';$('search').value='';setView('all');};}
  $('library-summary').textContent=`${available.length} available · ${playlist.entries.length} saved songs`;handleArtworkErrors(panel);
}
let playlistDialogMode,playlistDialogTracks=[],playlistDialogId;
function showPlaylistDialog(mode,tracks=[],id=null) {
  playlistDialogMode=mode;playlistDialogTracks=tracks;playlistDialogId=id;
  const playlist=state.playlists.find(p=>p.id===id),adding=mode==='add';
  $('playlist-dialog-title').textContent=adding?'Add to playlist':mode==='rename'?'Rename playlist':mode==='delete'?'Delete playlist?':'Create playlist';
  $('playlist-dialog-description').textContent=adding?`${tracks.length} ${tracks.length===1?'song':'songs'} selected. Choose a playlist or create one.`:mode==='delete'?`Delete “${playlist?.name}”? Your music files will stay in the library.`:'Give your collection a name. You can change it later.';
  $('playlist-picker-label').hidden=!adding;$('playlist-picker').disabled=!adding;
  $('playlist-picker').innerHTML=`<option value="__new">Create new playlist…</option>${state.playlists.map(p=>`<option value="${safeText(p.id)}">${safeText(p.name)}</option>`).join('')}`;
  if(adding && state.playlists.length)$('playlist-picker').value=state.playlists.some(p=>p.id===state.playlistId)?state.playlistId:state.playlists[0].id;
  $('playlist-name').value=mode==='rename'?playlist?.name || '':'';$('playlist-name').setCustomValidity('');
  $('submit-playlist-dialog').textContent=adding?'Add songs':mode==='rename'?'Save name':mode==='delete'?'Delete playlist':'Create playlist';
  const updateFields=()=>{const show=mode!=='delete'&&(!adding || $('playlist-picker').value==='__new');$('playlist-name-label').hidden=!show;$('playlist-name').disabled=!show;$('playlist-name').required=show;};
  $('playlist-picker').onchange=updateFields;updateFields();$('playlist-dialog').showModal();
  (adding?$('playlist-picker'):mode==='delete'?$('cancel-playlist-dialog'):$('playlist-name')).focus();
}
$('close-playlist-dialog').onclick=()=>$('playlist-dialog').close();$('cancel-playlist-dialog').onclick=()=>$('playlist-dialog').close();
$('playlist-name').oninput=()=>$('playlist-name').setCustomValidity('');
$('playlist-form').onsubmit=event=>{
  event.preventDefault();const mode=playlistDialogMode,name=$('playlist-name').value.trim();
  if(!$('playlist-name').disabled&&!name){$('playlist-name').setCustomValidity('Enter a playlist name.');$('playlist-name').reportValidity();return;}
  let playlists=state.playlists,playlist,added=0;
  if(mode==='delete') playlists=playlists.filter(p=>p.id!==playlistDialogId);
  else if(mode==='rename') playlists=playlists.map(p=>p.id===playlistDialogId?{...p,name}:p);
  else {
    const selected=mode==='add'?$('playlist-picker').value:'__new';
    playlist=selected==='__new'?{id:crypto.randomUUID(),name,entries:[]}:playlists.find(p=>p.id===selected);
    if(!playlist)return;
    if(mode==='add'){const updated=addPlaylistTracks(playlist,playlistDialogTracks);added=updated.entries.length-playlist.entries.length;playlist=updated;}
    playlists=playlists.some(p=>p.id===playlist.id)?playlists.map(p=>p.id===playlist.id?playlist:p):[...playlists,playlist];
  }
  if(!commitPlaylists(playlists))return;
  $('playlist-dialog').close();
  if(mode==='create')openPlaylist(playlist.id);
  if(mode==='delete'){state.playlistId=null;state.query='';$('search').value='';setView('playlists');}
  toast(mode==='add'?(added?`${added} ${added===1?'song added':'songs added'} to ${playlist.name}.`:'Those songs are already in this playlist.'):mode==='rename'?'Playlist renamed.':mode==='delete'?'Playlist deleted.':'Playlist created. Add songs or albums to make it yours.');
};
