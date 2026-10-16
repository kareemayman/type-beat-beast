import { useEffect, useMemo, useRef } from 'react'
import Mascot, { type MascotKind } from './Mascot'
import styles from './Celebration.module.css'

export interface Burst {
  x: number // where the Publish button was, in window pixels
  y: number
  id: number
}

interface CelebrationProps {
  burst: Burst | null
  mascot: MascotKind
  bpm: string
  reduceMotion: boolean
}

// The publish moment: the mascot pops up shouting "It's live!" and notes fly out of the button.
export default function Celebration({ burst, mascot, bpm, reduceMotion }: CelebrationProps) {
  if (!burst) return null
  return (
    <div className={styles.layer} aria-hidden="true">
      <div
        className={styles.hero}
        style={{ left: burst.x - 70, top: burst.y - 168, animation: reduceMotion ? 'tbcFade 200ms both' : 'tbcPop 420ms cubic-bezier(.34,1.56,.64,1) both' }}
      >
        <Mascot kind={mascot} mood="done" bpm={bpm} size={150} reduceMotion={reduceMotion} />
        <span className={styles.bubble}>It's live!</span>
      </div>
      {reduceMotion ? (
        <div className={styles.published} style={{ left: burst.x - 70, top: burst.y - 44 }}>
          Published!
        </div>
      ) : (
        <Confetti key={burst.id} x={burst.x} y={burst.y} seed={burst.id} />
      )}
    </div>
  )
}

const GLYPHS = ['♪', '♫', '♩', '♬', 'wave']
const COLORS = ['#FF6500', '#38BDF8', '#22C55E', '#FACC15', '#FF4D6D', '#A78BFA']

function Confetti({ x, y, seed }: { x: number; y: number; seed: number }) {
  const pieces = useMemo(() => {
    let s = seed % 9973 || 7
    const random = () => (s = (s * 16807) % 2147483647) / 2147483647
    return Array.from({ length: 30 }, (_, i) => ({
      glyph: GLYPHS[i % GLYPHS.length],
      color: COLORS[i % COLORS.length],
      dx: (random() - 0.5) * 380,
      dy: -70 - random() * 220,
      rotate: (random() - 0.5) * 540,
      scale: 0.9 + random() * 0.7,
      delay: random() * 80,
    }))
  }, [seed])
  return (
    <div style={{ position: 'absolute', left: x, top: y }}>
      {pieces.map((piece, i) => (
        <Piece key={i} {...piece} />
      ))}
    </div>
  )
}

type PieceProps = { glyph: string; color: string; dx: number; dy: number; rotate: number; scale: number; delay: number }

// Each piece flies up and falls with the Web Animations API, so no CSS is generated per piece.
function Piece({ glyph, color, dx, dy, rotate, scale, delay }: PieceProps) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const animation = ref.current?.animate(
      [
        { transform: 'translate(-50%,0) scale(.4)', opacity: 0 },
        { transform: `translate(calc(-50% + ${dx * 0.7}px), ${dy}px) scale(${scale}) rotate(${rotate * 0.6}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), ${dy + 120}px) scale(${scale}) rotate(${rotate}deg)`, opacity: 0 },
      ],
      { duration: 1200, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' },
    )
    return () => animation?.cancel()
  }, [dx, dy, rotate, scale, delay])
  return (
    <span ref={ref} className={styles.piece} style={{ color }}>
      {glyph === 'wave'
        ? [6, 13, 8, 15, 7].map((height, i) => <i key={i} className={styles.bar} style={{ height, background: color }} />)
        : glyph}
    </span>
  )
}
