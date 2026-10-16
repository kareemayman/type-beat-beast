import { Fragment, useEffect, useRef, useState } from 'react'
import { Check, Hand, SkipForward, X } from 'lucide-react'
import Card from '../../components/Card'
import Mascot, { MASCOT_NAMES, type MascotKind, type MascotMood } from '../../components/Mascot'
import { beatSeconds } from '../../lib/beat'
import { DEMO, STEPS, displayStatus, type LogContext, type Phase, type StepState, type StepStatus } from '../../lib/pipeline'
import styles from './Pipeline.module.css'

// The 7 steps are laid out like a game level: nodes 112 px apart, every other one 22 px lower.
const STAGE_WIDTH = 744
const STAGE_HEIGHT = 226
const nodeX = (i: number) => 36 + i * 112
const nodeY = (i: number) => 106 + (i % 2 ? 22 : 0)
const RING = 2 * Math.PI * 42 // circumference of the progress ring

// Smooth S-curves through the first k + 1 nodes.
function trail(k: number): string {
  let d = `M ${nodeX(0)} ${nodeY(0)}`
  for (let i = 1; i <= k; i++) d += ` C ${nodeX(i - 1) + 50} ${nodeY(i - 1)} ${nodeX(i) - 50} ${nodeY(i)} ${nodeX(i)} ${nodeY(i)}`
  return d
}

const FILL: Record<StepStatus, string> = {
  queued: 'var(--card2)', running: '#FF6500', needs: '#38BDF8', done: '#22C55E', failed: '#FF4D6D', skipped: 'var(--card2)',
}
const STATUS_COLOR: Record<Phase | StepStatus, string> = {
  running: 'var(--t-run)', needs: 'var(--t-needs)', failed: 'var(--t-fail)', done: 'var(--t-done)',
  idle: 'var(--text2)', queued: 'var(--text2)', skipped: 'var(--text2)',
}
const MOOD: Record<Phase, MascotMood> = { running: 'cook', needs: 'wait', failed: 'fail', done: 'done', idle: 'idle' }

interface PipelineProps {
  name: string
  steps: StepState[]
  phase: Phase
  current: number
  selected: number
  onSelect(i: number): void
  stems: boolean
  bpm: string
  mascot: MascotKind
  producerMode: boolean
  reduceMotion: boolean
  publishTime: string
  ctx: LogContext
}

