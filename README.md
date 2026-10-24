# Mando Play Music for Windows

A standalone local music player with MilkDrop-compatible visualizations, powered by Electron and Butterchurn. No browser, Node.js installation, or development server is needed to use a release build.

## Install or launch

Builds are generated locally in `release/`; installers and other build outputs are excluded from Git:

- **Mando-Play-Music-0.8.3-Setup.exe** — installs for your Windows user, with Start menu and desktop shortcuts. Includes an uninstaller and a choice of installation folder.
- **Mando-Play-Music-0.8.3-Portable.exe** — double-click to run without installing. Keep this executable wherever you like.

Requires 64-bit Windows 10 or later. The release is unsigned; Windows may show an unknown-publisher prompt.

Choose **Open music folder** (or **File → Open music folder**, Ctrl+O). Subfolders are scanned automatically. Your selected folder is remembered and rescanned on the next launch. Use **File → Rescan music folder** (F5) to pick up new files. If a removable drive is disconnected, reconnect it or choose another folder.

Favorites, volume, and the saved folder are stored in your Windows app-data profile, independently from the browser version. Portable refers to installation-free launch; preferences still live in the Windows user profile.

## Features

- Local folder playback, search, sorting, favorites, shuffle, repeat, seeking, and volume.
- Album artwork, embedded file tags, album browsing, and saved playlists with editable playback order.
- Genre sorting and filtering, with Play genre and Shuffle genre restricted to matching songs.
- MilkDrop-compatible preset packs, Visualization Studio, and customizable Mando Visuals.
- A separate visualizer window, fullscreen (F11), and remembered monitor/fullscreen settings.
- Media keys for play/pause and previous/next track while the app is focused.
- Locally generated sound & visual demo, with no external audio needed.
- Music streams from disk, including byte-range requests for seeking; entire files are not copied into memory.
- Fonts, application code, and visualizer presets are bundled. No runtime internet connection is required, and music is never uploaded.

Track titles, artists, albums, and available durations are read from embedded music tags (including ID3, FLAC/Vorbis, and MP4 tags). Embedded front-cover artwork appears in the track list and now-playing panel. Each missing or blank tag falls back independently to `Artist - Title.ext` filenames and `Artist/Album/track.ext` folders. Untagged tracks retain a placeholder cover. Artwork is read locally; there is no online artwork lookup. Native artwork is loaded on demand and cached as bounded thumbnails. Corrupt tags do not prevent tracks from appearing. Files are read without modifying their tags. Supported extensions include MP3, FLAC, WAV, M4A, AAC, OGG, Opus, WebM and AIFF; actual playback depends on codec support. MilkDrop `.milk`, compatible converted JSON, and ZIP preset packs can be imported in Visualization Studio. Native Winamp DLL plug-ins are not supported.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the release history and a place to record upcoming changes.

## Development

Node.js 22.12+ is recommended.

```sh
npm install
npm run desktop
```

Build the Windows x64 installer and portable executable:

```sh
npm run dist:win
```

The browser version remains available with `npm run dev` at http://127.0.0.1:5173. Chrome/Edge can remember browser folder permissions; other browsers may need folder selection each session.

## Validation

```sh
npm test
npm run test:desktop
npm run test:packaged
npx playwright test
```

Desktop integration checks use generated audio and a separate `.desktop-test/profile` directory. They cover native folder selection, restored folders after restart, actual playback, MilkDrop startup, seeking, byte-range streaming, fullscreen, denied unknown media tokens, and a renderer without Node.js access.

The desktop shell uses a sandboxed, isolated renderer, a narrow preload bridge, restricted navigation, and opaque URLs for selected audio files.

Butterchurn and presets retain their upstream licenses: https://github.com/jberg/butterchurn and https://github.com/jberg/butterchurn-presets. Fonts and other dependencies retain their upstream licenses.

## 0.1.1 audio fix

Fixed silent native music playback caused by cross-origin media being routed into Web Audio without a CORS request. Desktop regression tests now require a nonzero audio waveform and Electron audible-output state, in addition to advancing playback time.

## 0.2.0 metadata and artwork

Added embedded artist, album, and title tags plus album cover images in the library and player. Existing saved folders are rescanned on launch; File → Rescan music folder refreshes changed tags. Favorites keep their existing file-based identity. Tests include ID3-tagged WAV and FLAC/Vorbis fixtures, embedded picture decoding, tag precedence, Unicode, blank tags, malformed files, browser imports, and real audio output from the packaged executable.

