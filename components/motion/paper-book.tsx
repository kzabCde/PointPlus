import type { ReactNode } from 'react'
import styles from './paper-book.module.css'

export function PaperBook({ open, cover, children, pagesId, className }: {
  open: boolean
  cover: ReactNode
  children: ReactNode
  pagesId?: string
  className?: string
}) {
  return <div className={styles.book + (className ? ' ' + className : '')} data-paper-book data-open={open}>
    <div className={styles.pages} id={pagesId} aria-hidden={!open}>
      {children}
    </div>
    <div className={styles.cover} data-book-cover aria-hidden={open}>
      {cover}
    </div>
  </div>
}

export function PaperLeaf({ children }: { children: ReactNode }) {
  return <div className={styles.leaf}>{children}</div>
}
