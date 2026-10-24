import {downloadMissingCovers} from '../shared/cover-batch.js';
export function showBulkCoverSearch(albums,onSaved){
  if(document.querySelector('.bulk-cover-dialog'))return;
  const api=window.mandoDesktop,dialog=document.createElement('dialog');dialog.className='bulk-cover-dialog cover-search-dialog';dialog.setAttribute('aria-label','Find missing covers');
  dialog.innerHTML=`<div class="dialog-heading"><h2>Find missing covers</h2><button class="icon-button bulk-close" aria-label="Close bulk cover search">×</button></div><p class="bulk-description"></p><p>Albums with embedded, folder, or previously downloaded artwork are skipped. Downloads use exact artist and album matches; uncertain matches are left for manual search.</p><p>Artist and album names are sent to MusicBrainz. Covers are saved in Mando on this computer.</p><progress class="bulk-progress" value="0"></progress><p class="bulk-status" role="status" aria-live="polite">Ready to start.</p><p class="bulk-current"></p><div class="bulk-log" tabindex="0" aria-label="Cover download results"></div><div class="playlist-dialog-actions"><button class="secondary bulk-stop" hidden>Stop</button><button class="primary bulk-start">Start downloads</button></div>`;
  dialog.querySelector('.bulk-description').textContent=`Check all ${albums.length} albums in your library for missing covers. Search and genre filters do not limit this scan.`;
  const start=dialog.querySelector('.bulk-start'),stop=dialog.querySelector('.bulk-stop'),status=dialog.querySelector('.bulk-status'),current=dialog.querySelector('.bulk-current'),log=dialog.querySelector('.bulk-log'),progress=dialog.querySelector('progress');progress.max=Math.max(1,albums.length);
  let running=false,cancelled=false;
  const clean=message=>String(message||'').replace(/^Error invoking remote method '[^']+': Error: /,'');
  const cancel=()=>{cancelled=true;stop.disabled=true;status.textContent='Stopping after the current request…';};
  const close=()=>{if(running)cancel();else dialog.close();};
  dialog.querySelector('.bulk-close').onclick=close;stop.onclick=cancel;
  dialog.addEventListener('cancel',event=>{if(running){event.preventDefault();cancel();}});
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  start.onclick=async()=>{
    if(running)return;running=true;cancelled=false;start.hidden=true;stop.hidden=false;stop.disabled=false;log.replaceChildren();progress.value=0;
    try{
      await downloadMissingCovers(albums,{
        hasArtwork:album=>api.hasAlbumArtwork(album.tracks.map(track=>track.url)),search:api.searchCovers,preview:api.previewCover,
        save:(id,album)=>api.saveCover(id,album.tracks.map(track=>track.url)),stopped:()=>cancelled,onSaved,
        onProgress:update=>{
          progress.value=update.checked;
          const counts=`${update.checked} of ${update.total} checked · ${update.saved} downloaded · ${update.existing} already covered · ${update.unmatched} unmatched · ${update.failed} failed`;
          status.textContent=counts;
          if(update.phase==='done'){
            status.textContent=(update.stopped?'Stopped. ':update.paused?'Paused. ':'Finished. ')+counts;
            current.textContent=update.reason?clean(update.reason):'Run again to retry remaining albums. Saved covers will be skipped.';return;
          }
          current.textContent=`${update.album.artist} — ${update.album.title}: ${{checking:'Checking local artwork',searching:'Searching',downloading:'Downloading'}[update.phase]||update.phase}`;
          if(['saved','unmatched','error'].includes(update.phase)){
            const row=document.createElement('p');row.textContent=`${update.album.artist} — ${update.album.title}: ${update.phase==='saved'?'Downloaded':update.phase==='unmatched'?'Skipped':'Failed'}${update.detail?' · '+clean(update.detail):''}`;log.append(row);log.scrollTop=log.scrollHeight;
          }
        }
      });
    }catch(error){status.textContent=clean(error.message);}
    finally{running=false;stop.hidden=true;start.hidden=false;start.textContent='Run again';}
  };
  document.body.append(dialog);dialog.showModal();start.disabled=!albums.length;
}
