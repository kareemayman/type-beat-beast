import { useEffect, useRef, useState } from 'react'
import { beatStarsTitle } from '../../shared/beatstars'
import { parseKey } from '../../shared/parseBeatName'
import Celebration, { type Burst } from './components/Celebration'
import { pickMascot, type MascotKind } from './components/Mascot'
import Rail, { type Screen } from './components/Rail'
import TitleBar from './components/TitleBar'
import { beatSeconds, emptyBeat, isValidBpm, tagTrack, type Beat } from './lib/beat'
import { useDocumentHidden, useKonami, useLateNight, useReducedMotion, useTheme } from './lib/environment'
import { DEMO, STEPS, usePipeline } from './lib/pipeline'
import { useSettings } from './lib/settings'
import { useToast } from './lib/toasts'
import History from './screens/History'
import NewBeat from './screens/new-beat/NewBeat'
import Schedule from './screens/Schedule'
import Settings from './screens/Settings'
import styles from './App.module.css'

const BEATSTARS = STEPS.findIndex((step) => step.id === 'bs')

// What BeatStars will need, checked before Run: its step comes after the renders, minutes in. Null when all's there.
function beatStarsProblem(beat: Beat): string | null {
  if (!beat.name.trim()) return 'Give the beat a name.'
  if (!isValidBpm(beat.bpm)) return 'Fill in the BPM (40–300).'
  if (!parseKey(beat.key)?.mode) return 'Fill in the key with major or minor, like "C# min". BeatStars needs it.'
  if (!beatStarsTitle(beat.name)) return `"${beat.name}" makes a BeatStars title over 60 characters. Shorten the beat name.`
  if (!beat.cover) return 'Drop a cover image too. BeatStars needs artwork.'
  if (!/\.(jpe?g|png|webp)$/i.test(beat.cover.path)) return 'Use a JPG, PNG or WebP cover for BeatStars.'
  return null
}

