# Type Beat Beast

Desktop app (Electron + TypeScript) for a type beat producer. It takes a finished FL Studio project and a cover image, renders the audio files, uploads the beat to BeatStars, and schedules a YouTube video, with as few clicks as possible.

## How we work

- Build one plan item at a time, together with the user. When an item is done and tested, tick it below and record any new decision under "Decisions".
- Ask before launching FL Studio, opening the user's BeatStars or YouTube account, or uploading/publishing anything.
- Never change the contents of the user's original `.flp` files, in tests or in app code; edit temporary copies instead. Moving the `.flp` into the beat folder at the end is fine; the user asked for it.
- Never store or type the user's passwords.
- Manual steps are acceptable. The goal is fewer steps, not zero.
- The user is a React frontend dev (also knows Express and MongoDB) who is new to Electron and wants to learn it through this project. Explain each new Electron concept briefly the first time it comes up, tied to what they already know (main process ≈ Express server, renderer ≈ React app, IPC ≈ fetch + routes).
- This file loads into every session: when a phase is finished, shrink its section to a short summary.

## This machine

- FL Studio 21.0.3: `F:\Program Files\Fl Studio 21\FL64.exe` (not the default C: location)
- WinRAR 7.00: `C:\Program Files\WinRAR\Rar.exe`
- Installed: Node 22, Python 3.12 (no numpy), git, Chrome. FFmpeg is not installed system-wide.
- The user's projects live in month folders like `F:\Projects\Beats 2026\10\` (99 projects in 2026 so far).

## Project structure and commands

- `npm run dev` starts the app with hot reload · `npm run build` builds into `out/` · `npm start` runs the built app · `npm run typecheck` checks types · `npm test` runs the Vitest tests (`*.test.ts` next to the code).
- Vitest stays on 3.2.x: adding Vitest 4.1 crashes npm 11.2 (`Cannot read properties of null (reading 'edgesOut')`) while it resolves Vitest's optional devtools peers.
- `src/main/` main process (Node: files, FL Studio, WinRAR, windows; `project.ts` reads .flp files) · `src/preload/` the bridge, exposes `window.api` · `src/shared/` code and types both sides use (`Api`, the contract for `window.api`; `parseBeatName`) · `src/renderer/` the React app.
- Renderer: `lib/` state and logic (settings in localStorage, toasts, the beat model, the pipeline, small hooks) · `components/` shared UI (Card, TitleBar, Rail, Mascot, Celebration, controls) · `screens/` one folder or file per screen · `styles/tokens.css` the design tokens and every animation. Components use CSS Modules (`*.module.css`); animations whose speed depends on the BPM are set as inline styles.
- IPC routes so far: `project:read` (invoke) reads an .flp; `window:theme` (send) recolors the caption buttons. Dropped and picked files get their full path through `webUtils.getPathForFile` in the preload.
- The pipeline is a demo for now (`DEMO` in `src/renderer/src/lib/pipeline.ts`): every step is simulated with made-up timings, and the UI says so. Phases 2–4 replace the steps with real work.
- Built with electron-vite 5 (`electron.vite.config.ts`); TypeScript configs: `tsconfig.node.json` (main, preload, shared) and `tsconfig.web.json` (renderer, shared).
- Package versions are pinned exactly, picked at least two weeks after release. electron-vite 5 supports Vite up to 7, so Vite and `@vitejs/plugin-react` stay on 7.x and 5.x.
- Windows stay locked down: `contextIsolation`, `sandbox`, no `nodeIntegration`, a Content-Security-Policy in `index.html`, external links only open in the browser if they're https. The preload must stay CommonJS (no `"type": "module"` in package.json), because sandboxed preloads can't load ES modules.
- This connection sometimes cuts big GitHub downloads short. If Electron's download fails during `npm install`, rerun `node node_modules/electron/install.js`.
- When Claude starts the app, its shell inherits `ELECTRON_RUN_AS_NODE=1` from VS Code, which makes Electron act like plain Node (`app` is undefined). Run it as `env -u ELECTRON_RUN_AS_NODE npm run dev`; adding `ELECTRON_ENABLE_LOGGING=1` prints the page's console to the terminal. The user's own terminal doesn't have this problem.

## FL Studio command line (tested 2026-10-13)

