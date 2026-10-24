# Changelog

Changes are listed newest first. Historical entries summarize the project notes;
versions before this repository's initial commit do not have separate Git commits or tags.

## Unreleased

Record changes made after 0.8.6 here. When publishing a release, move its entries
under a heading matching the version in package.json.

## 0.8.6

### Added

- Find missing covers checks the entire library and downloads exact artist/album matches in one run, skipping all existing artwork.
- Bulk progress, results, stop/retry, conservative matching, paced searches, and pause on search-service errors.

## 0.8.5

### Added

- Find cover art in album details: search MusicBrainz, preview Cover Art Archive images, and save a selected cover locally in Mando.
- Downloaded covers persist across restarts, refresh immediately, and are used after embedded and folder artwork. Searches are opt-in and send only the entered artist and album.

## 0.8.4

### Added

- Windows album artwork falls back to folder.jpg, cover.jpg, then front.png in each song’s folder, with case-insensitive filenames.
- Embedded artwork remains the first choice; corrupt images are skipped and rescanning refreshes cached covers.

## 0.8.3

### Changed

- Moved play music closer to mando. and distributed its letters across the full wordmark width, including the period.
- Subtitle alignment adjusts automatically with the wordmark size.

## 0.8.2

### Changed

- Restored the lowercase mando. wordmark and its green period.
- Lowercased play music and tightened the gap beneath the wordmark from 6 to 2 pixels.

## 0.8.1

### Changed

- App branding now reads Mando Play Music, with a large Mando wordmark and a smaller Play Music subtitle.
- Windows titles, About dialog, installer identity, and shortcuts use the full app name.
- Icon generation now resolves its output paths relative to the project after relocation.

### Fixed

- Corrected dependency lockfile version metadata to match the already-resolved package.

## 0.8.0

### Added

- Genre picker with song counts, exact matching, multiple-tag support, and an Unknown genre option.
- Play genre and Shuffle genre actions, with Next, Previous, and automatic advancement restricted to the selected results.
- Genre filtering combined with search, Favorites, and album browsing; empty results disable playback actions.

### Fixed

- Normal playback interruptions during rapid skipping no longer show a misleading codec error.
- Duplicate genre tags preserve the first spelling of the genre name.

## 0.7.0

### Added

- Persistent visualizer monitor, window position/size, and fullscreen settings.
- Automatic visualizer reopening when it was open at shutdown, with a primary-monitor fallback for disconnected displays.
- Genre tags, Genre A-Z sorting and searching for tracks and albums, and a saved library-sort preference.

## 0.6.0

### Added

- Independent visualizer window for a second monitor, with live audio, preset, and settings synchronization.
- Fullscreen controls, F/F11 and Esc shortcuts, double-click fullscreen, and a toolbar that fades while fullscreen.
- Playback controls remain available in the main player, including when it is minimized.

### Fixed

- Fullscreen cropping and incorrect display scaling by matching the canvas drawing buffer and renderer output dimensions.
- Mando Orbit rendering and blended transitions by filling Butterchurn's required shape/wave slots.

## 0.5.1

### Added

- Background importing and paged browsing for large MilkDrop collections.
- Support for up to 30,000 presets and 50,000 archive entries, with bounded input and expanded-content sizes.
- Compatibility checks on playback for large collections.
- Start visualizer action that reveals the main display.

### Fixed

- Large preset ZIPs rejected by the original file-count and expanded-size limits.
- Restart visualizer leaving the settings window over the main display.

## 0.5.0

### Added

- Visualization Studio with live preview, preset search, favorites, pack filters, and pack removal.
- Installable ZIP, MilkDrop .milk, and converted JSON preset packs, including supported local textures.
- Mando Visuals with original scenes, adjustable beat sensitivity, a two-color palette, and smooth transitions.
- Classic MilkDrop / Butterchurn mode, beat-triggered or timed automatic transitions, and saved visualization settings.
- Isolated preset execution, renderer restart recovery, and an original starter pack.

## 0.4.0

### Added

- Saved playlists with create, rename, delete, and song or whole-album additions.
- Drag and arrow controls to rearrange songs, duplicate prevention, and unavailable-song handling.
- Playlist playback queues and saved order across app restarts.

## 0.3.0

### Added

- Album-art browsing, album detail pages, and album playback queues.
- Album grouping by album artist and title, with disc/track ordering and compilation support.

## 0.2.0

### Added

- Embedded title, artist, album, album-artist, and track/disc metadata.
- Embedded artwork in the library and player, with local caching and fallbacks for missing or damaged tags.

## 0.1.1

### Fixed

- Silent native music playback caused by cross-origin audio routed through Web Audio.
- Playback verification now checks both a nonzero audio signal and audible output.

## 0.1.0

### Added

- Local music-folder playback with nested scanning, search, sorting, favorites, shuffle, repeat, and seeking.
- Butterchurn visualizations, a generated sound/visual demo, and fullscreen display.
- Standalone Windows installer and portable executable using Electron.
- Remembered music folders, local metadata access, and byte-range music streaming.
