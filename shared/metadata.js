import {genresFor} from './genres.js';
// Preserve a useful fallback for each missing or blank tag independently.
export function applyMetadata(track, metadata = {}) {
  const result = { ...track };
  for (const key of ['title','artist','album','albumArtist','genre']) {
    if (typeof metadata[key] === 'string' && metadata[key].trim()) result[key] = metadata[key].trim();
  }
  if(Array.isArray(metadata.genres)){result.genres=genresFor({genres:metadata.genres});result.genre=result.genres.join(', ');}
  if (Number.isFinite(metadata.duration) && metadata.duration > 0) result.duration = metadata.duration;
  for (const key of ['trackNumber','discNumber']) if(Number.isInteger(metadata[key]) && metadata[key]>0) result[key]=metadata[key];
  if (metadata.artworkUrl) result.artworkUrl = metadata.artworkUrl;
  return result;
}
export function metadataFields({ common = {}, format = {} } = {}) {
  return { genres:genresFor({genres:Array.isArray(common.genre)?common.genre:[common.genre]}), title: common.title, artist: common.artist || common.artists?.join(', ') || common.albumartist, album: common.album, genre: genresFor({genres:Array.isArray(common.genre)?common.genre:[common.genre]}).join(', '), albumArtist: common.albumartist, trackNumber: common.track?.no, discNumber: common.disk?.no, duration: format.duration };
}
