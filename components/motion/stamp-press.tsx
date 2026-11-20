import type { ReactNode } from 'react'
import styles from './stamp-press.module.css'

export function StampPress({ pressed, children }: { pressed: boolean; children: ReactNode }) {
  return <span className={styles.press} data-stamp-press data-pressed={pressed} aria-hidden="true">
    {pressed && <>
      <span className={styles.impression}>{children}</span>
      <span className={styles.contact}/>
      <span className={styles.die}><span/></span>
    </>}
  </span>
}
