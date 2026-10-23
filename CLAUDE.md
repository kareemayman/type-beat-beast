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
- WinRAR 7.00: `C:\Program Files\WinRAR\Rar.exe` (its installer records `HKLM\SOFTWARE\WinRAR` → `exe64`; Rar.exe sits next to it). The user's own stem RARs use WinRAR's defaults (RAR5, normal compression), which the app keeps.
- Installed: Node 22, Python 3.12 (no numpy), git, Chrome 155 (`C:\Program Files\Google\Chrome\Application\chrome.exe`, recorded under `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe`). FFmpeg is not installed system-wide.
- The user's projects live in month folders like `F:\Projects\Beats 2026\10\` (99 projects in 2026 so far).

## Project structure and commands

- `npm run dev` starts the app with hot reload (only the React app reloads; after changing `src/main` or `src/preload`, stop and restart it) · `npm run build` builds into `out/` · `npm start` runs the built app · `npm run typecheck` checks types · `npm test` runs the Vitest tests (`*.test.ts` next to the code) · `npm run record:beatstars` (`scripts/record-beatstars.mjs`) opens Playwright's recorder on the app's Chrome profile at BeatStars' sign-in page; what the user does there is saved to `recordings\` (git-ignored), with anything typed into a password field removed. Only the user runs it: it opens their BeatStars account.
- Vitest stays on 3.2.x: adding Vitest 4.1 crashes npm 11.2 (`Cannot read properties of null (reading 'edgesOut')`) while it resolves Vitest's optional devtools peers.
- `src/main/` main process (Node: files, FL Studio, WinRAR, windows; `project.ts` reads .flp files and writes the tag-switched copies; `beatFolder.ts` works out a beat's folder and file names; `render.ts` renders with FL's command line; `stems.ts` names the stems and packs them with WinRAR (or into a ZIP); `run.ts` runs a beat's real steps; `browser.ts` the app's own Chrome profile and the BeatStars session; `beatstarsUpload.ts` fills in a new BeatStars track, one step function at a time; `registry.ts` reads and writes the registry with reg.exe; `settings.ts` keeps the settings file; `flStudio.ts` finds FL Studio; `windows.ts` creates every window with the same lockdown; `notes.ts` the Notes window) · `src/preload/` the bridge, exposes `window.api` · `src/shared/` code and types both sides use (`Api`, the contract for `window.api`; `parseBeatName`, which also reads a key on its own (`parseKey`); `beatstars`, the BeatStars title and Key-list value; `schedule`, the daily YouTube slots; `settings`, the settings type, defaults and `cleanSettings`) · `src/renderer/` the React app.
- Renderer: two pages, `index.html` (main window, `src/main.tsx`) and `notes.html` (Notes window, `src/notes/`), both listed in `electron.vite.config.ts` · `lib/` state and logic (the settings provider, toasts, the beat model, the pipeline, demo data, small hooks) · `components/` shared UI (Card, TitleBar, Rail, Mascot, Celebration, controls) · `screens/` one folder or file per screen · `styles/tokens.css` the design tokens and every animation. Components use CSS Modules (`*.module.css`); animations whose speed depends on the BPM are set as inline styles.
- IPC routes so far: `project:read` (invoke) reads an .flp; `settings:load` / `settings:save` (invoke) read and change the settings; `fl:find` / `fl:pick` (invoke) find FL Studio or let the user point to it in Windows' file dialog; `output:pick` (invoke) opens Windows' folder dialog and answers with the folder, which the page saves; `run:start` / `run:step` (invoke) start a beat's run and do one real step of it, `run:stop` (send) stops it (closing its BeatStars window; the draft stays), `run:show` (invoke) brings up the run's BeatStars window for the review's "Open in browser"; `beatstars:session` / `beatstars:login` / `beatstars:logout` (invoke) check, log in to and log out of BeatStars in the app's Chrome profile; `shell:show` (send) opens Explorer at a file; `notes:open` (send) opens or focuses Notes; `window:theme` (send) recolors the sending window's caption buttons. Pushed from main to the pages: `settings:changed` (the fields another window just saved) and `notes:changed` (Notes opened or closed); the preload's `listen` passes only the data, never the IPC event. Dropped and picked files get their full path through `webUtils.getPathForFile` in the preload.
- Settings live in `%APPDATA%\Type Beat Beast\settings.json` (the Notes text too), owned by the main process; every value goes through `cleanSettings`. Not localStorage: that belongs to the page's address, so the dev server (port 5173, or 5174 when 5173 is busy) and the built app each had their own copy. The first launch with the file hands over the old localStorage copy once.
- When Claude starts a test copy of the app, it passes a throwaway data folder (`npx electron-vite dev -- --user-data-dir=<scratch folder>`), so it never reads or changes the user's settings.
- In the pipeline (`src/renderer/src/lib/pipeline.ts`), steps marked `real` (both renders, the stems, BeatStars, tidy) are done by the main process; YouTube is still simulated with made-up timings, and the Schedule and History screens show made-up days and runs (`DEMO` marks the places that say so). Phase 4 replaces them with real work. The BeatStars step runs twice in the main process: `bs` fills in the track and the step waits ("needs", the review card), then the user's OK marks it `approved` and `publish` publishes it. Retry carries on with the same draft. Run checks what BeatStars needs (name, BPM, a key with major/minor, a title that fits, a JPG/PNG/WebP cover) before rendering.
- Built with electron-vite 5 (`electron.vite.config.ts`); TypeScript configs: `tsconfig.node.json` (main, preload, shared) and `tsconfig.web.json` (renderer, shared).
- Package versions are pinned exactly, picked at least two weeks after release. electron-vite 5 supports Vite up to 7, so Vite and `@vitejs/plugin-react` stay on 7.x and 5.x.
- Windows stay locked down: `contextIsolation`, `sandbox`, no `nodeIntegration`, a Content-Security-Policy in `index.html`, external links only open in the browser if they're https. The preload must stay CommonJS (no `"type": "module"` in package.json), because sandboxed preloads can't load ES modules.
- This connection sometimes cuts big GitHub downloads short. If Electron's download fails during `npm install`, rerun `node node_modules/electron/install.js`.
- When Claude starts the app, its shell inherits `ELECTRON_RUN_AS_NODE=1` from VS Code, which makes Electron act like plain Node (`app` is undefined). Run it as `env -u ELECTRON_RUN_AS_NODE npm run dev`; adding `ELECTRON_ENABLE_LOGGING=1` prints the page's console to the terminal. The user's own terminal doesn't have this problem.

