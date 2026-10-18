import { useEffect, useRef, useState, type ReactNode } from 'react'

interface ConfirmButtonProps {
  className?: string
  children: ReactNode // the normal label
  confirmLabel: ReactNode // shown after the first click
  onConfirm(): void
}

// A button that needs two clicks, for actions that throw work away (like stopping a run). The first click
// arms it and swaps the label; a second click within 3 seconds acts. Style the armed look with [data-armed='true'].
export default function ConfirmButton({ className, children, confirmLabel, onConfirm }: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  function onClick() {
    clearTimeout(timer.current)
    if (armed) {
      setArmed(false)
      onConfirm()
      return
    }
    setArmed(true)
    timer.current = setTimeout(() => setArmed(false), 3000)
  }

  return (
    <button className={className} data-armed={armed} onClick={onClick}>
      {armed ? confirmLabel : children}
    </button>
  )
}
