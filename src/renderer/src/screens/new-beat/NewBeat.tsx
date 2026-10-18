import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { ChevronUp, Plus } from 'lucide-react'
import type { MascotKind } from '../../components/Mascot'
import { beatFromProject, guessTag, tagTrack, type Beat } from '../../lib/beat'
import { DEMO, type LogContext, type Pipeline as PipelineState } from '../../lib/pipeline'
import { qualityLabel, useSettings, type Settings } from '../../lib/settings'
import { useToast } from '../../lib/toasts'
import BeatCard from './BeatCard'
import DropCard from './DropCard'
import MoreCard from './MoreCard'
import OptionsCard from './OptionsCard'
import Pipeline from './Pipeline'
import Review from './Review'
import RunPanel from './RunPanel'
import StepLog from './StepLog'
import styles from './NewBeat.module.css'

interface NewBeatProps {
  beat: Beat
  setBeat: Dispatch<SetStateAction<Beat>>
  pipeline: PipelineState
  onRun(): void
  onNewBeat(): void
  onStop(): void
  onPublish(button: DOMRect): void
  mascot: MascotKind
  producerMode: boolean
  reduceMotion: boolean
  onGoSettings(): void
}

function logContext(beat: Beat, settings: Settings): LogContext {
  const tag = tagTrack(beat)
  return {
    name: beat.name || 'beat',
    base: beat.fileName.replace(/\.flp$/i, '') || beat.name || 'beat',
    tagTrack: tag ? `track ${tag.index}` : '',
    // FL leaves muted mixer tracks out of a split render, and the tag gets muted, so neither becomes a stem.
    stems: beat.tracks.filter((track) => !track.muted && track.index !== beat.tagIndex).map((track) => track.name),
    quality: { wav: settings.wavBits === '32f' ? '32-bit float' : `${settings.wavBits}-bit`, mp3: `${settings.mp3Rate} kbps` },
  }
}

export default function NewBeat({ beat, setBeat, pipeline, onRun, onNewBeat, onStop, onPublish, mascot, producerMode, reduceMotion, onGoSettings }: NewBeatProps) {
  const { settings } = useSettings()
  const toast = useToast()
  const [moreOpen, setMoreOpen] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const { steps, phase, current } = pipeline
  const ctx = useMemo(() => logContext(beat, settings), [beat, settings])

  // When the run moves on, the log goes back to following the step that's happening.
  useEffect(() => setSelected(null), [phase, current])

  const patch = (change: Partial<Beat>) => setBeat((b) => ({ ...b, ...change }))

  async function openProject(file: File) {
    if (phase === 'running' || phase === 'needs') return toast('info', 'This beat is still going. Stop it first, then drop the next one.')
    // The page only knows the file's name. The preload gets its full path from Electron, then IPC asks the
    // main process to read the file, because only the main process can touch the disk.
    const result = await window.api.readProject(window.api.pathForFile(file))
    if (!result.ok) return toast('failed', result.error)
    const { project } = result
    setBeat((b) => beatFromProject(project, settings.tagNames, b))
    pipeline.reset()
    if (!project.beat.ok) toast('info', "Couldn't read the BPM and key from the name. Fill them in.")
    // A guessed tag track needs a look before anything renders.
    if (guessTag(project.tracks, settings.tagNames).tagSource === 'guessed') setMoreOpen(true)
  }

  function openCover(file: File) {
    patch({ cover: { url: URL.createObjectURL(file), name: file.name, path: window.api.pathForFile(file) } })
  }

  const selectedStep = selected ?? current

  return (
    <div className={styles.layout}>
      <div className={styles.left}>
        <DropCard
          fileName={beat.fileName}
          cover={beat.cover}
          rendering={steps[0].status === 'running' || steps[1].status === 'running'}
          reduceMotion={reduceMotion}
          onProject={openProject}
          onCover={openCover}
        />
        <BeatCard beat={beat} onChange={patch} reduceMotion={reduceMotion} />
        <OptionsCard stems={beat.stems} bsFile={beat.bsFile} quality={qualityLabel(settings)} onChange={patch} onGoSettings={onGoSettings} />
        <button className={styles.moreToggle} aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
          {moreOpen ? <ChevronUp size={18} strokeWidth={2.5} /> : <Plus size={18} strokeWidth={2.5} />}
          {moreOpen ? 'Less' : 'More: collabs, tag track, timers'}
        </button>
        {moreOpen && <MoreCard beat={beat} steps={steps} phase={phase} onChange={patch} />}
      </div>

      <div className={styles.right}>
        <Pipeline
          name={beat.name}
          steps={steps}
          phase={phase}
          current={current}
          selected={selectedStep}
          onSelect={setSelected}
          stems={beat.stems}
          bpm={beat.bpm}
          mascot={mascot}
          producerMode={producerMode}
          reduceMotion={reduceMotion}
          publishTime={settings.publishTime}
          ctx={ctx}
        />
        {phase === 'needs' ? (
          <Review
            beat={beat}
            freeDownload={settings.freeDownload}
            onPublish={onPublish}
            onOpenBrowser={() => toast('info', DEMO ? 'Demo: the browser part comes with the BeatStars step.' : 'BeatStars draft opened in your browser.')}
            onStop={onStop}
          />
        ) : (
          <div className={styles.bottom}>
            <StepLog steps={steps} index={selectedStep} ctx={ctx} stems={beat.stems} />
            <RunPanel steps={steps} phase={phase} onRun={onRun} onNewBeat={onNewBeat} onRetry={pipeline.retry} onStop={onStop} reduceMotion={reduceMotion} />
          </div>
        )}
      </div>
    </div>
  )
}