- `FL64.exe /R /Emp3,wav "<project>.flp"` renders without touching the FL window, then FL closes itself: about 35–50 s for a 2:17 beat, FL start-up included. Paths with spaces work when quoted. The `.flp` is left byte-for-byte unchanged.
- Output goes next to the `.flp`, named after it: `<project>.mp3`, `<project>.wav`.
- Quality comes from the Export window's saved settings in the registry, `HKCU\SOFTWARE\Image-Line\FL Studio 21\General\WAVRenderForm` (string values): `WFBox` 0 = 16-bit, 1 = 24-bit; `MP3BitrateSlider` 10 = 192 kbps, 13 = 320 kbps; `BatchBox` 1 = "Split mixer tracks". The user's own values are 16-bit, 192 kbps, split off.
- With `BatchBox` = 1, one render writes `<project>_Master.wav` (the full mix, same loudness as a normal render, so it works as the WAV), `<project>_Current.wav` (FL's special Current track, not a real stem) and `<project>_<mixer track name>.wav` for every mixer track that isn't muted, all full length. Track names can contain symbols and Unicode (`!`, `#`, `[ ]`, `@`, `ℹ`).
- Copies of a project rendered fine from a temp folder (samples use full paths). Watch for projects whose samples sit next to the `.flp`.

## Project file (.flp) format, mixer tracks

- After the `FLhd` header comes the `FLdt` chunk: a list of events. Event id < 64: 1 data byte; < 128: 2; < 192: 4; ≥ 192: varint length, then data.
- Mixer tracks are stored in order (127 of them: 0 = Master, 126 = Current). Event 147 ends each track. Event 204 is the track name (UTF-16LE). Event 236 holds the flags: uint32 at data offset 4, bit 3 (`0x8`) set = track on, clear = muted. Event 235 has one byte per target track (routing; byte 0 = Master).
- Muting or unmuting a track changes exactly one byte. Tested: muting the tag track in a copy removed the tag from the Master, and the split render skipped that track.

## YouTube API (tested 2026-10-13)

- Google Cloud project `type-beat-beast` with a Desktop OAuth client. The key file the user downloaded is `C:\Users\karee\Downloads\client_secret_891478184921-….json`; never commit it to git.
- Uploads from this project are not locked to private: an unlisted test upload stayed unlisted. Scheduling works with `privacyStatus: private` plus `publishAt`. Upload quota: 100 uploads a day.
- A still-image MP4 with an MP3 audio track processed fine. Recipe: `ffmpeg -loop 1 -framerate 1 -i cover.png -i audio.mp3 -map 0:v -map 1:a -c:v libx264 -tune stillimage -pix_fmt yuv420p -c:a copy -shortest -movflags +faststart out.mp4`.
- The user's channel is Kriko (`UCUfUH4y28mILAFL8kES_kQg`); the app can check it's signed in to that channel.
- Sign-in: loopback OAuth with PKCE, scope `https://www.googleapis.com/auth/youtube`. The Google app is still in "Testing", where sign-ins expire after 7 days.
- YouTube Studio upload defaults don't apply to API uploads, so the app sends title, description, tags and category itself. `notifySubscribers` defaults to true (the test set it to false).
- npm `ffmpeg-static` 5.3.0 ships FFmpeg 6.1.1 with libx264 and libmp3lame. Its first download came out truncated with no error, so the app should check the binary runs.

## Naming system

The `.flp` file name carries the beat info, in one of two patterns:

- `beat name - bpm key`, e.g. `8 bit - 151 D#m`
- `main prod x collab prod - beat name - bpm key`, e.g. `kriko x welcomeCarson - ozempic - 132 Fmin`

- The main producer is the user (kriko) and always comes first. Every name after it, separated by `x`, is a collaborator; there can be several (`kriko x A x B - beat name - bpm key`).
- Minor keys: lowercase `m` or `min` (`D#m`, `Fmin`, `Em`). Major keys: capital `M` or `maj` (`CM`, `Cmaj`, `CMAJ`, `Bmaj`). Check the three-letter forms first, in any case, so `CMIN` isn't read as major.
- Read BPM and key from the end of the name. Real files sometimes skip the dash before the BPM (`kriko x welcomeCarson - mushroom 134 Gmin`), and 5 of the 99 put the key first (`my city - Fmin 137`). `src/shared/parseBeatName.ts` handles both and reads all 99 of the user's 2026 names.
- If a name still doesn't fit, the app asks instead of guessing.
- On BeatStars, each collaborator is added in the collabs section: type their name and pick the first result in the dropdown.
- Collaborator spellings vary between files: `wecomeCarson` (typo of `welcomeCarson`), `prodcozee` / `whereiscozee`, `prodbysky` / `sky`. Searching BeatStars with these as written can pick the wrong account, so Phase 3 needs a remembered list mapping file-name spellings to BeatStars usernames.

The app has a small notes window showing these rules, which the user can edit.

## Options

Defaults live in Settings; each beat can override them before it runs.

- Upload stems: yes or no
- BeatStars tagged file: upload the tagged MP3, or reuse the WAV and let BeatStars add its default tag
- Render quality: 24-bit WAV and 320 kbps MP3 by default; WAV bit depth and MP3 bitrate can be changed
- Output location: next to the `.flp` (default) or another folder

## Tag detection

No tag name is hard-coded, so it works if the user changes their tag or someone else uses the app.

- First choice: a mixer track whose name the user has confirmed as a tag before (the app remembers confirmed names).
- Otherwise: the last mixer track in use (highest-numbered named track, 1–125), shown as a guess the user must confirm.
- The pick appears in the beat details before anything renders. The user can choose another track or "No tag".
- Why not trust "last track" alone: in the user's 99 projects from 2026 the tag was the last track in 96. In `pro - 155 Fmin` it was track 6 of 12, and two welcomeCarson collabs have no tag track; there, muting the last track would have removed a real sound (in `somethings never change` it's the only track).

