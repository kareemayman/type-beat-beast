import { useEffect, useRef, useState } from 'react'
import Celebration, { type Burst } from './components/Celebration'
import { pickMascot, type MascotKind } from './components/Mascot'
import Rail, { type Screen } from './components/Rail'
import TitleBar from './components/TitleBar'
import { beatSeconds, emptyBeat, tagTrack, type Beat } from './lib/beat'
import { useDocumentHidden, useKonami, useLateNight, useReducedMotion, useSystemDark } from './lib/environment'
import { DEMO, usePipeline } from './lib/pipeline'
import { useSettings } from './lib/settings'
import { useToast } from './lib/toasts'
import ComingSoon from './screens/ComingSoon'
import NewBeat from './screens/new-beat/NewBeat'
import Schedule from './screens/Schedule'
import styles from './App.module.css'

export default function App() {
  const { settings, update } = useSettings()
  const toast = useToast()
  const systemDark = useSystemDark()
  const theme = settings.themePref === 'system' ? (systemDark ? 'dark' : 'light') : settings.themePref
  const hidden = useDocumentHidden()
  const reduceMotion = useReducedMotion()
  const lateNight = useLateNight()
  const producerMode = useKonami()

  const [screen, setScreen] = useState<Screen>('new')
  const [beat, setBeat] = useState<Beat>(() => emptyBeat(settings))
  const [mascot, setMascot] = useState<MascotKind>(() => pickMascot())
  const [burst, setBurst] = useState<Burst | null>(null)
  const pipeline = usePipeline({ stems: beat.stems, paused: hidden })

  // Theme: CSS picks colors from data-theme, and the main process recolors Windows' caption buttons to match.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.api.setTheme(theme)
  }, [theme])

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
    // Running with a tag track confirms it, so its name is remembered for the next beat.
    const tag = tagTrack(beat)
    if (tag) {
      if (!settings.tagNames.some((name) => name.toLowerCase() === tag.name.toLowerCase())) update({ tagNames: [...settings.tagNames, tag.name] })
      setBeat((b) => ({ ...b, tagSource: 'remembered' }))
    }
    setMascot((previous) => pickMascot(previous))
    setScreen('new')
    pipeline.run()
    if (DEMO) toast('info', 'Demo run: nothing gets rendered or uploaded yet.')
  }

  // "Cook another": clear the finished beat and its cover, ready for the next project.
  function startNewBeat() {
    setBeat(emptyBeat(settings))
    pipeline.reset()
  }

  // Stop a run partway. The beat stays loaded, so it can run again or be swapped for another project.
  function stop() {
    pipeline.reset()
    toast('info', 'Stopped. Run it again or drop another beat.')
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

  function publish(button: DOMRect) {
    pipeline.approve()
    const id = Date.now()
    setBurst({ x: button.left + button.width / 2, y: button.top, id })
    setTimeout(() => setBurst((b) => (b?.id === id ? null : b)), 1500)
    toast('done', DEMO ? 'Demo: this is where it goes live on BeatStars.' : 'Live on BeatStars!')
  }

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
      <Rail screen={screen} onNavigate={setScreen} notesOpen={false} onNotes={() => toast('info', 'The Notes window gets built next.')} />
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
        ) : (
          <ComingSoon screen={screen} reduceMotion={reduceMotion} />
        )}
      </main>
      <Celebration burst={burst} mascot={mascot} bpm={beat.bpm} reduceMotion={reduceMotion} />
    </div>
  )
}
