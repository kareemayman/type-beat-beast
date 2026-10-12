# Type Beat Beast

Desktop app (Electron + TypeScript) for a type beat producer. It takes a finished FL Studio project and a cover image, renders the audio files, uploads the beat to BeatStars, and schedules a YouTube video, with as few clicks as possible.

## How we work

- Build one plan item at a time, together with the user. When an item is done and tested, tick it below and record any new decision under "Decisions".
- Ask before launching FL Studio, opening the user's BeatStars or YouTube account, or uploading/publishing anything.
- Never modify the user's original `.flp` files, in tests or in app code; work on copies.
- Never store or type the user's passwords.
- Manual steps are acceptable (muting tags, exporting stems by hand). The goal is fewer steps, not zero.
- This file loads into every session: when a phase is finished, shrink its section to a short summary.

## This machine

- FL Studio 21.0.3: `F:\Program Files\Fl Studio 21\FL64.exe` (not the default C: location)
- FL's export-window settings: registry `HKCU\SOFTWARE\Image-Line\FL Studio 21\General\WAVRenderForm`
- WinRAR 7.00: `C:\Program Files\WinRAR\Rar.exe`
- Installed: Node 22, Python 3.12, git, Chrome. FFmpeg is not installed system-wide.

## The flow for one beat

1. Pick the `.flp` and the cover image. The app reads title, key and BPM from the file name; the user can edit them before continuing.
2. **Auto:** render the tagged MP3.
3. **Manual:** the app opens the project in FL Studio; the user mutes the tags, saves, closes FL and presses Continue.
4. **Auto:** render the untagged WAV.
5. **Auto or manual:** stems. Automatic if the Phase 0 test works; otherwise the user exports them with "Split mixer tracks" while FL is open in step 3.
6. **Auto:** pack the stems into a RAR.
7. **Auto:** fill in the whole BeatStars upload in Chrome. **Manual:** the user reviews and confirms, then it publishes.
8. **Auto:** make the YouTube video (cover + tagged audio, with an MP3 audio track), upload it with the title, description and tags, and schedule it for the next free day at the daily publish time.

Every beat gets its own output folder with a status file, so a failed step can be retried without redoing the steps before it.

## Phase 0 — Test what works on this PC

- [ ] **FL Studio command-line render:** render one project to MP3 and WAV without touching the FL window. Check paths with spaces, which quality settings it uses, and how long it takes.
- [ ] **Stems from the command line:** test whether the command line uses the export settings saved in the registry, and whether "Split mixer tracks" can be switched on there. If not, stems stay a manual step.
- [ ] **YouTube API:** create a Google Cloud project, upload a private test video scheduled for the next day, and check whether YouTube locks it as private. If it does, apply for Google's audit the same day. Make the test video the same way as the real ones (still image + MP3 audio), so this also confirms YouTube handles the MP3 audio.

## Phase 1 — App skeleton and beat info

- [ ] Electron + TypeScript project, tracked in git
- [ ] Window: pick `.flp` + cover image; shows title, key, BPM (editable)
- [ ] File-name parser for the user's naming pattern
- [ ] Settings: FL Studio path, output folder, daily publish time

## Phase 2 — Audio files

- [ ] Tagged MP3 render
- [ ] Manual "mute the tags" stop
- [ ] Untagged WAV render
- [ ] Stems (automatic or a manual stop, depending on Phase 0)
- [ ] Pack the stems with WinRAR

## Phase 3 — BeatStars

- [ ] Separate Chrome profile for the app; the user logs in to BeatStars there once
- [ ] Record one upload done by hand with Playwright's recorder, then turn it into the upload script
- [ ] Upload the files; fill in title, BPM, key and artwork; turn on the free tagged MP3 download (non-commercial)
- [ ] Stop for the user's confirmation, then publish; save the beat's BeatStars link

## Phase 4 — YouTube

- [ ] Video: cover + tagged audio → MP4 with an MP3 audio track (FFmpeg)
- [ ] Title and description from the user's templates, with BPM and key filled in
- [ ] Upload through the YouTube API, scheduled for the next free daily slot
- [ ] Queue view showing what's scheduled when

## Phase 5 — Polish

- [ ] One "Run" button that goes through every step, stopping only for the manual ones
- [ ] Queue several beats at once
- [ ] Retry failed steps, readable logs
- [ ] Optional: mute the tags automatically by editing a copy of the `.flp`

## Decisions

- **Stack:** Electron + TypeScript, a real desktop program (VS Code is built with Electron). HTML/CSS draws the window; everything else runs locally with full access to files, FL Studio, WinRAR and Chrome. FFmpeg comes in as an npm package, so nothing extra gets installed.
- **Video audio:** MP3, not AAC. If the source is already an MP3, its audio goes into the video unchanged (no re-encode); anything that needs encoding uses libmp3lame at 320 kbps.
- **Tags:** muted by hand in FL (flow step 3).
- **Stems archive:** RAR with WinRAR. Fall back to ZIP if BeatStars rejects RAR.
- **Logins:** the app never stores or types passwords. BeatStars: the user logs in once in the app's own Chrome profile. YouTube: a one-time Google permission screen.
- **BeatStars plan:** Pro, so stem uploads are available.

## Open questions (answer when that phase starts)

- [ ] Phase 1: file naming pattern, plus the BeatStars and YouTube title formats
- [ ] Phase 3: BeatStars defaults (genre, moods, tags, licenses, free download settings)
- [ ] Phase 4: YouTube description template, tags, category, playlist; daily publish time and timezone
- [ ] Phase 4: is the YouTube audio the same tagged MP3 as BeatStars, or a different tag?
- [ ] Phase 4: where the artist name in "X Type Beat" comes from
