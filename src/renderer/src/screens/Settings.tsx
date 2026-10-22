import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, CircleAlert, CircleCheck, FolderOpen, Hand, LoaderCircle, LogIn, LogOut, MicVocal, TriangleAlert, Undo2, X, type LucideIcon } from 'lucide-react'
import type { BeatStarsSession, FlStudioStatus } from '../../../shared/api'
import Card from '../components/Card'
import ConfirmButton from '../components/ConfirmButton'
import { Segmented, Switch } from '../components/controls'
import { useMediaQuery } from '../lib/environment'
import { useSettings } from '../lib/settings'
import { useToast } from '../lib/toasts'
import styles from './Settings.module.css'

// Every quarter hour of the day, "00:00" to "23:45".
const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`)

// One setting: what it is on the left, its control on the right.
function Row({ title, sub, className = '', children }: { title: string; sub?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`${styles.row} ${className}`}>
      <div className={styles.rowText}>
        <div className={styles.rowTitle}>{title}</div>
        {sub && <div className={styles.rowSub}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

// The BeatStars card's states: a session answer from the main process, or something in progress.
type BeatStarsCard = BeatStarsSession | 'checking' | 'loggingIn' | 'loggingOut'

function beatStarsLook(bs: BeatStarsCard): { tone: string; icon: LucideIcon; title: string; sub: string } {
  if (bs === 'checking') return { tone: 'muted', icon: LoaderCircle, title: 'Checking…', sub: "Looking at the app's own Chrome profile." }
  if (bs === 'loggingIn') return { tone: 'sky', icon: Hand, title: 'Your turn', sub: 'Log in in the Chrome window. Close it once your dashboard shows.' }
  if (bs === 'loggingOut') return { tone: 'muted', icon: LoaderCircle, title: 'Logging out…', sub: "Clearing the app's Chrome profile." }
  if (!bs.ok) return { tone: 'rose', icon: CircleAlert, title: "Couldn't check", sub: bs.error }
  return bs.loggedIn
    ? { tone: 'green', icon: CircleCheck, title: 'Logged in', sub: 'Uploads reuse this session.' }
    : { tone: 'yellow', icon: TriangleAlert, title: 'Not logged in', sub: 'Log in once so uploads can run.' }
}

// Built card by card from the design. Every change saves right away (see lib/settings.tsx).
export default function Settings() {
  const { settings, update } = useSettings()
  const toast = useToast()
  const [fl, setFl] = useState<FlStudioStatus | null>(null) // null while it's looking
  const [bs, setBs] = useState<BeatStarsCard>('checking')
  const [tagDraft, setTagDraft] = useState('')

  // FL Studio is looked up each time Settings opens, so a moved or reinstalled FL shows up here.
  useEffect(() => {
    let current = true
    void window.api.findFlStudio().then((status) => {
      if (current) setFl(status)
    })
    return () => {
      current = false
    }
  }, [])

  // The BeatStars session is checked each time Settings opens, like FL Studio.
  useEffect(() => {
    let current = true
    void window.api.beatStarsSession().then((session) => {
      if (current) setBs(session)
    })
    return () => {
      current = false
    }
  }, [])

  async function logInToBeatStars() {
    setBs('loggingIn')
    const session = await window.api.logInToBeatStars()
    setBs(session)
    if (!session.ok) toast('failed', session.error)
    else if (session.loggedIn) toast('done', 'BeatStars session saved.')
    else toast('info', 'Not in yet. Log in, then wait for your BeatStars dashboard (click "Continue to app" if it shows) before closing the window.')
  }

  async function logOutOfBeatStars() {
    setBs('loggingOut')
    const session = await window.api.logOutOfBeatStars()
    setBs(session)
    if (!session.ok) toast('failed', session.error)
  }

  const bsLook = beatStarsLook(bs)

  async function browseFl() {
    const status = await window.api.pickFlStudio()
    if (!status) return // the dialog was closed
    if (status.ok) setFl(status)
    else toast('failed', status.error)
  }

  async function browseOutput() {
    const folder = await window.api.pickOutputFolder()
    if (folder) update({ outputFolder: folder })
  }
  // Windows' own animation switch wins over "Full" (see useReducedMotion).
  const windowsReducesMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  function addTag() {
    const name = tagDraft.trim()
    if (name && !settings.tagNames.some((tag) => tag.toLowerCase() === name.toLowerCase())) update({ tagNames: [...settings.tagNames, name] })
    setTagDraft('')
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Settings</h1>
        <div className={styles.sub}>Changes save as you go.</div>
      </header>

      <div className={styles.columns}>
        <div className={styles.column}>
          <Card sticker="Paths" stickerColor="var(--orange)" className={`${styles.card} ${styles.paths}`}>
            <div className={styles.path}>
              <span className={styles.rowTitle}>FL Studio</span>
              <div className={styles.pathLine}>
                <span className={styles.pathBox} title={fl?.ok ? fl.path : undefined}>
                  {fl?.ok ? fl.path : fl ? 'Not found' : 'Looking…'}
                </span>
                <button className={styles.browse} onClick={browseFl}>
                  <FolderOpen size={16} strokeWidth={2.5} />
                  Browse
                </button>
              </div>
              <span className={styles.status} data-state={!fl ? 'looking' : fl.ok ? 'ok' : 'error'}>
                {!fl ? (
                  'Looking for FL Studio…'
                ) : fl.ok ? (
                  <>
                    <CircleCheck size={16} strokeWidth={2.75} />
                    Found it · FL Studio {fl.version}
                  </>
                ) : (
                  <>
                    <CircleAlert size={16} strokeWidth={2.75} />
                    {fl.error}
                  </>
                )}
              </span>
            </div>

            <div className={styles.path}>
              <span className={styles.rowTitle}>
                Output folder <span className={styles.pathHint}>· one folder per beat</span>
              </span>
              <div className={styles.pathLine}>
                <span className={styles.pathBox} title={settings.outputFolder || undefined}>
                  {settings.outputFolder ? (
                    <>
                      {settings.outputFolder}
                      <span className={styles.pathHint}>\{'{beat name}'}</span>
                    </>
                  ) : (
                    'Next to each .flp'
                  )}
                </span>
                <button className={styles.browse} onClick={browseOutput}>
                  <FolderOpen size={16} strokeWidth={2.5} />
                  Browse
                </button>
              </div>
              {settings.outputFolder ? (
                <button className={styles.reset} onClick={() => update({ outputFolder: '' })}>
                  <Undo2 size={14} strokeWidth={2.75} />
                  Back to next to each .flp
                </button>
              ) : (
                <span className={styles.status}>Each beat gets a folder beside its .flp.</span>
              )}
            </div>
          </Card>

          <Card sticker="Quality" stickerColor="var(--violet)" className={styles.card}>
            <Row title="WAV + stems" sub="Untagged renders">
              <Segmented
                label="WAV bit depth"
                value={settings.wavBits}
                options={[
                  ['16', '16-bit'],
                  ['24', '24-bit'],
                  ['32f', '32 float'],
                ]}
                onChange={(wavBits) => update({ wavBits })}
              />
            </Row>
            <Row title="Tagged MP3">
              <Segmented
                label="MP3 bitrate"
                value={settings.mp3Rate}
                options={[
                  ['192', '192'],
                  ['256', '256'],
                  ['320', '320 kbps'],
                ]}
                onChange={(mp3Rate) => update({ mp3Rate })}
              />
            </Row>
          </Card>

          {/* What every new beat starts with; the Options card on New beat can still change them for one beat. */}
          <Card sticker="Defaults" stickerColor="var(--green)" className={styles.card}>
            <Row title="Upload stems" sub="Packs a RAR and attaches it">
              <Switch label="Upload stems" checked={settings.stems} onChange={(stems) => update({ stems })} />
            </Row>
            <Row title="BeatStars file" sub="Reuse WAV lets BeatStars add its own tag">
              <Segmented
                label="BeatStars file"
                value={settings.bsFile}
                options={[
                  ['mp3', 'Tagged MP3'],
                  ['wav', 'Reuse WAV'],
                ]}
                onChange={(bsFile) => update({ bsFile })}
              />
            </Row>
            <Row title="Free download" sub="Tagged MP3 on BeatStars">
              <Switch label="Free download" checked={settings.freeDownload} onChange={(freeDownload) => update({ freeDownload })} />
            </Row>
          </Card>
        </div>

        <div className={styles.column}>
          <Card sticker="YouTube" stickerColor="var(--rose)" className={styles.card}>
            <Row title="Daily publish time" sub="One video a day, at this time on this PC's clock." className={styles.timeRow}>
              <label className={styles.time}>
                <span className={styles.timeCaption}>Daily at</span>
                <select
                  className={styles.timeSelect}
                  value={settings.publishTime}
                  aria-label="Daily publish time"
                  onChange={(e) => update({ publishTime: e.target.value })}
                >
                  {TIMES.map((time) => (
                    <option key={time}>{time}</option>
                  ))}
                </select>
                <ChevronDown className={styles.chevron} size={18} strokeWidth={3} />
              </label>
            </Row>
          </Card>

          {/* Logging in happens in a normal Chrome window in the app's own profile (see src/main/browser.ts). */}
          <Card sticker="BeatStars" stickerColor="var(--sky)" className={styles.card}>
            <div className={`${styles.row} ${styles.bsRow}`}>
              <span className={styles.pill} data-tone={bsLook.tone}>
                <bsLook.icon size={15} strokeWidth={2.75} />
                {bsLook.title}
              </span>
              <span className={styles.bsSub}>{bsLook.sub}</span>
              {typeof bs === 'object' && bs.ok && bs.loggedIn ? (
                <ConfirmButton className={styles.action} onConfirm={logOutOfBeatStars} confirmLabel="Click again to log out">
                  <LogOut size={16} strokeWidth={2.5} />
                  Log out
                </ConfirmButton>
              ) : (
                <button className={styles.action} data-primary="true" disabled={typeof bs === 'string'} onClick={logInToBeatStars}>
                  <LogIn size={16} strokeWidth={2.5} />
                  Log in
                </button>
              )}
            </div>
          </Card>

          {/* The names Tag detection trusts first (see CLAUDE.md). Running a beat adds its tag track's name. */}
          <Card sticker="Tags" stickerColor="var(--yellow)" className={`${styles.card} ${styles.tags}`}>
            <p className={styles.note}>A mixer track with one of these names gets picked as the voice tag. Otherwise the app guesses.</p>
            <div className={styles.chips}>
              {settings.tagNames.length ? (
                settings.tagNames.map((name) => (
                  <span key={name} className={styles.chip}>
                    <MicVocal size={14} strokeWidth={2.75} />
                    <span className={styles.chipName}>{name}</span>
                    <button aria-label={`Forget ${name}`} title={`Forget ${name}`} onClick={() => update({ tagNames: settings.tagNames.filter((tag) => tag !== name) })}>
                      <X size={14} strokeWidth={3} />
                    </button>
                  </span>
                ))
              ) : (
                <span className={styles.none}>None yet. Running a beat adds its tag track's name here.</span>
              )}
            </div>
            <input
              className={styles.addTag}
              value={tagDraft}
              placeholder="Add a track name, press Enter"
              aria-label="Add tag track name"
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
            />
          </Card>

          <Card sticker="Appearance" stickerColor="#F4F7FB" className={styles.card}>
            <Row title="Theme" sub="System follows Windows">
              <Segmented
                label="Theme"
                value={settings.themePref}
                options={[
                  ['dark', 'Dark'],
                  ['light', 'Light'],
                  ['system', 'System'],
                ]}
                onChange={(themePref) => update({ themePref })}
              />
            </Row>
            <Row title="Motion" sub={windowsReducesMotion ? 'Animation effects are off in Windows, so it stays reduced' : 'Reduced swaps bounces for fades'}>
              <Segmented
                label="Motion"
                value={settings.motion}
                options={[
                  ['full', 'Full'],
                  ['reduced', 'Reduced'],
                ]}
                onChange={(motion) => update({ motion })}
              />
            </Row>
          </Card>
        </div>
      </div>

      <p className={styles.later}>The YouTube login gets its card in Phase 4.</p>
    </div>
  )
}