## 0.3.0 album browsing

Choose Albums in the sidebar or library tabs to browse a cover-art grid. Search by album, album artist, or song title, then click an album to see its songs. Play album starts at the first song; selecting an individual song starts there. Next, Previous, shuffle, and automatic advancement stay within that album until you start playback from another collection. Browsing elsewhere does not replace the playback queue. Playback stops after the final album song unless track repeat or shuffle is enabled.

Albums are grouped by album artist and title. Compilation albums use the embedded album-artist tag to stay together; albums with the same title by different artists remain separate. Songs sort by disc and track tags, with filename order as a fallback. Album covers use embedded artwork from the album songs and a placeholder when none is available. All albums returns to the grid and restores its previous search. Existing music folders are rescanned automatically at launch.

## 0.4.0 saved playlists

Choose Playlists in the sidebar, then New playlist. Playlists and edits save automatically in your Windows user profile. Rename or delete a playlist from its header; deleting a playlist does not delete music files.

Use the list-plus button beside a song to add it to an existing playlist or create a new one. On an album page, Add album to playlist appends its songs in album order. Songs already in the destination playlist are skipped.

Open a playlist and drag rows to rearrange them, or use the up/down buttons. Clear the song search before reordering. Play playlist starts at the first available song; click a song to start there. Next, Previous, and automatic advancement use the saved order. Editing an active playlist updates the upcoming order. Browsing another view does not change the playback queue. Shuffle intentionally overrides sequential order within the playlist. Removing the playing song lets it finish before advancing to the edited list.

Playlists store stable file references and title/artist/album labels, without temporary playback or artwork URLs. Files outside the currently connected folder remain in playlists as unavailable entries. Reconnect the original music folder to make them playable again. Moving or renaming a music file can require re-adding that file. Playlists are saved locally and do not sync to other computers or export to M3U.

Tests cover song and whole-album additions, duplicate handling, drag/arrow ordering, playback updates, automatic advancement and stopping, removal, rename/delete, storage failures, missing-file recovery, and full Windows app restart persistence with audible playback.

## 0.5.0 visualization studio and preset packs

Click Visualizer in the sidebar or the preset name under the visualizer to open Visualization Studio. It includes a live preview, search, favorites, pack filters, and two built-in plugins: Mando Visuals and Classic MilkDrop / Butterchurn. Mando Originals includes three original scenes.

Mando Visuals adds adjustable beat sensitivity and a two-color palette to MilkDrop waves and shapes. Custom per-pixel shaders may retain additional colors. Classic keeps the original preset equations and disables the Mando-specific controls. Beat detection uses real audio onsets and an adaptive bass-energy baseline; it is not a guaranteed BPM or downbeat tracker.

Choose a blend duration from 0 to 8 seconds and an automatic rotation interval from 5 to 120 seconds. On the next beat waits for an onset after the interval; if none arrives within three extra seconds, it transitions on the timer. Disable Auto to stay on a preset. Manual previous/next changes use the chosen blend duration.

Install pack accepts local .zip packs containing classic .milk or converted Butterchurn .json presets, individual .milk/.json files, and Mando visual-pack JSON manifests. Conversion and validation run locally. Unsupported files are reported and skipped; a pack with no compatible presets is not installed. Try examples/Mando-Starter-Pack.zip. External texture images in ZIPs support PNG/JPEG/WebP, with common sampler names derived from filenames. Native Winamp DLLs, MilkDrop 3 extensions, arbitrary external texture paths, and internet downloads are not supported.

Imported packs save in IndexedDB in the app profile; controls, selected preset, and favorites save in localStorage. Pack checkboxes include/exclude packs from automatic rotation. Remove a pack with its × button. Music-folder permissions, playlists, and imported preset code are separated: the renderer is a sandboxed frame without same-origin access or the Electron preload bridge, receiving only audio waveform samples and visual settings over a MessageChannel. Its content policy prevents network requests. Restart visualizer recreates it without interrupting the main audio path.

Limits: 128 MB per input file, 256 MB of supported expanded ZIP contents, 30,000 presets per pack, 50,000 archive entries, 2 MB per preset text/JSON, and 64 texture images at 4 MB each. Textures are limited to 4096 pixels per dimension and a combined 16-megapixel budget. Pack compatibility depends on preset syntax and GPU shader support.

