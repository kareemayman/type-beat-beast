import type { CSSProperties } from 'react'

export type MascotKind = 'keys' | 'subby' | 'tick' | 'spinz'
export type MascotMood = 'idle' | 'cook' | 'wait' | 'fail' | 'done'

export const MASCOT_NAMES: Record<MascotKind, string> = { keys: 'Keys', subby: 'Subby', tick: 'Tick', spinz: 'Spinz' }

// A different mascot than last time, so every run feels new.
export function pickMascot(previous?: MascotKind): MascotKind {
  const options = (Object.keys(MASCOT_NAMES) as MascotKind[]).filter((kind) => kind !== previous)
  return options[Math.floor(Math.random() * options.length)]
}

interface MascotProps {
  kind: MascotKind
  mood: MascotMood
  bpm?: string | number
  size?: number // height in px
  reduceMotion?: boolean
}

// Shorthand for an absolutely placed part on the mascot's 160 × 170 canvas.
const at = (left: number | string, top: number | string, width: number | string, height: number | string, more: CSSProperties = {}): CSSProperties => ({
  position: 'absolute', left, top, width, height, ...more,
})
const line = 'var(--bw) solid #000'

function Eye({ x, y, d, pupil, px, py, blink }: { x: number; y: number; d: number; pupil: number; px: number; py: number; blink: string }) {
  return (
    <span style={at(x, y, d, d, { borderRadius: 999, background: '#fff', border: line, animation: blink })}>
      <span style={at(px, py, pupil, pupil, { borderRadius: 999, background: '#000' })} />
    </span>
  )
}

// The four mascots from the design, drawn on a 160 × 170 canvas and scaled to `size`. Every move is timed to the BPM.
export default function Mascot({ kind, mood, bpm = 140, size = 72, reduceMotion = false }: MascotProps) {
  const scale = size / 170
  const n = Number(bpm)
  const beat = 60 / (Number.isInteger(n) && n >= 40 && n <= 300 ? n : 140)
  const b = beat.toFixed(3)
  const b2 = (beat * 2).toFixed(3)
  const rm = reduceMotion
  const cook = mood === 'cook' && !rm
  const done = mood === 'done' && !rm
  const fail = mood === 'fail'
  const wait = mood === 'wait'
  const blink = rm ? 'none' : 'tbmEye 4s infinite'

  const body = rm ? 'none'
    : cook ? `tbmHop ${b}s cubic-bezier(.3,0,.3,1) infinite`
    : done ? `tbmHop ${b}s cubic-bezier(.3,0,.3,1) 6`
    : wait ? 'tbmBob 1.8s ease-in-out infinite'
    : fail ? 'tbmWobble 2.4s ease-in-out infinite'
    : 'none'
  const pupilY = fail ? 11 : wait ? 4 : 6
  const shadow = Math.max(4, 3 / scale).toFixed(2)
  const vars = {
    '--bw': `${Math.max(3, 2.4 / scale).toFixed(2)}px`,
    '--bw2': `${Math.max(2, 1.8 / scale).toFixed(2)}px`,
    '--sh': `${shadow}px ${shadow}px 0 #000`,
  } as CSSProperties

  return (
    <div aria-hidden="true" style={{ position: 'relative', width: Math.round(160 * scale), height: size, ...vars }}>
      <div style={at(0, 0, 160, 170, { transform: `scale(${scale.toFixed(4)})`, transformOrigin: '0 0' })}>
        <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 100%', animation: body }}>
          {kind === 'keys' && <Keys beat={beat} b2={b2} cook={cook} done={done} fail={fail} pupilY={pupilY} blink={blink} />}
          {kind === 'subby' && <Subby b={b} b2={b2} cook={cook} done={done} fail={fail} wait={wait} pupilY={pupilY} blink={blink} />}
          {kind === 'tick' && <Tick b2={b2} cook={cook} done={done} fail={fail} pupilY={pupilY} blink={blink} />}
          {kind === 'spinz' && <Spinz cook={cook} done={done} fail={fail} rm={rm} blink={blink} />}
          {fail && (
            <span style={{ position: 'absolute', right: 6, top: 30, width: 20, height: 20, borderRadius: '0 50% 50% 50%', background: '#38BDF8', border: line, transform: 'rotate(45deg)', animation: rm ? 'none' : 'tbmDrip 1.6s ease-in infinite' }} />
          )}
          {mood === 'done' && (
            <>
              <span style={at(-8, 18, 18, 18, { background: '#FACC15', border: line, transform: 'rotate(45deg)', animation: rm ? 'none' : 'tbmSpark 420ms cubic-bezier(.34,1.56,.64,1) 120ms both' })} />
              <span style={{ position: 'absolute', right: -8, top: 6, width: 14, height: 14, background: '#22C55E', border: line, transform: 'rotate(45deg)', animation: rm ? 'none' : 'tbmSpark 420ms cubic-bezier(.34,1.56,.64,1) 220ms both' }} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// A 25-key MIDI controller with legs and a backwards cap. Plays its own keys on the beat.
function Keys({ beat, b2, cook, done, fail, pupilY, blink }: { beat: number; b2: string; cook: boolean; done: boolean; fail: boolean; pupilY: number; blink: string }) {
  const pressed: Record<number, number> = { 1: 0, 3: 1, 5: 2, 6: 3 }
  return (
    <>
      <span style={at(50, 128, 'var(--bw2)', 22, { background: '#000' })} />
      <span style={at(104, 128, 'var(--bw2)', 22, { background: '#000' })} />
      <span style={at(32, 142, 34, 18, { borderRadius: '10px 10px 6px 6px', background: '#fff', border: line })} />
      <span style={at(94, 142, 34, 18, { borderRadius: '10px 10px 6px 6px', background: '#fff', border: line })} />
      <div style={at(8, 40, 144, 92, { borderRadius: '16px 20px 14px 18px', background: '#FF6500', border: line, boxShadow: 'var(--sh)', overflow: 'hidden' })}>
        <span style={at(10, 12, 16, 16, { borderRadius: 999, background: '#FACC15', border: line })} />
        <span style={{ position: 'absolute', right: 10, top: 12, width: 16, height: 16, borderRadius: 999, background: '#FACC15', border: line }} />
        <Eye x={42} y={6} d={24} pupil={8} px={6} py={pupilY} blink={blink} />
        <Eye x={76} y={6} d={24} pupil={8} px={6} py={pupilY} blink={blink} />
        <span style={at(60, 32, 22, 11, { border: line, borderTop: 0, borderRadius: '0 0 12px 12px', transform: `rotate(${fail ? 180 : 0}deg)` })} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 42, background: '#fff', borderTop: line, display: 'flex' }}>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} style={{ position: 'relative', flex: 1, borderRight: i < 7 ? 'var(--bw2) solid #000' : 0 }}>
              <span
                style={{
                  position: 'absolute', inset: 0, background: '#FF6500',
                  opacity: fail && i === 3 ? 1 : 0, // one key sticks when something fails
                  animation: (cook || done) && pressed[i] !== undefined ? `tbmKey ${b2}s steps(1) ${((pressed[i] * beat) / 2).toFixed(3)}s infinite` : 'none',
                }}
              />
            </span>
          ))}
          {[1, 2, 4, 5, 6].map((k) => (
            <span key={k} style={at(`calc(${(k / 8) * 100}% - 5.5px)`, 0, 11, 24, { borderRadius: '0 0 3px 3px', background: '#000' })} />
          ))}
        </div>
      </div>
      <span style={at(28, 30, 36, 13, { borderRadius: 8, background: '#38BDF8', border: line })} />
      <span style={at(52, 8, 60, 36, { borderRadius: '999px 999px 6px 6px', background: '#38BDF8', border: line })} />
      <span style={at(76, 2, 12, 12, { borderRadius: 999, background: '#FF6500', border: line })} />
    </>
  )
}

