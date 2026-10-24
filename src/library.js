export const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|oga|flac|m4a|aac|opus|webm|aiff?)$/i;
export function trackFromFile(file, path = file.webkitRelativePath || file.name) {
  const parts = path.split('/');
  const stem = file.name.replace(/\.[^.]+$/, '').replace(/^\d+[.\s_-]+/, '');
  const split = stem.indexOf(' - ');
  return { id: path, file, path, title: split > 0 ? stem.slice(split + 3) : stem,
    artist: split > 0 ? stem.slice(0, split) : parts.length > 2 ? parts.at(-3) : 'Unknown artist',
    album: parts.length > 1 ? parts.at(-2) : 'Local collection', format: file.name.split('.').at(-1).toUpperCase(), trackNumber: Number(/^([0-9]+)[.\s_-]+/.exec(file.name)?.[1]) || undefined, genre:'', duration: null };
}
export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
export function filterTracks(tracks, query, favoritesOnly, favorites) {
  const term = query.trim().toLowerCase();
  return tracks.filter(t => (!favoritesOnly || favorites.has(t.id)) && `${t.title} ${t.artist} ${t.album} ${t.genre||''} ${t.path}`.toLowerCase().includes(term));
}
export function nextIndex(length, current, direction, shuffle, random = Math.random) {
  if (!length) return -1;
  if (shuffle && length > 1) return (Math.max(0, current) + 1 + Math.floor(random() * (length - 1))) % length;
  return (current + direction + length) % length;
}

const libraryCollator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
export function compareLibraryItems(a,b,key='title'){
 const field=['title','artist','album','genre'].includes(key)?key:'title';
 const left=a[field]||'',right=b[field]||'';
 if(field==='genre'&&(!left||!right)&&left!==right)return left?-1:1;
 return libraryCollator.compare(left,right)||libraryCollator.compare(a.title||'',b.title||'')||libraryCollator.compare(a.artist||'',b.artist||'')||libraryCollator.compare(a.path||'',b.path||'');
}