export default function App() {
  const { settings, update } = useSettings()
  const toast = useToast()
  const theme = useTheme()
  const hidden = useDocumentHidden()
  const reduceMotion = useReducedMotion()
  const lateNight = useLateNight()
  const producerMode = useKonami()

  const [screen, setScreen] = useState<Screen>('new')
  const [beat, setBeat] = useState<Beat>(() => emptyBeat(settings))
  const [mascot, setMascot] = useState<MascotKind>(() => pickMascot())
  const [burst, setBurst] = useState<Burst | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const pipeline = usePipeline({ stems: beat.stems, paused: hidden })

  // The main process says when the Notes window opens or closes, so the rail's Notes button can light up.
  useEffect(() => window.api.onNotesChanged(setNotesOpen), [])

  // Animations pause while the window is hidden (see tokens.css).
  useEffect(() => {
    document.documentElement.dataset.paused = hidden ? '1' : '0'
  }, [hidden])

  // A file dropped outside a drop zone is ignored instead of replacing the page.
  useEffect(() => {
    const ignore = (event: DragEvent) => event.preventDefault()
    window.addEventListener('dragover', ignore)
    window.addEventListener('drop', ignore)
    return () => {
      window.removeEventListener('dragover', ignore)
      window.removeEventListener('drop', ignore)
    }
  }, [])

  // A page with no project on it follows the defaults in Settings. Once a project is loaded, its options are its own.
  useEffect(() => {
    setBeat((b) => (b.fileName || (b.stems === settings.stems && b.bsFile === settings.bsFile) ? b : { ...b, stems: settings.stems, bsFile: settings.bsFile }))
  }, [settings.stems, settings.bsFile])

  // The cover preview is a blob: URL held in memory; free it once it's replaced.
  useEffect(() => {
    const url = beat.cover?.url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [beat.cover?.url])

  const lastPhase = useRef(pipeline.phase)
  useEffect(() => {
    if (lastPhase.current === 'running' && pipeline.phase === 'done') toast('done', `${beat.name || 'The beat'} is cooked!`)
    lastPhase.current = pipeline.phase
  }, [pipeline.phase, beat.name, toast])

  function run() {
    if (pipeline.phase === 'running' || pipeline.phase === 'needs') return
    // A finished beat is already up, so running it again would upload it twice.
    if (pipeline.phase === 'done') return toast('info', 'This one is cooked. Press Cook another for the next beat.')
    if (!beat.fileName) return toast('info', 'Drop an FL Studio project first.')
    const problem = beatStarsProblem(beat)
    if (problem) return toast('info', problem)
    // Running with a tag track confirms it, so its name is remembered for the next beat.
    const tag = tagTrack(beat)
    if (tag) {
      if (!settings.tagNames.some((name) => name.toLowerCase() === tag.name.toLowerCase())) update({ tagNames: [...settings.tagNames, tag.name] })
      setBeat((b) => ({ ...b, tagSource: 'remembered' }))
    }
    setMascot((previous) => pickMascot(previous))
    setScreen('new')
    pipeline.run({
      project: beat.path,
      beatName: beat.name,
      tagIndex: beat.tagIndex,
      stems: beat.stems,
      bpm: Number(beat.bpm),
      key: beat.key,
      cover: beat.cover?.path ?? '', // beatStarsProblem made sure there is one
      bsFile: beat.bsFile,
    })
    if (DEMO) toast('info', 'Renders and BeatStars are for real: BeatStars waits for your OK before publishing. YouTube is still a demo.')
  }

  // "Cook another": clear the finished beat and its cover, ready for the next project.
  function startNewBeat() {
    setBeat(emptyBeat(settings))
    pipeline.reset()
  }

  // Stop a run partway. The beat stays loaded, so it can run again or be swapped for another project. A BeatStars
  // draft it made stays in the Studio, unpublished.
  function stop() {
    const draft = ['running', 'needs', 'failed'].includes(pipeline.steps[BEATSTARS].status)
    pipeline.reset()
    toast('info', draft ? 'Stopped. The BeatStars draft stays in your Studio, unpublished.' : 'Stopped. Run it again or drop another beat.')
  }

  // Ctrl + Enter runs from anywhere. The ref always points at the latest run(), so the listener is added once.
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.key !== 'Enter') return
      event.preventDefault()
      runRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The user's OK on the BeatStars review: the BeatStars step publishes. The confetti waits for BeatStars to confirm,
  // then bursts from where the button was.
  const publishButton = useRef<DOMRect | null>(null)
  function publish(button: DOMRect) {
    publishButton.current = button
    pipeline.approve()
  }
  const bsStatus = pipeline.steps[BEATSTARS].status
  const lastBsStatus = useRef(bsStatus)
  useEffect(() => {
    const button = publishButton.current
    // Filling in ends in "needs", so running → done is always the publish.
    if (lastBsStatus.current === 'running' && bsStatus === 'done' && button) {
      const id = Date.now()
      setBurst({ x: button.left + button.width / 2, y: button.top, id })
      setTimeout(() => setBurst((b) => (b?.id === id ? null : b)), 1500)
      toast('done', 'Live on BeatStars!')
    }
    lastBsStatus.current = bsStatus
  }, [bsStatus, toast])

  return (
    <div className={styles.app}>
      <TitleBar
        beatName={beat.name}
        beatInfo={[beat.bpm, beat.key].filter(Boolean).join(' · ')}
        phase={pipeline.phase}
        beatSec={beatSeconds(beat.bpm)}
        reduceMotion={reduceMotion}
        theme={theme}
        onToggleTheme={() => update({ themePref: theme === 'dark' ? 'light' : 'dark' })}
        lateNight={lateNight}
        producerMode={producerMode}
        producerName={settings.producerName}
      />
      <Rail screen={screen} onNavigate={setScreen} notesOpen={notesOpen} onNotes={() => window.api.openNotes()} />
      <main className={`${styles.main} grid-bg`}>
        {screen === 'new' ? (
          <NewBeat
            beat={beat}
            setBeat={setBeat}
            pipeline={pipeline}
            onRun={run}
            onNewBeat={startNewBeat}
            onStop={stop}
            onPublish={publish}
            mascot={mascot}
            producerMode={producerMode}
            reduceMotion={reduceMotion}
            onGoSettings={() => setScreen('settings')}
          />
        ) : screen === 'schedule' ? (
          <Schedule
            // A cooked beat already has its slot, so the next free one is for whatever comes after it.
            beatName={pipeline.phase === 'done' ? '' : beat.name}
            mascot={mascot}
            reduceMotion={reduceMotion}
            onGoNewBeat={() => setScreen('new')}
            onGoSettings={() => setScreen('settings')}
          />
        ) : screen === 'settings' ? (
          <Settings />
        ) : (
          <History beat={beat} pipeline={pipeline} />
        )}
      </main>
      <Celebration burst={burst} mascot={mascot} bpm={beat.bpm} reduceMotion={reduceMotion} />
    </div>
  )
}
