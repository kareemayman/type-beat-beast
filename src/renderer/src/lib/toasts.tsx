import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CircleAlert, Hand, Info, PartyPopper, X, type LucideIcon } from 'lucide-react'
import { useReducedMotion } from './environment'
import styles from './toasts.module.css'

export type ToastKind = 'done' | 'needs' | 'info' | 'failed'

interface Toast {
  id: string
  kind: ToastKind
  text: string
}

const LOOK: Record<ToastKind, { background: string; icon: LucideIcon }> = {
  done: { background: '#22C55E', icon: PartyPopper },
  needs: { background: '#38BDF8', icon: Hand },
  info: { background: '#FACC15', icon: Info },
  failed: { background: '#FF4D6D', icon: CircleAlert },
}

const ToastContext = createContext<(kind: ToastKind, text: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const reduceMotion = useReducedMotion()

  const dismiss = useCallback((id: string) => setToasts((all) => all.filter((t) => t.id !== id)), [])
  const toast = useCallback(
    (kind: ToastKind, text: string) => {
      const id = crypto.randomUUID()
      setToasts((all) => [...all.slice(-2), { id, kind, text }])
      setTimeout(() => dismiss(id), 4500)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={styles.stack} aria-live="polite">
        {toasts.map(({ id, kind, text }) => {
          const { background, icon: Icon } = LOOK[kind]
          const animation = reduceMotion ? 'tbcFade 150ms both' : 'tbcIn 220ms cubic-bezier(.34,1.56,.64,1) both'
          return (
            <div key={id} role="status" className={styles.toast} style={{ background, animation }}>
              <Icon size={20} strokeWidth={2.5} />
              <span className={styles.text}>{text}</span>
              <button className={styles.close} onClick={() => dismiss(id)} aria-label="Dismiss">
                <X size={16} strokeWidth={3} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
