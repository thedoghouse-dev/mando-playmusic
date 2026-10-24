const normalize = value => String(value || '').trim().normalize('NFKC').toLocaleLowerCase();
const collator = new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
export function compareAlbumTracks(a,b) {
  return (a.discNumber || 1)-(b.discNumber || 1) || (a.trackNumber || Infinity)-(b.trackNumber || Infinity) || collator.compare(a.path,b.path);
}
export function groupAlbums(tracks) {
  const groups = new Map();
  for(const track of tracks) {
    const artist=track.albumArtist || track.artist || 'Unknown artist';
    const title=track.album || 'Unknown album';
    const id=JSON.stringify([normalize(artist),normalize(title)]);
    if(!groups.has(id))groups.set(id,{id,title,artist,tracks:[],artworkUrls:[]});
    const album=groups.get(id);album.tracks.push(track);
    if(track.artworkUrl && !album.artworkUrls.includes(track.artworkUrl))album.artworkUrls.push(track.artworkUrl);
  }
  return [...groups.values()].map(album=>({...album,album:album.title,genre:[...new Set(album.tracks.map(t=>t.genre).filter(Boolean))].sort(collator.compare).join(', '),artworkUrl:album.artworkUrls[0],tracks:album.tracks.sort(compareAlbumTracks)})).sort((a,b)=>collator.compare(a.title,b.title)||collator.compare(a.artist,b.artist));
}
export function matchingAlbums(albums,query) {
  const term=normalize(query);
  return albums.filter(album=>normalize(`${album.title} ${album.artist} ${album.tracks.map(t=>`${t.title} ${t.artist} ${t.genre||''}`).join(' ')}`).includes(term));
}
export function queueTracks(tracks,ids) {
  const byId=new Map(tracks.map(track=>[track.id,track]));
  return ids.length ? ids.map(id=>byId.get(id)).filter(Boolean) : tracks;
}
