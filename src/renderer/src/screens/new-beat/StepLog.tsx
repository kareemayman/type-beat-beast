import Card from '../../components/Card'
import { STEPS, displayStatus, mmss, type LogContext, type StepState } from '../../lib/pipeline'
import styles from './StepLog.module.css'

interface Line {
  text: string
  time: string
  dot: string
  color: string
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

// The log of the selected step (the current one unless the user clicked another node).
export default function StepLog({ steps, index, ctx, stems }: { steps: StepState[]; index: number; ctx: LogContext; stems: boolean }) {
  const step = steps[index]
  const def = STEPS[index]
  const status = displayStatus(step, index, stems)
  const time = step.startedAt ? clock(step.startedAt) : ''

  let lines: Line[]
  if (status === 'queued') {
    lines = [{ text: "Hasn't started yet.", time: '', dot: 'var(--card2)', color: 'var(--text2)' }]
  } else if (status === 'skipped') {
    lines = [{ text: 'Skipped. Upload stems is off.', time: '', dot: 'var(--card2)', color: 'var(--text2)' }]
  } else if (def.real) {
    // A real step: what the main process did, the time so far while it runs, or why it failed.
    lines = (step.log ?? []).map((text) => ({ text, time, dot: '#22C55E', color: 'var(--text)' }))
    if (status === 'running') lines.push({ text: `${def.running(ctx, step)} ${mmss(step.seconds)}`, time: 'now', dot: '#FF6500', color: 'var(--t-run)' })
    if (status === 'failed') lines.push({ text: step.error ?? 'Something went wrong.', time, dot: '#FF4D6D', color: 'var(--t-fail)' })
    if (status === 'needs' && lines.length) lines[lines.length - 1] = { ...lines[lines.length - 1], dot: '#38BDF8' }
  } else {
    const all = def.log?.(ctx) ?? []
    const shown = status === 'running' ? Math.max(1, Math.ceil((step.progress / 100) * all.length)) : status === 'failed' ? 1 : all.length
    lines = all.slice(0, shown).map((text) => ({ text, time, dot: '#22C55E', color: 'var(--text)' }))
    if (status === 'running') lines.push({ text: `${def.running(ctx, step)} ${Math.floor(step.progress)}%`, time: 'now', dot: '#FF6500', color: 'var(--t-run)' })
    if (status === 'failed') lines.push({ text: def.failed ?? 'Something went wrong.', time, dot: '#FF4D6D', color: 'var(--t-fail)' })
    if (status === 'needs') lines[lines.length - 1] = { ...lines[lines.length - 1], dot: '#38BDF8' }
  }

  return (
    <Card sticker={`What's cooking · ${def.short}`} stickerColor="var(--sky)" stickerTilt="var(--tilt-3)" className={styles.card} aria-label="Step log">
      <div className={styles.lines}>
        {lines.map((line, i) => (
          <div key={i} className={styles.line}>
            <span className={styles.dot} style={{ background: line.dot }} />
            <span className={styles.text} style={{ color: line.color }}>
              {line.text}
            </span>
            <span className={styles.time}>{line.time}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
