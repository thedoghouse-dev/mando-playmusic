export function showCoverSearch(album,onSaved) {
  const api=window.mandoDesktop;
  if(!api?.searchCovers)return;
  const dialog=document.createElement('dialog');dialog.className='cover-search-dialog';dialog.setAttribute('aria-label','Find cover art');
  dialog.innerHTML=`<div class="dialog-heading"><h2>Find cover art</h2><button type="button" class="icon-button close-cover" aria-label="Close cover search">×</button></div><p>Search MusicBrainz and the Cover Art Archive. Only the artist and album you enter are sent online.</p><form class="cover-search-form"><label>Artist<input name="artist" maxlength="200" autocomplete="off"></label><label>Album<input name="album" maxlength="200" required autocomplete="off"></label><button class="primary" type="submit">Search covers</button></form><p class="cover-search-status" role="status">Choose Search covers to look online.</p><div class="cover-search-results"></div><div class="cover-preview" hidden><img alt="Selected album cover"><p class="cover-preview-label"></p><button class="primary save-cover" type="button">Use this cover</button></div><p class="help-note">Saved in Mando on this computer. Embedded and folder artwork keep priority. Music files are unchanged.</p>`;
  const form=dialog.querySelector('form'),status=dialog.querySelector('[role=status]'),results=dialog.querySelector('.cover-search-results'),preview=dialog.querySelector('.cover-preview'),save=dialog.querySelector('.save-cover');
  form.elements.artist.value=album.artist==='Unknown artist'?'':album.artist;
  form.elements.album.value=album.title==='Unknown album'?'':album.title;
  let generation=0,selected=null,saving=false;
  const message=error=>String(error.message||error).replace(/^Error invoking remote method '[^']+': Error: /,'');
  const close=()=>{if(!saving)dialog.close();};
  dialog.querySelector('.close-cover').onclick=close;
  dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
  dialog.addEventListener('close',()=>{generation++;dialog.remove();},{once:true});
  form.onsubmit=async event=>{
    event.preventDefault();const request=++generation;selected=null;preview.hidden=true;results.replaceChildren();status.textContent='Searching…';form.querySelector('button').disabled=true;
    try{
      const items=await api.searchCovers(form.elements.artist.value,form.elements.album.value);
      if(request!==generation)return;
      status.textContent=items.length?'Select a result to preview its cover.':'No matches found. Try a shorter album title or change the artist.';
      for(const item of items){
        const button=document.createElement('button');button.type='button';button.className='cover-result secondary';
        button.textContent=`${item.title} · ${item.artist}${item.year?' · '+item.year:''} · ${item.type}`;
        button.onclick=async()=>{
          const attempt=++generation;selected=null;preview.hidden=true;status.textContent='Downloading preview…';
          try{const data=await api.previewCover(item.id);if(attempt!==generation)return;selected=item.id;preview.querySelector('img').src=data;preview.querySelector('p').textContent=`${item.title} · ${item.artist}`;preview.hidden=false;status.textContent='Check the cover, then choose Use this cover.';}
          catch(error){if(attempt===generation)status.textContent=message(error);}
        };results.append(button);
      }
    }catch(error){if(request===generation)status.textContent=message(error);}
    finally{form.querySelector('button').disabled=false;}
  };
  save.onclick=async()=>{
    if(!selected||saving)return;saving=true;save.disabled=true;form.querySelector('button').disabled=true;results.inert=true;status.textContent='Saving cover…';
    try{await api.saveCover(selected,album.tracks.map(track=>track.url));onSaved();saving=false;dialog.close();}
    catch(error){status.textContent=message(error);}
    finally{saving=false;save.disabled=false;form.querySelector('button').disabled=false;results.inert=false;}
  };
  document.body.append(dialog);dialog.showModal();form.elements.artist.focus();
}
