import { MicVocal, X } from 'lucide-react'
import Card from '../../components/Card'
import type { Beat, TagSource } from '../../lib/beat'
import { mmss, secondsLeft, type Phase, type StepState } from '../../lib/pipeline'
import styles from './MoreCard.module.css'

const BADGE: Record<Exclude<TagSource, 'none'>, { text: string; color: string }> = {
  remembered: { text: 'remembered', color: 'var(--green)' },
  picked: { text: 'your pick', color: 'var(--green)' },
  guessed: { text: 'guess · check it', color: 'var(--yellow)' },
}

// A made-up waveform for the progress strip, seeded so it looks the same every time.
const WAVE = (() => {
  let seed = 11
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  return Array.from({ length: 64 }, (_, i) => {
    const t = i / 64
    const envelope = t < 0.12 ? 0.3 : t < 0.5 ? 0.85 : t < 0.56 ? 0.4 : 0.95
    return Math.max(0.15, Math.min(1, envelope * (0.5 + 0.5 * random())))
  })
})()

interface MoreCardProps {
  beat: Beat
  steps: StepState[]
  phase: Phase
  onChange(patch: Partial<Beat>): void
}

export default function MoreCard({ beat, steps, phase, onChange }: MoreCardProps) {
  const elapsed = steps.reduce((sum, step) => sum + step.seconds, 0)
  const progress = (i: number) => (steps[i].status === 'done' ? 100 : steps[i].status === 'running' ? steps[i].progress : 0)
  const wavProgress = progress(0)
  const mp3Progress = progress(1)
  const badge = beat.tagSource !== 'none' && BADGE[beat.tagSource]

  return (
    <Card sticker="More" stickerColor="var(--violet)" stickerTilt="var(--tilt-3)" className={styles.card} aria-label="More details">
      <div className={styles.group}>
        <span className={styles.caption}>Collaborators</span>
        <div className={styles.chips}>
          {beat.collabs.map((name) => (
            <span key={name} className={styles.chip}>
              {name}
              <button aria-label={`Remove ${name}`} onClick={() => onChange({ collabs: beat.collabs.filter((c) => c !== name) })}>
                <X size={14} strokeWidth={3} />
              </button>
            </span>
          ))}
          {!beat.collabs.length && <span className={styles.dim}>Solo cook</span>}
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.caption}>Tag track</span>
        <label className={styles.tag}>
          <MicVocal size={16} strokeWidth={2.5} className={styles.mic} />
          <select
            className={styles.select}
            value={beat.tagIndex ?? 'none'}
            aria-label="Tag track"
            disabled={!beat.tracks.length}
            onChange={(e) => {
              const value = e.target.value
              onChange(value === 'none' ? { tagIndex: null, tagSource: 'none' } : { tagIndex: Number(value), tagSource: 'picked' })
            }}
          >
            {beat.tracks.length ? (
              <>
                {beat.tracks.map((track) => (
                  <option key={track.index} value={track.index}>
                    {track.name} · track {track.index}
                  </option>
                ))}
                <option value="none">No tag</option>
              </>
            ) : (
              <option value="none">Drop a project to see its mixer tracks</option>
            )}
          </select>
          {badge ? (
            <span className={styles.badge} style={{ background: badge.color }}>
              {badge.text}
            </span>
          ) : (
            beat.tracks.length > 0 && <span className={styles.dim}>no tag</span>
          )}
        </label>
      </div>

      <div className={styles.timers}>
        <span className={styles.timer}>
          <span className={styles.caption}>Elapsed</span>
          <b>{mmss(elapsed)}</b>
        </span>
        <span className={styles.timer}>
          <span className={styles.caption}>Left</span>
          <b>{phase === 'done' ? '0:00' : `~${mmss(secondsLeft(steps))}`}</b>
        </span>
      </div>

      <div aria-hidden="true" className={styles.wave}>
        {WAVE.map((height, i) => {
          const x = ((i + 0.5) / WAVE.length) * 100
          const color = x < mp3Progress ? '#FF6500' : x < wavProgress ? '#38BDF8' : 'var(--track)'
          return <span key={i} style={{ height: `${Math.round(height * 100)}%`, background: color }} />
        })}
      </div>
    </Card>
  )
}
