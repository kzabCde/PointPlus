'use client'

import Image from 'next/image'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PaperBook, PaperLeaf } from '@/components/motion/paper-book'
import { flowersStamp, heartStamp, letterStamp } from './illustrative-stamps'

const spreads = [
  { title: 'วันที่เราให้กำลังใจกัน', note: 'ขอบคุณที่คอยอยู่ข้าง ๆ', stamps: [heartStamp, flowersStamp] },
  { title: 'จดหมายถึงเธอ', note: 'อยากเก็บวันนี้ไว้อีกนาน ๆ', stamps: [letterStamp] },
]

export function InteractiveStampBook() {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const pagesId = useId()
  const current = spreads[page]

  return <figure className="living-book" data-open={open}>
    <div className="living-book__table">
      <div className="living-book__scene">
        <PaperBook open={open} pagesId={pagesId} cover={
          <div className="living-book__cover-print">
            <Image src="/icons/icon-192x192.png" width={100} height={100} alt="" loading="eager"/>
            <span>สมุดของเรา</span>
          </div>
        }>
          <PaperLeaf>
            {open && <div className="living-book__entry">
              <strong>{current.title}</strong>
              <p>{current.note}</p>
              <span>ถึง เตย</span>
            </div>}
          </PaperLeaf>
          <PaperLeaf>
            {open && <ul className="living-book__slots" aria-label="ช่องแสตมป์ในหน้าตัวอย่าง">
              {Array.from({ length: 3 }, (_, index) => <li key={index}>
                {current.stamps[index]
                  ? <Image src={current.stamps[index]} width={72} height={72} alt={'แสตมป์ดวงที่ ' + (index + 1)}/>
                  : <span className="sr-only">ช่องว่าง</span>}
              </li>)}
            </ul>}
          </PaperLeaf>
        </PaperBook>
      </div>
      <div className="living-book__controls">
        <button className="living-book__arrow" aria-label="หน้าก่อน" type="button"
          disabled={page === 0} onClick={() => setPage(value => value - 1)}>←</button>
        <Button className="living-book__toggle" variant="secondary" aria-expanded={open} aria-controls={pagesId}
          onClick={() => setOpen(value => !value)}>{open ? 'ปิดสมุด' : 'เปิดสมุดดู'}</Button>
        <button className="living-book__arrow" aria-label="หน้าถัดไป" type="button"
          disabled={page === spreads.length - 1} onClick={() => setPage(value => value + 1)}>→</button>
      </div>
    </div>
    <figcaption>
      <span>สมุดตัวอย่าง</span>
      {open && <span role="status">หน้า {page + 1} / {spreads.length}</span>}
    </figcaption>
  </figure>
}
