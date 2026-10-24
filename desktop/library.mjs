import { parseFile } from 'music-metadata';
import { metadataFields } from '../shared/metadata.js';
import { readdir, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export const audioExtensions = /\.(mp3|wav|ogg|oga|flac|m4a|aac|opus|webm|aiff?)$/i;
export async function scanFolder(root) {
  const canonicalRoot = await realpath(root);
  if (!(await stat(canonicalRoot)).isDirectory()) throw new Error('The saved music folder is no longer available.');
  const tracks = [], allowed = new Map(), skipped = [];
  async function walk(directory, relative = '') {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch { skipped.push(relative || path.basename(root)); return; }
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      const relativePath = relative ? `${relative}/${entry.name}` : entry.name;
      // Ignore links so a selected folder cannot silently grant access outside it.
      if (entry.isDirectory()) await walk(filePath, relativePath);
      else if (entry.isFile() && audioExtensions.test(entry.name)) {
        const token = randomUUID(); allowed.set(token, filePath);
        tracks.push({ name: entry.name, path: `${path.basename(canonicalRoot)}/${relativePath}`, url: `mando://music/${token}` });
      }
    }
  }
  await walk(canonicalRoot);
  let next = 0;
  await Promise.all(Array.from({length: Math.min(4,tracks.length)}, async () => {
    while(next < tracks.length) {
      const track = tracks[next++], token = track.url.split('/').at(-1);
      try { track.metadata = metadataFields(await parseFile(allowed.get(token), {skipCovers:true,duration:false})); }
      catch { track.metadata = {}; } // A damaged tag must never hide a playable track.
      track.metadata.artworkUrl = `mando://artwork/${token}`;
    }
  }));
  return { library: { name: path.basename(canonicalRoot), tracks, skipped: skipped.length }, allowed };
}
export function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size <= 0) return false;
  let start, end;
  if (!match[1]) { const suffix = Number(match[2]); if (!suffix) return false; start = Math.max(0,size-suffix); end=size-1; }
  else { start=Number(match[1]); end=match[2] ? Math.min(Number(match[2]),size-1) : size-1; }
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start>=0 && start<size && end>=start ? { start, end } : false;
}
