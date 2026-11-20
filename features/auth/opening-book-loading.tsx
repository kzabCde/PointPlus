import Image from 'next/image'
import { PaperBook, PaperLeaf } from '@/components/motion/paper-book'
import { StampPress } from '@/components/motion/stamp-press'
import styles from './opening-book-loading.module.css'

export function OpeningBookLoading() {
  return <div className={styles.entry} role="status" aria-atomic="true" data-entry-loading>
    <div className={styles.scene} aria-hidden="true">
      <PaperBook open opening cover={<Image className={styles.mascot}
        src="/icons/icon-64x64.png" width={52} height={52} alt="" unoptimized/>}>
        <PaperLeaf><span className={styles.lines}/></PaperLeaf>
        <PaperLeaf>
          <span className={styles.press}>
            <StampPress pressed>
              <Image src="/point-plus/stamps/couple/heart.png" width={58} height={58} alt="" loading="eager"/>
            </StampPress>
          </span>
        </PaperLeaf>
      </PaperBook>
    </div>
    <p>กำลังเปิดสมุดของคุณ…</p>
  </div>
}
