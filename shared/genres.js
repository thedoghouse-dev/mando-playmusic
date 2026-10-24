export const UNTAGGED_GENRE='untagged';
const key=value=>value.trim().normalize('NFKC').toLocaleLowerCase();
export function genresFor(track){
 const values=Array.isArray(track?.genres)?track.genres:typeof track?.genre==='string'?track.genre.split(','):[];
 const genres=new Map();for(const value of values)if(typeof value==='string'&&value.trim()&&!genres.has(key(value)))genres.set(key(value),value.trim());return [...genres.values()];
}
export function matchesGenre(track,selected=''){if(!selected)return true;const genres=genresFor(track);return selected===UNTAGGED_GENRE?!genres.length:genres.some(value=>'genre:'+key(value)===selected);}
export function filterByGenre(tracks,selected=''){return selected?tracks.filter(track=>matchesGenre(track,selected)):tracks;}
export function genreOptions(tracks){const options=new Map();let untagged=0;for(const track of tracks){const genres=genresFor(track);if(!genres.length)untagged++;for(const label of genres){const value='genre:'+key(label);if(!options.has(value))options.set(value,{value,label,count:0});options.get(value).count++;}}const result=[...options.values()].sort((a,b)=>a.label.localeCompare(b.label,undefined,{sensitivity:'base',numeric:true}));if(untagged)result.push({value:UNTAGGED_GENRE,label:'Unknown genre',count:untagged});return result;}