Third-party visualization notices ship in build/visualizer-notices.txt. Tests cover real MilkDrop and shader ZIP imports, embedded texture decoding, invalid input, sandbox access restrictions, saved settings and packs after a full app restart, live nonzero audio delivery, preview, renderer restart recovery, and audible playback.

## 0.5.1 large preset collections

Large collections such as Cream of the Crop import in a background worker. Unrelated files and directories do not count toward the expanded-content budget. Packs with more than 100 presets are checked for compatibility on playback rather than rendering every preset during installation; failed presets are excluded from automatic rotation for the session. Search and pack filters cover the full collection; Show more pages through 100 results at a time.

## 0.6.0 separate visualizer window and fullscreen fit

Click Pop out above the visualizer, Open separate window in Visualization Studio, or View → Open visualizer window (Ctrl+Shift+V). The independent window can be dragged to any monitor. It initially opens on another connected display when available. F, F11, double-click on the image, or the Fullscreen button toggles fullscreen; Esc exits. The toolbar fades while fullscreen and reappears on mouse movement. Music controls returns focus to the player; N/P or the arrow buttons change presets.

Music playback, playlists, volume, preset selection, sensitivity, colors, and transitions remain controlled by the main player. The display receives waveform samples and the selected preset/settings; it does not open a second audio output. Closing it leaves playback running; reopening restores the current preset. Opening it again focuses the existing window. Closing the main player also closes the display. Normal window position is retained while the app remains open.

Both visualizer views now explicitly resize their canvas drawing buffers and Butterchurn output viewports in physical pixels, preserving the complete frame at fullscreen, fractional Windows display scales, and monitor changes. Rendering resolution follows display scaling up to 1.5× and a 4096-pixel maximum dimension while retaining aspect ratio. Custom preset shapes/waves fill the renderer's required slots, fixing Orbit rendering and transitions. Imported equations remain inside an opaque-origin sandbox without the desktop bridge.

Native checks cover inline and separate fullscreen, live audio with the player minimized, main-window pause/resume, live settings and imported presets, keyboard shortcuts, scaling, full-frame gradient edge capture, one-window reuse, close/reopen, and shutdown.

## 0.7.0 remembered visualizer display and genre sorting

The separate visualizer saves its monitor, normal window position/size, and fullscreen state in the app profile. If it is open when Mando quits, it reopens automatically on the next launch without starting music. Closing the visualizer yourself keeps it closed at the next launch; Pop out still restores its saved placement and fullscreen preference. Disconnected displays fall back to the primary monitor; moved/resized displays clamp the saved window within the current work area.

Choose Genre A–Z in the library sort menu. Genres come from embedded file tags, with multiple genres shown together. Untagged music sorts last as Unknown genre. The genre column is visible while sorting tracks by genre, and album cards show genre labels while sorted by genre. Genre searches work for tracks and albums. The sort preference is remembered. Album song order and saved playlist order stay intact. Existing desktop folders rescan on launch, so their genre tags become available after updating; File → Rescan music folder refreshes tags later.

Checks cover ID3 genres, multiple/blank tags, genre sorting and queues, search, saved sort after restart, native monitor/fullscreen restoration across app relaunches, explicit-close behavior, disconnected-display fallback, and malformed saved bounds.

## 0.8.0 genre filter and genre playback

Choose a genre in the Genre picker above the library. The picker lists your tagged genres with song counts, plus Unknown genre for untagged music. Matching is exact and case insensitive; multiple embedded genres remain separate filter choices.

Play genre starts the matching results in the displayed order and turns shuffle off. Shuffle genre starts a random matching song and turns shuffle on. Next, Previous, and automatic advancement stay within that queue. Search, Favorites, and album browsing narrow the matching results further; Play/Shuffle genre use the displayed results and disable when empty. In a mixed-genre album, only songs matching the selected genre are shown and played.

Clear filter restores browsing all genres without changing the current playback queue. Selecting another genre also leaves current playback alone until you start a matching song or use Play/Shuffle genre. Saved playlist order remains controlled by the playlist view, where the genre controls are hidden. Genre selection resets when importing/rescanning a folder; the existing sort preference remains saved.

Checks cover exact/multiple genre tags, untagged music, search and album intersections, empty results, bounded next/previous/shuffle queues, natural track-end advancement and stopping, native audible playback, and clear-filter behavior.