## FL Studio command line (tested 2026-10-13)

- FL's installer records where FL64.exe is: `HKLM\SOFTWARE\Image-Line\Shared\Paths` → `FL Studio`. The app reads it with `reg.exe` and reads the version (21.0.3.3517 here) from the exe's own VS_VERSION_INFO bytes; both take milliseconds. The path is saved in Settings once found.

- `FL64.exe /R /Emp3,wav "<project>.flp"` renders without touching the FL window, then FL closes itself: about 35–50 s for a 2:17 beat, FL start-up included. Paths with spaces work when quoted. The `.flp` is left byte-for-byte unchanged.
- Output goes next to the `.flp`, named after it: `<project>.mp3`, `<project>.wav`.
- Quality comes from the Export window's saved settings in the registry, `HKCU\SOFTWARE\Image-Line\FL Studio 21\General\WAVRenderForm` (string values): `WFBox` 0 = 16-bit, 1 = 24-bit, 2 = 32-bit float; `MP3BitrateSlider` 10 = 192 kbps, 12 = 256 kbps, 13 = 320 kbps (all confirmed by renders, 2026-10-19); `BatchBox` 1 = "Split mixer tracks". The user's own values are 16-bit, 192 kbps, split off.
- The render runner is `src/main/render.ts`. It refuses to start while FL is open. It backs up the user's three values to `%APPDATA%\Type Beat Beast\fl-export-backup.json`, sets the render's, runs `FL64.exe /R /Ewav` (or `/Emp3`) on a copy in its own work folder, waits for FL to close (10-minute limit), and always restores the values; app start-up restores them too if a render was cut short. Success means FL closed and the expected file exists (FL's exit code isn't used).
- Real renders of a flowers copy (2026-10-19): the untagged split render took 42 s and gave a 24-bit 44.1 kHz WAV plus 10 stems (the muted tag isn't one); the tagged MP3 took 38 s at 320 kbps. Rerun with `TBB_REAL_RENDER=1 TBB_REAL_FLP="<copy of a beat>.flp" npx vitest run src/main/render.test.ts` (it launches FL, so ask the user first).
- The export settings have no sample rate: FL renders at the audio device's rate, `HKCU\SOFTWARE\Image-Line\FL Studio 21\Devices\Audio output` → `Sample rate` (44100 here). That's why Settings has no sample-rate option.
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

## BeatStars (looked at 2026-10-20)

- Uploads happen in the Studio, `https://studio.beatstars.com`. Logged out, it sends visitors to `https://www.beatstars.com/studio/sell-beats` (a sign-up page) within a few seconds.
- Login page: `https://oauth.beatstars.com/verify?app=WEB_STUDIO&origin=https://studio.beatstars.com&send_callback=true`, with email or username, or Continue with X, Apple or Discord; Google's own "Continue as <name>" button shows too when the browser is signed in to Google. A OneTrust cookie banner shows first.
- Where the login lives (checked 2026-10-20): the sign-in site and the Studio each keep it in their own local storage (`access_token`, `refresh_token`, `access_token_expiration`; the access token lasts 30 days, and the Studio renews it), and `.beatstars.com` cookies of the same names hold it too. The Studio only gets its copy when the user reaches the Studio after signing in. After the user's Google sign-in in the recorder ("Continue as Kareem", then their account in Google's popup; no password typed), BeatStars went to the Studio by itself. With a saved sign-in, the verify page waits on "Continue to app" instead (seen in a hidden check). The user's first logins never got that far, so the sign-in site had a login and the Studio didn't, and the Studio sent the app to the sign-up page. Once the Studio has it, a later hidden launch (with a normal Chrome user agent) goes straight to the dashboard.
- The app's check reads the Studio's storage from a static file there (`robots.txt`, plain text, so no BeatStars code runs): logged in = a refresh token, or an access token not yet expired (`isLoggedIn`, tested). Learned the hard way twice: opening the Studio said "logged out" when only that handover was missing, and reading the sign-in site's storage said "Logged in" when the Studio had nothing.
- Looks at the user's Studio stay passive: open pages and read them. Never block or alter the Studio's requests. On 2026-10-23 a look that aborted every non-GET request, to make clicking "Add collaborator" safe, left the tracks page blank, and the Studio ran its own sign-out: tokens and login cookies were gone from the app's profile, and the user had to log in again. Nothing on the account changed. The Studio loads its data and renews its login with POST requests.
- The app's own Chrome profile is `%APPDATA%\Type Beat Beast\chrome-profile`. The user logs in there in a normal Chrome window the app opens with no automation attached (social logins often refuse windows a script controls); Playwright (`playwright-core` 1.63.0, driving the installed Chrome) only does the hidden check now and the uploads later. Chrome locks a profile while it's open, so `browser.ts` lets one thing use it at a time. Log out deletes that profile; the user's own Chrome is never touched.
- The upload as the user does it, recorded 2026-10-20 with `npm run record:beatstars` (roadster; `recordings\beatstars-upload-2026-10-20-1852.js`): `studio.beatstars.com/dashboard` → "Create Track" → a button with only an icon → "browse files" → the untagged WAV, which creates the track's draft at `/content/tracks/new/<id>` (ids look like `TK26458319`) · Title · BPM (a number box) · Key (a `<select>`, values like `D_SHARP_MINOR`) · artwork: "Edit" → "Upload file" → "browse files" → the image → "Save" → "Upload 1 file" · the "Enable free download" tick box (ticked) and the "Allow commercial use" switch (it starts on; turned off, for non-commercial use only). Each sits in a card (`.selectable-card`) whose text names it; their Angular Material ids are generated and change, so the script finds them by that text · the tagged MP3: "Add" in the tagged section (`studio-track-form-tagged`) → "browse files" · the stems: "Add" → "browse files" → the RAR · "Publish track" → a dialog with the track's link and a copy button. Every file goes in through "browse files" (an `input[name="files[]"]`). Genre, moods, tags, description, licenses and collaborators weren't touched (roadster has no collaborators).
- BeatStars glitches the user works around by hand (2026-10-20): the artwork upload sometimes fails (in the recording they retried, then picked an older image from the library), and sometimes an uploaded file (MP3, WAV or stems) doesn't attach to the track; then they reload the page and pick the already-uploaded file from the list under the upload dialog. The upload script must check that the artwork and each file attached.
- The track form, read on roadster's page (`/content/tracks/edit/<id>`, 2026-10-20): Title is `input#title`, at most 60 characters (a "46/60" counter) · BPM is the only `input[type=number]` in `studio-track-form-metadata-wrapper` (no label, placeholder "0") · the Key `<select>` has every major and minor as values like `D_SHARP_MINOR` (shown as `D♯m`), plus `NONE`; missing are C♭ minor and G♭ minor (use Bm and F♯m) and anything with B♯, E♯ or F♭ · BeatStars filled in tags, genres, moods, instruments and a description by itself, the four licenses are on with the user's prices, and "Include bulk discount" is ticked · the files panel shows "Master Track (Untagged)", "Preview Track (Tagged)" and "Stem Files" with each attached file's name (`studio-track-form-untagged`, `-tagged`, `-stems`), where the script can check attachments · Track Type (Beat), Visibility (Public) and Release Date (now) stay as they are · the collaborators section shows kriko (Main Collab, 100% profit and publishing share) with "Add collaborator" under it.
- The fill-in's first real run (`src/main/beatstarsUpload.ts`, 2026-10-22, the structure beat; the user ran it, see Phase 3): the draft's address appears as soon as the WAV starts uploading, and the WAV keeps uploading while the rest is filled in · each file slot goes "Uploading…" → "Attaching…" → the file's name (BeatStars shortens it, `structure-140-c...`) with a play button; the 68 MB stems took about 75 s to upload, and attaching takes a while more · a new track's artwork is the user's profile picture until the cover arrives · the Trackout, Unlimited and Premium licenses stay greyed out ("Upload both stems and wav files to enable this license") until the WAV and stems are attached, then all four switch on by themselves · BeatStars saves the draft as it goes ("Changes Saved!"): after the window closed, the draft still had everything · tags, genres, moods and the description came pre-filled with the same values as roadster's · the icon-only click after "Create Track" in the recording didn't come up; it was probably a first-time tips dialog (the Studio stores `track-form-first-time-use-dialog-seen`), so it may come back after Log out, which deletes the profile.
- The upload's Chrome window (`openUploadBrowser` in `browser.ts`) is always a normal, headed window, so BeatStars sees an ordinary browser. With Show Chrome off it's placed left of every screen; tested 2026-10-22 on a blank page, Chrome keeps it at x = -2000, the page still counts as visible (so Chrome doesn't slow it down like a background tab), and the CDP call behind "Open in browser" brings it up maximized. The window holds the profile until the run publishes or stops, so the Settings login check waits for it meanwhile.

## Naming system

The `.flp` file name carries the beat info, in one of two patterns:

- `beat name - bpm key`, e.g. `8 bit - 151 D#m`
- `main prod x collab prod - beat name - bpm key`, e.g. `kriko x welcomeCarson - ozempic - 132 Fmin`

- The main producer is the user (kriko) and always comes first. Every name after it, separated by `x`, is a collaborator; there can be several (`kriko x A x B - beat name - bpm key`).
- Minor keys: lowercase `m` or `min` (`D#m`, `Fmin`, `Em`). Major keys: capital `M` or `maj` (`CM`, `Cmaj`, `CMAJ`, `Bmaj`). Check the three-letter forms first, in any case, so `CMIN` isn't read as major.
- Read BPM and key from the end of the name. Real files sometimes skip the dash before the BPM (`kriko x welcomeCarson - mushroom 134 Gmin`), and 5 of the 99 put the key first (`my city - Fmin 137`). `src/shared/parseBeatName.ts` handles both and reads all 99 of the user's 2026 names.
- If a name still doesn't fit, the app asks instead of guessing.
- On BeatStars, each collaborator is added in the collabs section: type their name and pick the first result in the dropdown. BeatStars does the rest by itself (user, 2026-10-23): the shares split evenly (50/50 with one collab, 33/33/34 with two) and the role is Producer. The BeatStars account names are usually the same as in the file name, and the user always checks the collabs before publishing.
- Collaborator spellings vary between files: `wecomeCarson` (typo of `welcomeCarson`), `prodcozee` / `whereiscozee`, `prodbysky` / `sky`. Searching BeatStars with these as written can pick the wrong account, so Phase 3 needs a remembered list mapping file-name spellings to BeatStars usernames.

The app has a small notes window showing these rules, which the user can edit.

## Options

Defaults live in Settings; each beat can override them before it runs.

- Upload stems: yes or no
- BeatStars tagged file: upload the tagged MP3, or reuse the WAV and let BeatStars add its default tag (the app leaves the tagged slot empty then, which is what the user means, 2026-10-23; untried)
- Show Chrome (Settings → BeatStars, on by default, user 2026-10-22): watch the Chrome window fill in BeatStars, or keep it out of sight until the review's "Open in browser"
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

Each published beat gets a folder named after the beat (as shown in the beat details), next to its `.flp`; Settings → Paths → Output folder can send beat folders somewhere else (`outputFolder`, empty means next to the `.flp`). The user's spec (2026-10-19), with `<project>` the `.flp`'s name without `.flp`:

```
<folder of the .flp>\<beat name>\
  <project>.flp           moved in at the very end
  <project>.wav           untagged
  <project> TAGGED.mp3    tagged; the one MP3 for both BeatStars and the YouTube video
  <beat name>.rar         the stems: <project> - Track 1.wav, - Track 2.wav… in mixer order (the user's naming);
                          <beat name>.zip instead when WinRAR isn't installed
```

`src/main/beatFolder.ts` works out these paths (beat names are made safe for Windows). A status file in the folder will let a failed step be retried without redoing the ones before it.

Only when everything has published successfully does the app move the original `.flp` and the cover image into the folder (user, 2026-10-19). The YouTube video is a temporary file: it's deleted once its upload has succeeded.

## The flow for one beat

1. Pick the `.flp` and the cover image. The app reads beat name, BPM, key and collaborators from the file name (see Naming system) and picks the tag track (see Tag detection); the user can edit the details before continuing. The project can be saved with the tag on or off; it doesn't matter.
2. **Auto:** render a temporary copy with the tag track muted, with "Split mixer tracks" on: the Master file is the untagged WAV, the rest are the stems. With stems turned off, a normal WAV render.
3. **Auto:** render a temporary copy with the tag track on: the tagged MP3. Then delete both copies.
4. **Auto:** pack the stems into a RAR, leaving out Master and Current.
5. **Auto:** fill in the whole BeatStars upload in Chrome, including collaborators. **Manual:** the user reviews and confirms, then it publishes.
6. **Auto:** make the YouTube video (cover + tagged audio, with an MP3 audio track), upload it with the title, description and tags, and schedule it for the next free day at the daily publish time.
7. **Auto, only if everything published:** move the original `.flp` and the cover image into the beat folder.

## Phase 0 — Tests (done 2026-10-13)

Everything risky works on this PC: FL Studio renders from the command line (stems included), the app can mute the tag in a project copy, and YouTube uploads and scheduling work without Google's audit. Details are in the sections above.

## Phase 1 — App skeleton and screens (done 2026-10-19)

Every screen from the design works: New beat (drop the .flp and cover, beat details, options, the game-level pipeline, the BeatStars review), Schedule (two weeks of daily slots from yesterday), History (the loaded beat live on top, then past runs), Settings (paths with FL Studio found on its own, quality, defaults, publish time, tags, appearance) and Notes in a window of its own. The pipeline, the schedule and past runs are still demo data. The BeatStars login card came with Phase 3; YouTube's comes with Phase 4.

## Phase 2 — Audio files (done 2026-10-20)

Pressing Run renders for real. `src/main/run.ts` keeps each run (the beat folder, a temp work folder in `%TEMP%\tbb-run-*`, the stems waiting to be packed), and the page asks for one real step at a time over IPC: WAV + stems (one split render of a copy with the tag muted), tagged MP3 (a copy with the tag on), the stems packed with WinRAR or into a ZIP, and tidying up. Each step answers with lines for the step log or the error; Retry repeats just the failed step, and Stop closes FL (an `AbortSignal`) and clears the run's temp files. The beat folder is made by the first render; a folder by that name holding a different beat is left alone and this one goes into `<name> (2)`. End-to-end test on a flowers copy (2026-10-20): WAV 54 s, MP3 43 s, stems packed in 10 s, the folder exactly as in "Beat folder", the user's FL values back after the run and after a Stop mid-render, no temp files left.

## Phase 3 — BeatStars

- [x] Separate Chrome profile for the app; the user logs in to BeatStars there once (done 2026-10-20: Settings → BeatStars → Log in; the check reads the Studio's storage, and a hidden launch reaches the dashboard)
- [x] Record one upload done by hand with Playwright's recorder, then turn it into the upload script (done 2026-10-22: the title and key rules in `src/shared/beatstars.ts`, the fill-in in `src/main/beatstarsUpload.ts`. Its test filled in a complete draft of the structure beat, rendered into `C:\Users\karee\OneDrive\Desktop\structure\` with the cover `rich amiri_.jpg`. Claude's own run was blocked by the permission check as an unrequested upload, so the user ran the test script themselves)
- [ ] Upload the files (following the stems and tagged-file options); fill in title, BPM, key and artwork; turn on the free tagged MP3 download (non-commercial) (the fill-in does it all, tested with stems and the tagged MP3 on; the "Reuse WAV" and stems-off paths are untried. Run does it since 2026-10-22; the user's first run from the app worked, 2026-10-23)
- [ ] Collaborators: for each one, type the name in the collabs section and pick the first dropdown result; flag it in the review if the picked account's name doesn't match
- [ ] Collaborator name list: remember which BeatStars username each file-name spelling means (see Naming system)
- [ ] Stop for the user's confirmation, then publish; save the beat's BeatStars link (built 2026-10-22, untried: the review card waits, "Publish on BeatStars" clicks "Publish track" and reads the link from BeatStars' confirmation into the step log. The link is for the YouTube description: Phase 4's YouTube step takes it from the run, and no file in the beat folder keeps it (user, 2026-10-23))

## Phase 4 — YouTube

- [ ] Switch the Google app from "Testing" to "In production" (Google Auth Platform → Audience) so sign-ins don't expire every 7 days
- [ ] Sign-in inside the app; keep the token safely on this PC
- [ ] Video: cover + tagged audio → MP4 with an MP3 audio track (recipe above)
- [ ] Title and description from the user's templates, with BPM and key filled in
- [ ] Upload through the YouTube API, scheduled for the next free daily slot
- [ ] Queue view showing what's scheduled when
- [ ] Once everything has published: move the `.flp` and the cover into the beat folder (check the moved `.flp` still finds its samples), and delete the video

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
- **Stems archive:** RAR with WinRAR. When WinRAR isn't installed, a ZIP made with PowerShell's built-in `Compress-Archive` (user, 2026-10-20); file paths reach PowerShell through environment variables, never in the command. Not Windows' `tar.exe`: it crashes (0xC0000005) on names like "café". ZIP is also the way out if BeatStars ever rejects RAR.
- **Logins:** the app never stores or types passwords. BeatStars: the user logs in once in the app's own Chrome profile. YouTube: a one-time Google permission screen.
- **BeatStars plan:** Pro, so stem uploads are available.
- **One tagged MP3:** the same `<project> TAGGED.mp3` goes to BeatStars and into the YouTube video (user, 2026-10-19). Their older beats had separate BEATSTARS and YOUTUBE MP3s.
- **BeatStars title:** `<Beat Name> [BUY 2, GET 1] - Rich Amiri Type Beat`, every word of the beat name starting with a capital (roadster → `Roadster [BUY 2, GET 1] - Rich Amiri Type Beat`). Over BeatStars' 60 characters: `<Beat Name> [BUY 2 GET 1] Amiri Type Beat` (user, 2026-10-20). Genre, moods, tags, description and licenses: the user sets none by hand, so the app doesn't either.

## Open questions (answer when that phase starts)

- [ ] Phase 4: YouTube title format (BeatStars' is in Decisions)
- [ ] Phase 4: YouTube description template, tags, category, playlist; daily publish time and timezone
- [ ] Phase 4: where the artist name in "X Type Beat" comes from
- [ ] Phase 4: notify subscribers when a scheduled video goes live? (YouTube's default: yes)
