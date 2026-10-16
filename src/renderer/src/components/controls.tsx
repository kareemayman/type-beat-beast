import { Check, X } from 'lucide-react'
import styles from './controls.module.css'

export function Switch({ checked, onChange, label }: { checked: boolean; onChange(checked: boolean): void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} className={styles.switch} data-on={checked} onClick={() => onChange(!checked)}>
      <span className={styles.knob}>{checked ? <Check size={11} strokeWidth={3.5} /> : <X size={11} strokeWidth={3.5} />}</span>
    </button>
  )
}

interface SegmentedProps<T extends string> {
  value: T
  options: [T, string][]
  onChange(value: T): void
  label: string
}

export function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.segmented}>
      {options.map(([option, text]) => (
        <button key={option} role="radio" aria-checked={option === value} className={styles.segment} data-on={option === value} onClick={() => onChange(option)}>
          {text}
        </button>
      ))}
    </div>
  )
}
