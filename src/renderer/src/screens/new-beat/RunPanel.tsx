import { Play, RotateCcw } from 'lucide-react'
import { overallProgress, type Phase, type StepState } from '../../lib/pipeline'
import styles from './RunPanel.module.css'

interface RunPanelProps {
  steps: StepState[]
  phase: Phase
  onRun(): void
  onRetry(): void
  reduceMotion: boolean
}

export default function RunPanel({ steps, phase, onRun, onRetry, reduceMotion }: RunPanelProps) {
  const failed = phase === 'failed'
  const fraction = overallProgress(steps)
  const hint = phase === 'running' ? 'sit back, it’s cooking' : failed ? 'retry picks up where it stopped' : 'or Ctrl + Enter'

  return (
    <section className={styles.panel} aria-label="Run">
      {phase === 'running' ? (
        <div role="status" className={styles.busy}>
          <span className={styles.disc} style={{ animation: reduceMotion ? 'none' : 'tbcSpin 1.8s linear infinite' }}>
            <span className={styles.grooves} />
            <span className={styles.hub} />
            <span className={styles.mark} />
          </span>
          <span className={styles.busyText}>
            <span>Cooking… {Math.round(fraction * 100)}%</span>
            <span className={styles.bar}>
              <span style={{ transform: `scaleX(${fraction.toFixed(3)})` }} />
            </span>
          </span>
        </div>
      ) : (
        <button className={styles.run} onClick={onRun}>
          <Play size={28} strokeWidth={3} />
          {phase === 'done' ? 'Cook another' : failed ? 'Start over' : 'Run it!'}
        </button>
      )}
      <button className={styles.retry} onClick={onRetry} disabled={!failed}>
        <RotateCcw size={18} strokeWidth={2.5} />
        Retry failed step
      </button>
      <span className={styles.hint}>{hint}</span>
    </section>
  )
}
