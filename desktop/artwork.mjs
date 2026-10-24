import { readdir, lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
const maxBytes = 20 * 1024 * 1024;
const coverNames = ['folder.jpg', 'cover.jpg', 'front.png'];
export function createArtworkLoader({parseFile, selectCover, nativeImage, downloaded = async () => null}) {
  const tracks = new Map(), folders = new Map();
  function thumbnail(bytes) {
    if (!bytes?.length || bytes.length > maxBytes) return null;
    const image = nativeImage.createFromBuffer(Buffer.from(bytes));
    if (image.isEmpty()) return null;
    const size = image.getSize(), scale = Math.min(1,512/Math.max(size.width,size.height));
    return image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale)),quality:'good'}).toPNG();
  }
  function remember(cache, key, task) {
    cache.set(key, task);
    while (cache.size > 48) cache.delete(cache.keys().next().value);
    return task;
  }
  function folderCover(directory) {
    if (folders.has(directory)) return folders.get(directory);
    return remember(folders, directory, (async () => {
      let entries;
      try { entries = await readdir(directory, {withFileTypes:true}); } catch { return null; }
      for (const name of coverNames) {
        const candidates = entries.filter(entry => entry.isFile() && entry.name.toLowerCase() === name).sort((a,b)=>a.name.localeCompare(b.name));
        for (const entry of candidates) {
          try {
            const file = path.join(directory,entry.name), info = await lstat(file);
            // Only regular files in the song's own folder; never follow image links.
            if (!info.isFile() || info.size > maxBytes) continue;
            const result = thumbnail(await readFile(file));
            if (result) return result;
          } catch { /* Try the next local cover. */ }
        }
      }
      return null;
    })());
  }
  function artwork(file) {
    if (tracks.has(file)) return tracks.get(file);
    return remember(tracks, file, (async () => {
      try {
        const cover = selectCover((await parseFile(file,{duration:false})).common.picture);
        const result = thumbnail(cover?.data);
        if (result) return result;
      } catch { /* Missing or damaged tags must not prevent folder artwork. */ }
      return await folderCover(path.dirname(file)) || await downloaded(file);
    })());
  }
  artwork.clear = () => { tracks.clear(); folders.clear(); };
  return artwork;
}