## Design (Claude Design v2, built from 2026-10-16)

- Source: the user's Claude Design project "Music production app screens" (`72a6051a-0502-47e7-af28-3f8a67db3736`), readable with the DesignSync tool (`get_file`). `TBB-Cartoon.dc.html` holds every app screen and its logic, `TBB-Mascot.dc.html` the mascots, `TBB-CartoonNotes.dc.html` the notes window; `Type Beat Beast v2.dc.html` is the overview page.
- Look: "cartoon studio". Sticker cards with thick ink outlines, hard offset shadows, uneven corners and slight tilts on an FL-style grid; the 7 steps drawn as a game level; four mascots (Keys, Subby, Tick, Spinz), one picked at random per run, hopping at the beat's BPM. Dark (default) and light themes. Custom title bar; Windows keeps its own caption buttons (`titleBarOverlay`, 37 px tall over the 40 px bar, right 140 px reserved).
- Tokens live in `src/renderer/src/styles/tokens.css`, copied from the design's CSS variables. Brand colors from the user's palette: orange `#FF6500`, navy `#0B192C`, steel `#1E3E62`, black. Text on orange is navy, never white (white on orange is only 2.9:1).
- Fonts: Fredoka (headings, numbers), Nunito (UI), Caveat (handwritten notes), bundled from `@fontsource`. Icons: `lucide-react` 1.x, which has no brand logos (no YouTube icon).
- Personality: playful microcopy and easter eggs (logo ×5 bounces to the BPM, Konami code "producer mode", BPM 808 joke, after-3-AM moon, publish celebration with confetti). Performance rules: animate only `transform`/`opacity`, pause everything while the window is hidden, honor reduced motion (OS setting or Settings → Motion), and keep errors plus the BeatStars review calm and readable.

## Beat folder

By default the app creates a folder named after the beat inside the folder that holds the `.flp`, and puts every rendered file and the video there, along with a status file so a failed step can be retried without redoing the ones before it. When everything has finished, it moves the original `.flp` and the cover image into that folder too.

## The flow for one beat

1. Pick the `.flp` and the cover image. The app reads beat name, BPM, key and collaborators from the file name (see Naming system) and picks the tag track (see Tag detection); the user can edit the details before continuing. The project can be saved with the tag on or off; it doesn't matter.
2. **Auto:** render a temporary copy with the tag track muted, with "Split mixer tracks" on: the Master file is the untagged WAV, the rest are the stems. With stems turned off, a normal WAV render.
3. **Auto:** render a temporary copy with the tag track on: the tagged MP3. Then delete both copies.
4. **Auto:** pack the stems into a RAR, leaving out Master and Current.
5. **Auto:** fill in the whole BeatStars upload in Chrome, including collaborators. **Manual:** the user reviews and confirms, then it publishes.
6. **Auto:** make the YouTube video (cover + tagged audio, with an MP3 audio track), upload it with the title, description and tags, and schedule it for the next free day at the daily publish time.
7. **Auto:** move the original `.flp` and the cover image into the beat folder.

## Phase 0 — Tests (done 2026-10-13)

Everything risky works on this PC: FL Studio renders from the command line (stems included), the app can mute the tag in a project copy, and YouTube uploads and scheduling work without Google's audit. Details are in the sections above.

## Phase 1 — App skeleton and beat info

Build the parts without screens first (while the user makes the design), then the screens from the mockups.

