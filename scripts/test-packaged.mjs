import path from 'node:path';
import fs from 'node:fs';
const version=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
const versioned=[version+'-final',version].map(folder=>path.resolve('release',folder,'win-unpacked','Mando.exe')).find(file=>fs.existsSync(file));
process.env.MANDO_TEST_EXECUTABLE ||= versioned||path.resolve('release/win-unpacked/Mando.exe');
await import('./test-desktop.mjs');

await import('./test-playlists-desktop.mjs');

await import('./test-visuals-desktop.mjs');

await import('./test-visualizer-window.mjs');



await import('./test-window-restore.mjs');
await import('./test-genre-desktop.mjs');

await import('./test-genre-filter-desktop.mjs');