export default function Pipeline(props: PipelineProps) {
  const { name, steps, phase, current, selected, onSelect, stems, bpm, mascot, producerMode, reduceMotion: rm, publishTime, ctx } = props
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  // The level is drawn at a fixed size and shrinks to fit narrower windows.
  useEffect(() => {
    const element = box.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / STAGE_WIDTH)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const b = beatSeconds(bpm).toFixed(3)
  const firstQueued = steps.findIndex((step, i) => displayStatus(step, i, stems) === 'queued')
  const headline =
    phase === 'running' ? STEPS[current].running(ctx)
    : phase === 'needs' ? STEPS[current].needs
    : phase === 'failed' ? STEPS[current].failed
    : phase === 'done' ? `Every step done. Scheduled for tomorrow ${publishTime}.`
    : name ? 'Ready when you are. Hit Run.'
    : 'Drop a project and hit Run.'
  const count = phase === 'done' ? STEPS.length : phase === 'idle' ? 0 : current + 1
  const bubble = { needs: 'your turn!', done: 'cooked!', failed: 'uh oh…', idle: `${MASCOT_NAMES[mascot]} is ready`, running: `${MASCOT_NAMES[mascot]} is cooking` }[phase]

  return (
    <Card className={styles.card} aria-label="Pipeline" sticker={DEMO ? 'Demo run' : undefined} stickerColor="var(--violet)" stickerTilt="var(--tilt-2)">
      <div className={styles.head}>
        <div className={styles.titles}>
          <h1 className={styles.name}>{name || 'No beat yet'}</h1>
          <div className={styles.headline} style={{ color: STATUS_COLOR[phase] }}>
            {headline}
          </div>
        </div>
        <span className={styles.count}>
          <b>
            {count}/{STEPS.length}
          </b>
          <small>steps</small>
        </span>
      </div>

      <div ref={box} className={styles.stageBox} style={{ height: STAGE_HEIGHT * scale }}>
        <div className={styles.stage} style={{ transform: `scale(${scale})` }}>
          <svg width={STAGE_WIDTH} height={STAGE_HEIGHT} viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`} aria-hidden="true" className={styles.paths}>
            <path d={trail(STEPS.length - 1)} className={styles.trail} />
            <path d={trail(phase === 'done' ? STEPS.length - 1 : current)} className={styles.progress} />
          </svg>

          {STEPS.map((def, i) => {
            const step = steps[i]
            const status = displayStatus(step, i, stems)
            const muted = status === 'queued' || status === 'skipped'
            const sub =
              status === 'done' ? 'Done'
              : status === 'running' ? `${Math.floor(step.progress)}%`
              : status === 'needs' ? 'Your turn'
              : status === 'failed' ? 'Oops'
              : status === 'skipped' ? 'Skipped'
              : i === firstQueued ? 'Up next'
              : 'Waiting'

            let animation = 'none'
            if (status === 'running') animation = rm ? 'tbcBreathe 2s ease-in-out infinite' : `tbcPulse ${b}s cubic-bezier(.2,.7,.3,1) infinite`
            if (status === 'needs') animation = 'tbcBreathe 1.8s ease-in-out infinite'
            // When the whole run finishes, the finished nodes pop one after another, like gear powering on.
            if (status === 'done' && !rm) animation = phase === 'done' ? `tbcPop 460ms cubic-bezier(.34,1.56,.64,1) ${i * 80}ms both` : 'tbcPop 320ms cubic-bezier(.34,1.56,.64,1) both'

            const Icon = status === 'skipped' ? SkipForward : def.icon
            const Badge = status === 'done' ? Check : status === 'needs' ? Hand : status === 'failed' ? X : null
            return (
              <Fragment key={def.id}>
                <button
                  className={styles.node}
                  style={{ left: nodeX(i) - 36, top: nodeY(i) - 36 }}
                  aria-label={`${def.short}: ${sub}`}
                  aria-pressed={selected === i}
                  onClick={() => onSelect(i)}
                >
                  <span className={styles.selectRing} style={{ opacity: selected === i ? 1 : 0 }} />
                  {status === 'running' && (
                    <svg className={styles.ring} width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">
                      <circle cx="46" cy="46" r="42" className={styles.ringTrack} />
                      <circle cx="46" cy="46" r="42" className={styles.ringFill} strokeDasharray={`${((RING * step.progress) / 100).toFixed(1)} ${RING.toFixed(1)}`} />
                    </svg>
                  )}
                  <span
                    className={styles.rainbow}
                    style={{ opacity: producerMode ? 1 : 0, animation: producerMode && !rm ? `tbcRainbow 1.2s linear ${(-i * 0.15).toFixed(2)}s infinite` : 'none' }}
                  />
                  <span className={styles.core} style={{ background: FILL[status], color: muted ? 'var(--text2)' : '#0B192C', animation }}>
                    <Icon size={30} strokeWidth={2.25} />
                  </span>
                  {Badge && (
                    <span
                      className={styles.badge}
                      style={{
                        background: status === 'needs' ? '#FACC15' : '#FFFFFF',
                        animation: status === 'done' && !rm ? `tbcPop 360ms cubic-bezier(.34,1.56,.64,1) ${phase === 'done' ? i * 80 + 120 : 80}ms both` : 'none',
                      }}
                    >
                      <Badge size={14} strokeWidth={3.5} />
                    </span>
                  )}
                </button>
                <span className={styles.label} style={{ left: nodeX(i) - 52, top: nodeY(i) + 44 }}>
                  <span className={styles.labelName}>{def.short}</span>
                  <span className={styles.labelSub} style={{ color: STATUS_COLOR[status] }}>
                    {sub}
                  </span>
                </span>
              </Fragment>
            )
          })}

          {/* The mascot stands on the current step and bounces over when the run moves on. */}
          <div className={styles.mascotSpot} style={{ transform: `translate(${nodeX(current) - 29}px, ${nodeY(current) - 106}px)` }}>
            <Mascot kind={mascot} mood={MOOD[phase]} bpm={bpm} size={62} reduceMotion={rm} />
            <span key={bubble} className={styles.bubble} data-side={current >= 5 ? 'left' : 'right'}>
              {bubble}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