- [x] Electron + TypeScript + React project
- [x] Bridge between React and Node: preload + IPC (`project:read`, `window:theme`), security defaults on
- [x] Custom title bar and dark/light themes (toggle in the title bar; Settings → Appearance comes with the Settings screen)
- [x] New beat screen from the design: drop the .flp and cover, name/BPM/key, options, More (collabs, tag track, timers), the game-level pipeline with mascots, step log, Run, the BeatStars review and the publish celebration (pipeline is a demo)
- [x] File-name parser for both naming patterns, with tests (`src/shared/parseBeatName.ts`)
- [ ] Schedule and History screens from the design
- [ ] Settings screen from the design (paths, quality, defaults, YouTube, BeatStars, tags, appearance)
- [ ] Notes window with the naming rules, as its own window

## Phase 2 — Audio files

- [ ] Beat folder: create it in the output location; at the very end, move the `.flp` and cover image into it (check the moved `.flp` still finds its samples)
- [ ] Temporary project copies with the tag track muted or on (reading the mixer tracks is done: `src/main/project.ts`, tested on a synthetic .flp and on flowers)
- [x] Tag picker in the beat details (More card): remembered names first, else the last track as a guess, plus "No tag"; running remembers the pick
- [ ] Render runner: make sure FL is closed, set the registry values, run the command line, wait for FL to exit, restore the user's values
- [ ] Untagged WAV + stems in one split render from the muted copy (a normal WAV render when stems are off)
- [ ] Tagged MP3 render from the unmuted copy
- [ ] Pack the stems with WinRAR, without Master and Current

## Phase 3 — BeatStars

- [ ] Separate Chrome profile for the app; the user logs in to BeatStars there once
- [ ] Record one upload done by hand with Playwright's recorder, then turn it into the upload script
- [ ] Upload the files (following the stems and tagged-file options); fill in title, BPM, key and artwork; turn on the free tagged MP3 download (non-commercial)
- [ ] Collaborators: for each one, type the name in the collabs section and pick the first dropdown result; flag it in the review if the picked account's name doesn't match
- [ ] Collaborator name list: remember which BeatStars username each file-name spelling means (see Naming system)
- [ ] Stop for the user's confirmation, then publish; save the beat's BeatStars link

## Phase 4 — YouTube

- [ ] Switch the Google app from "Testing" to "In production" (Google Auth Platform → Audience) so sign-ins don't expire every 7 days
- [ ] Sign-in inside the app; keep the token safely on this PC
- [ ] Video: cover + tagged audio → MP4 with an MP3 audio track (recipe above)
- [ ] Title and description from the user's templates, with BPM and key filled in
- [ ] Upload through the YouTube API, scheduled for the next free daily slot
- [ ] Queue view showing what's scheduled when

## Phase 5 — Polish

- [ ] One "Run" button that goes through every step, stopping only for the BeatStars confirmation
- [ ] Queue several beats at once
- [ ] Retry failed steps, readable logs

## Decisions

- **Stack:** Electron + TypeScript, a real desktop program (VS Code is built with Electron). HTML/CSS draws the window; everything else runs locally with full access to files, FL Studio, WinRAR and Chrome. FFmpeg comes in as an npm package, so nothing extra gets installed.
- **UI:** React.
- **Rendering:** FL Studio's command line for every render, stems included. The app sets quality and "Split mixer tracks" in the registry right before each render and restores the user's values afterwards.
- **Tags:** handled automatically. The app picks the tag track (see Tag detection) and renders from temporary copies with it muted (WAV + stems, first) or on (MP3, second). The user's `.flp` is never changed.
- **Quality:** 24-bit WAV and 320 kbps MP3 by default, changeable in Settings.
- **Video audio:** MP3, not AAC. If the source is already an MP3, its audio goes into the video unchanged (no re-encode); anything that needs encoding uses libmp3lame at 320 kbps.
- **YouTube:** the official API, not browser automation. No audit needed for this project.
- **Stems archive:** RAR with WinRAR. Fall back to ZIP if BeatStars rejects RAR.
- **Logins:** the app never stores or types passwords. BeatStars: the user logs in once in the app's own Chrome profile. YouTube: a one-time Google permission screen.
- **BeatStars plan:** Pro, so stem uploads are available.

## Open questions (answer when that phase starts)

- [ ] Phase 3–4: BeatStars and YouTube title formats
- [ ] Phase 3: BeatStars defaults (genre, moods, tags, licenses, free download settings)
- [ ] Phase 4: YouTube description template, tags, category, playlist; daily publish time and timezone
- [ ] Phase 4: is the YouTube audio the same tagged MP3 as BeatStars, or a different tag?
- [ ] Phase 4: where the artist name in "X Type Beat" comes from
- [ ] Phase 4: notify subscribers when a scheduled video goes live? (YouTube's default: yes)