// A grumpy subwoofer with horns. Its speaker cone thumps on every beat.
function Subby({ b, b2, cook, done, fail, wait, pupilY, blink }: { b: string; b2: string; cook: boolean; done: boolean; fail: boolean; wait: boolean; pupilY: number; blink: string }) {
  const browL = fail ? -16 : wait ? -6 : 14
  const browR = fail ? 16 : wait ? 6 : -14
  const cone = cook ? `tbmPump ${b}s cubic-bezier(.2,.7,.3,1) infinite` : done ? `tbmPump ${b2}s cubic-bezier(.2,.7,.3,1) 3` : 'none'
  return (
    <>
      <span style={at(30, 12, 26, 26, { borderRadius: 4, background: '#FACC15', border: line, transform: 'rotate(45deg)' })} />
      <span style={at(104, 12, 26, 26, { borderRadius: 4, background: '#FACC15', border: line, transform: 'rotate(45deg)' })} />
      <span style={at(32, 142, 34, 18, { borderRadius: 9, background: '#0B192C', border: line })} />
      <span style={at(94, 142, 34, 18, { borderRadius: 9, background: '#0B192C', border: line })} />
      <div style={at(18, 24, 124, 124, { borderRadius: '22px 26px 20px 24px', background: '#1E3E62', border: line, boxShadow: 'var(--sh)' })}>
        <span style={at(22, 8, 28, 7, { borderRadius: 4, background: '#000', transform: `rotate(${browL}deg)` })} />
        <span style={at(68, 8, 28, 7, { borderRadius: 4, background: '#000', transform: `rotate(${browR}deg)` })} />
        <Eye x={24} y={19} d={24} pupil={8} px={9} py={pupilY} blink={blink} />
        <Eye x={70} y={19} d={24} pupil={8} px={3} py={pupilY} blink={blink} />
        <div style={at(23, 47, 72, 72, { borderRadius: 999, background: '#0B192C', border: line, animation: cone })}>
          <span style={at(8, 8, 50, 50, { borderRadius: 999, border: 'var(--bw) solid #2A5280' })} />
          <span style={at(21, 21, 24, 24, { borderRadius: 999, background: '#FF6500', border: line })} />
        </div>
      </div>
    </>
  )
}

