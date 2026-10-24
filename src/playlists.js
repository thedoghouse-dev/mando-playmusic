export function normalizePlaylists(value) {
  if(!Array.isArray(value)) return [];
  const ids=new Set();
  return value.filter(p=>p && typeof p.id==='string' && typeof p.name==='string' && p.name.trim() && Array.isArray(p.entries) && !ids.has(p.id) && ids.add(p.id)).map(p=>({
    id:p.id,name:p.name.trim().slice(0,120),entries:[...new Map(p.entries.filter(e=>e && typeof e.trackId==='string').map(e=>[e.trackId,{trackId:e.trackId,title:String(e.title || 'Unknown song'),artist:String(e.artist || 'Unknown artist'),album:String(e.album || 'Unknown album')}])).values()]
  }));
}
export function addPlaylistTracks(playlist,tracks) {
  const known=new Set(playlist.entries.map(entry=>entry.trackId));
  const entries=[...playlist.entries];
  for(const track of tracks) if(!known.has(track.id)) {known.add(track.id);entries.push({trackId:track.id,title:track.title,artist:track.artist,album:track.album});}
  return {...playlist,entries};
}
export function movePlaylistTrack(playlist,from,to) {
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=playlist.entries.length||to>=playlist.entries.length) return playlist;
  const entries=[...playlist.entries];entries.splice(to,0,entries.splice(from,1)[0]);return {...playlist,entries};
}
export function resolvePlaylist(playlist,tracks) {
  const byId=new Map(tracks.map(track=>[track.id,track]));
  return playlist.entries.map(entry=>({...entry,track:byId.get(entry.trackId) || null}));
}
