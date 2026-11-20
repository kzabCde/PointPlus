import type { ReactNode } from 'react'
import styles from './paper-book.module.css'

type LeafTurn = { sequence: number; direction: 'forward' | 'backward' }

export function PaperBook({ open, cover, children, pagesId, className, turn }: {
  open: boolean
  cover: ReactNode
  children: ReactNode
  pagesId?: string
  className?: string
  turn?: LeafTurn
}) {
  return <div className={styles.book + (className ? ' ' + className : '')} data-paper-book data-open={open}>
    <div className={styles.pages} id={pagesId} aria-hidden={!open}>
      {children}
    </div>
    {open && turn && <span key={turn.sequence} className={styles.turn} data-leaf-turn={turn.direction} aria-hidden="true"/>}
    <div className={styles.cover} data-book-cover aria-hidden={open}>
      {cover}
    </div>
  </div>
}

export function PaperLeaf({ children }: { children: ReactNode }) {
  return <div className={styles.leaf}>{children}</div>
}