// A metronome gremlin. Its pendulum tail wags at the beat's real BPM.
function Tick({ b2, cook, done, fail, pupilY, blink }: { b2: string; cook: boolean; done: boolean; fail: boolean; pupilY: number; blink: string }) {
  const tail = cook ? `tbmSwing ${b2}s ease-in-out infinite` : done ? 'tbmSpin .5s linear 3' : 'none'
  return (
    <>
      <div style={at(77, 0, 6, 124, { transformOrigin: '50% 100%', transform: `rotate(${fail ? 28 : 0}deg)` })}>
        <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 100%', animation: tail }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: 3, background: '#000' }} />
          <span style={at(-10, 4, 26, 18, { borderRadius: 5, background: '#FF6500', border: line })} />
        </div>
      </div>
      <svg width="160" height="170" viewBox="0 0 160 170" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <polygon points="60,28 100,28 140,140 20,140" transform="translate(4 4)" fill="#000" />
        <polygon points="60,28 100,28 140,140 20,140" fill="#A78BFA" stroke="#000" strokeLinejoin="round" style={{ strokeWidth: 'var(--bw)' }} />
      </svg>
      <Eye x={54} y={64} d={22} pupil={7} px={5} py={pupilY} blink={blink} />
      <Eye x={84} y={64} d={22} pupil={7} px={5} py={pupilY} blink={blink} />
      <span style={at(65, 94, 30, 15, { borderRadius: '0 0 15px 15px', background: '#000', overflow: 'hidden', transform: `rotate(${fail ? 180 : 0}deg)` })}>
        <span style={{ position: 'absolute', left: 8, bottom: -4, width: 13, height: 10, borderRadius: 999, background: '#FF4D6D' }} />
      </span>
      <span style={at(10, 132, 140, 28, { borderRadius: 10, background: '#FACC15', border: line, boxShadow: 'var(--sh)' })} />
    </>
  )
}

// A vinyl record with horns and fangs. Spins while audio renders, skips when something fails.
function Spinz({ cook, done, fail, rm, blink }: { cook: boolean; done: boolean; fail: boolean; rm: boolean; blink: string }) {
  const pupilY = fail ? 9 : 4
  const disc = fail && !rm ? 'tbmSkip .6s steps(2) infinite' : 'none'
  const shine = cook ? 'tbmSpin 3.6s linear infinite' : done ? 'tbmSpin .45s linear 4' : 'none'
  return (
    <>
      <span style={at(30, 14, 26, 26, { borderRadius: 4, background: '#FACC15', border: line, transform: 'rotate(45deg)' })} />
      <span style={at(104, 14, 26, 26, { borderRadius: 4, background: '#FACC15', border: line, transform: 'rotate(45deg)' })} />
      <span style={at(46, 136, 'var(--bw2)', 16, { background: '#000' })} />
      <span style={at(110, 136, 'var(--bw2)', 16, { background: '#000' })} />
      <span style={at(28, 144, 34, 18, { borderRadius: '10px 10px 6px 6px', background: '#fff', border: line })} />
      <span style={at(98, 144, 34, 18, { borderRadius: '10px 10px 6px 6px', background: '#fff', border: line })} />
      <div style={at(14, 18, 132, 132, { borderRadius: 999, background: '#05080D', border: line, boxShadow: 'var(--sh)', overflow: 'hidden', animation: disc })}>
        <span style={{ position: 'absolute', inset: 6, borderRadius: 999, background: 'repeating-radial-gradient(circle,rgba(255,255,255,0) 0 3px,rgba(255,255,255,.1) 3px 4px)' }} />
        <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'conic-gradient(transparent 0 18%,rgba(255,255,255,.24) 24%,transparent 30% 68%,rgba(255,255,255,.16) 74%,transparent 80%)', animation: shine }} />
      </div>
      <div style={at(47, 51, 66, 66, { borderRadius: 999, background: '#FF6500', border: line })}>
        <Eye x={10} y={12} d={19} pupil={6} px={4} py={pupilY} blink={blink} />
        <Eye x={32} y={12} d={19} pupil={6} px={4} py={pupilY} blink={blink} />
        <span style={at(18, 39, 24, 'var(--bw)', { borderRadius: 2, background: '#000', transform: `rotate(${fail ? -8 : 0}deg)` })} />
        <span style={at(20, 41, 0, 0, { borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '9px solid #fff' })} />
        <span style={at(32, 41, 0, 0, { borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '9px solid #fff' })} />
        <span style={at(28, -1, 6, 6, { borderRadius: 999, background: '#0B192C' })} />
      </div>
    </>
  )
}
