import { useEffect, useRef, useState } from 'react'
import Card from '../../components/Card'
import { beatSeconds, isValidBpm, type Beat } from '../../lib/beat'
import styles from './BeatCard.module.css'

interface BeatCardProps {
  beat: Beat
  onChange(patch: Partial<Pick<Beat, 'name' | 'bpm' | 'key'>>): void
  reduceMotion: boolean
}

export default function BeatCard({ beat, onChange, reduceMotion }: BeatCardProps) {
  const [joke, setJoke] = useState(false)
  const lastValidBpm = useRef(beat.bpm)
  const jokeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(jokeTimer.current), [])
  useEffect(() => {
    if (isValidBpm(beat.bpm)) lastValidBpm.current = beat.bpm
  }, [beat.bpm])

  function onBpm(value: string) {
    const bpm = value.replace(/\D/g, '').slice(0, 3)
    onChange({ bpm })
    // Easter egg: 808 is a drum machine, not a tempo. The field snaps back after the joke.
    if (bpm !== '808') return
    setJoke(true)
    clearTimeout(jokeTimer.current)
    jokeTimer.current = setTimeout(() => {
      setJoke(false)
      onChange({ bpm: lastValidBpm.current })
    }, 2400)
  }

  return (
    <Card sticker="The beat" stickerColor="var(--rose)" stickerTilt="var(--tilt-3)" className={styles.card} aria-label="The beat">
      <label className={styles.nameField}>
        <span className={styles.caption}>Name</span>
        <input className={styles.name} value={beat.name} placeholder="Beat name" aria-label="Beat name" onChange={(e) => onChange({ name: e.target.value })} />
      </label>
      <div className={styles.stickers}>
        <label
          className={`${styles.sticker} ${styles.bpm}`}
          style={{ borderColor: joke ? 'var(--yellow)' : undefined, animation: joke && !reduceMotion ? 'tbcShake 380ms ease-out' : 'none' }}
        >
          <span className={styles.stickerCaption}>
            BPM
            <span className={styles.beatDot} style={{ animation: reduceMotion ? 'none' : `tbcBreathe ${beatSeconds(beat.bpm).toFixed(3)}s ease-out infinite` }} />
          </span>
          <input className={styles.stickerInput} value={beat.bpm} placeholder="—" inputMode="numeric" aria-label="BPM" onChange={(e) => onBpm(e.target.value)} />
          {joke && (
            <span role="status" className={styles.joke} style={{ animation: reduceMotion ? 'tbcFade 150ms both' : 'tbcFlash 420ms ease-in-out 3' }}>
              that's a drum machine, not a tempo
            </span>
          )}
        </label>
        <label className={`${styles.sticker} ${styles.key}`}>
          <span className={styles.stickerCaption}>Key</span>
          <input className={`${styles.stickerInput} ${styles.keyInput}`} value={beat.key} placeholder="—" aria-label="Key" onChange={(e) => onChange({ key: e.target.value })} />
        </label>
      </div>
    </Card>
  )
}
