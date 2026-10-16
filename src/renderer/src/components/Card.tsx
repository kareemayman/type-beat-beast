import type { HTMLAttributes, ReactNode } from 'react'
import styles from './Card.module.css'

interface CardProps extends HTMLAttributes<HTMLElement> {
  sticker?: ReactNode // the tilted label stuck on the card's top edge
  stickerColor?: string
  stickerTilt?: string
}

// A "sticker card": thick outline, hard shadow, uneven corners, and an optional label stuck on top.
export default function Card({ sticker, stickerColor = 'var(--yellow)', stickerTilt = 'var(--tilt-1)', className, children, ...rest }: CardProps) {
  return (
    <section className={`${styles.card} ${className ?? ''}`} {...rest}>
      {sticker && (
        <span className={styles.sticker} style={{ background: stickerColor, transform: `rotate(${stickerTilt})` }}>
          {sticker}
        </span>
      )}
      {children}
    </section>
  )
}
