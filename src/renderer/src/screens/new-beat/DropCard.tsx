import { useEffect, useRef, useState, type DragEvent } from 'react'
import { ArrowDownToLine, Check, FileMusic, FilePlus, FileX, ImageOff } from 'lucide-react'
import Card from '../../components/Card'
import type { Cover } from '../../lib/beat'
import styles from './DropCard.module.css'

// Other DAWs' project files, so a wrong drop gets a friendlier message.
const OTHER_DAWS: Record<string, string> = {
  als: 'an Ableton Live set',
  logicx: 'a Logic Pro project',
  ptx: 'a Pro Tools session',
  rpp: 'a REAPER project',
  cpr: 'a Cubase project',
  song: 'a Studio One song',
  bwproject: 'a Bitwig project',
}

interface DropCardProps {
  fileName: string
  cover: Cover | null
  rendering: boolean // while audio renders, the cover turns into a spinning record
  reduceMotion: boolean
  onProject(file: File): void
  onCover(file: File): void
}

type WrongFile = { ext: string; daw?: string }

export default function DropCard({ fileName, cover, rendering, reduceMotion, onProject, onCover }: DropCardProps) {
  const [projectOver, setProjectOver] = useState(false)
  const [projectWrong, setProjectWrong] = useState<WrongFile | null>(null)
  const [coverOver, setCoverOver] = useState(false)
  const [coverWrong, setCoverWrong] = useState(false)
  const [tilt, setTilt] = useState<{ x: number; y: number } | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms))

  function takeProject(file: File) {
    const ext = /\.([^.]+)$/.exec(file.name)?.[1].toLowerCase() ?? ''
    if (ext !== 'flp') {
      setProjectWrong({ ext, daw: OTHER_DAWS[ext] })
      later(() => setProjectWrong(null), 4000)
      return
    }
    setProjectWrong(null)
    onProject(file)
  }

  function takeCover(file: File) {
    if (!file.type.startsWith('image/')) {
      setCoverWrong(true)
      later(() => setCoverWrong(false), 3500)
      return
    }
    setCoverWrong(false)
    onCover(file)
  }

  // dragleave also fires when the pointer moves onto a child element; only count leaving the zone itself.
  const left = (event: DragEvent) => !event.currentTarget.contains(event.relatedTarget as Node | null)
  const dropped = (event: DragEvent) => {
    event.preventDefault()
    return event.dataTransfer.files[0]
  }

  const state = projectWrong ? 'wrong' : projectOver ? 'over' : fileName ? 'filled' : 'empty'
  const spinning = rendering && !coverOver
  const shake = reduceMotion ? 'none' : 'tbcShake 380ms ease-out'
  const coverTilt = tilt && !reduceMotion
    ? `perspective(420px) rotateY(${(tilt.x * 30).toFixed(1)}deg) rotateX(${(-tilt.y * 30).toFixed(1)}deg) scale(1.06)`
    : 'none'
  const art = cover && <div className={styles.art} style={{ backgroundImage: `url("${cover.url}")` }} />

  return (
    <Card sticker="Drop it" className={styles.card} aria-label="Drop files">
      <span aria-hidden="true" className={styles.note}>
        .flp + cover ↓
      </span>
      <div className={styles.row}>
        <label
          className={styles.project}
          data-state={state}
          style={{ animation: state === 'wrong' ? shake : 'none' }}
          onDragOver={(e) => {
            e.preventDefault()
            setProjectOver(true)
            setProjectWrong(null)
          }}
          onDragLeave={(e) => left(e) && setProjectOver(false)}
          onDrop={(e) => {
            const file = dropped(e)
            setProjectOver(false)
            if (file) takeProject(file)
          }}
        >
          <input
            type="file"
            accept=".flp"
            className={styles.hiddenInput}
            aria-label="Choose FL Studio project"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) takeProject(file)
              e.target.value = ''
            }}
          />
          {state === 'filled' && (
            <>
              <span className={styles.filledHead}>
                <span className={styles.fileBadge}>
                  <FileMusic size={16} strokeWidth={2.5} />
                </span>
                <span className={styles.readIt}>
                  <Check size={14} strokeWidth={3} />
                  Read it
                </span>
              </span>
              <span className={styles.fileName}>{fileName}</span>
            </>
          )}
          {state === 'over' && (
            <span className={styles.letGo}>
              <ArrowDownToLine size={24} strokeWidth={2.5} />
              Let go!
            </span>
          )}
          {state === 'wrong' && projectWrong && (
            <>
              <span className={styles.wrongHead}>
                <FileX size={18} strokeWidth={2.5} />
                {projectWrong.daw ? 'Wrong DAW.' : "That's not a project."}
              </span>
              <span className={styles.wrongBody}>Drop an FL Studio project (.flp).</span>
              <span className={styles.wrongSub}>
                {projectWrong.daw ? `That's ${projectWrong.daw}.` : projectWrong.ext ? `Got a .${projectWrong.ext} file.` : 'Got a file with no extension.'}
              </span>
            </>
          )}
          {state === 'empty' && (
            <span className={styles.empty}>
              <FilePlus size={24} strokeWidth={2.25} />
              <b>FL project</b>
            </span>
          )}
        </label>

        <label
          className={styles.cover}
          aria-label="Cover art"
          style={{ animation: coverWrong ? shake : 'none' }}
          onDragOver={(e) => {
            e.preventDefault()
            const box = e.currentTarget.getBoundingClientRect()
            setCoverOver(true)
            setCoverWrong(false)
            setTilt({ x: (e.clientX - box.left) / box.width - 0.5, y: (e.clientY - box.top) / box.height - 0.5 })
          }}
          onDragLeave={(e) => {
            if (!left(e)) return
            setCoverOver(false)
            setTilt(null)
          }}
          onDrop={(e) => {
            const file = dropped(e)
            setCoverOver(false)
            setTilt(null)
            if (file) takeCover(file)
          }}
        >
          <input
            type="file"
            accept="image/*"
            className={styles.hiddenInput}
            aria-label="Choose cover art"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) takeCover(file)
              e.target.value = ''
            }}
          />
          <div className={styles.coverInner} style={{ transform: coverTilt }}>
            <div className={styles.sleeve} style={{ opacity: spinning ? 0 : 1, borderColor: coverOver ? 'var(--orange)' : undefined }}>
              {art}
              <span className={styles.coverLabel}>{cover ? cover.name : 'Cover art'}</span>
            </div>
            <div aria-hidden="true" className={styles.record} style={{ opacity: spinning ? 1 : 0 }}>
              <div className={styles.disc} style={{ animation: spinning && !reduceMotion ? 'tbcSpin 3.6s linear infinite' : 'none' }}>
                <div className={styles.grooves} />
                <div className={styles.label}>{art}</div>
                <div className={styles.spindle} />
                <div className={styles.marker} />
              </div>
            </div>
            {coverOver && (
              <div className={styles.coverOver}>
                <span>Drop!</span>
              </div>
            )}
            {coverWrong && (
              <div className={styles.coverWrong}>
                <ImageOff size={22} strokeWidth={2.5} />
                <b>Not a picture.</b>
                <small>JPG or PNG</small>
              </div>
            )}
          </div>
        </label>
      </div>
    </Card>
  )
}
