// Conservative matching: punctuation/case differences are fine; editions and artists must agree.
const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function exactCoverMatch(album,results){
  if(!normalize(album.artist)||!normalize(album.title)||/^unknown /i.test(album.artist)||/^unknown /i.test(album.title))return null;
  const matches=results.filter(result=>normalize(result.artist)===normalize(album.artist)&&normalize(result.title)===normalize(album.title));
  return matches.length===1?matches[0]:null;
}
export async function downloadMissingCovers(albums,{hasArtwork,search,preview,save,stopped=()=>false,onProgress=()=>{},onSaved=()=>{},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
  const summary={total:albums.length,checked:0,saved:0,existing:0,unmatched:0,failed:0,stopped:false,paused:false,reason:''};
  const emit=(album,phase,detail='')=>onProgress({...summary,album,phase,detail});
  for(const album of albums){
    if(stopped())break;
    emit(album,'checking');
    try{
      if(await hasArtwork(album)){
        summary.existing++;summary.checked++;emit(album,'existing');continue;
      }
      if(stopped())break;
      if(/^unknown /i.test(album.artist)||/^unknown /i.test(album.title)||!normalize(album.artist)||!normalize(album.title)){
        summary.unmatched++;summary.checked++;emit(album,'unmatched','Artist or album tags are missing.');continue;
      }
      emit(album,'searching');
      // Space requests, including the first one after a manual search.
      await wait(1200);if(stopped())break;
      let results;
      try{results=await search(album.artist,album.title);}
      catch(error){summary.failed++;summary.paused=true;summary.reason=String(error.message||error);emit(album,'error',summary.reason);break;}
      if(stopped())break;
      const match=exactCoverMatch(album,results);
      if(!match){summary.unmatched++;summary.checked++;emit(album,'unmatched','No single exact artist and album match.');continue;}
      emit(album,'downloading');await preview(match.id);if(stopped())break;
      // Recheck immediately before saving in case artwork was added during the search.
      if(await hasArtwork(album)){summary.existing++;summary.checked++;emit(album,'existing');continue;}
      if(stopped())break;
      await save(match.id,album);summary.saved++;summary.checked++;onSaved(album);emit(album,'saved');
    }catch(error){summary.failed++;summary.checked++;emit(album,'error',String(error.message||error));}
  }
  summary.stopped=stopped();onProgress({...summary,phase:'done'});return summary;
}
