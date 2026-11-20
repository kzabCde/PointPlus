'use client'

import Image from 'next/image'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { PaperBook, PaperLeaf } from '@/components/motion/paper-book'
import { HeartMascot } from './heart-mascot'
import { flowersStamp, heartStamp, letterStamp } from './illustrative-stamps'

const spreads = [
  { title: 'วันที่เราให้กำลังใจกัน', note: 'ขอบคุณที่คอยอยู่ข้าง ๆ', stamps: [heartStamp, flowersStamp] },
  { title: 'จดหมายถึงเธอ', note: 'อยากเก็บวันนี้ไว้อีกนาน ๆ', stamps: [letterStamp] },
]

export function InteractiveStampBook() {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [turn, setTurn] = useState<{ sequence: number; direction: 'forward' | 'backward' }>()
  const sequence = useRef(0)
  const pagesId = useId()
  const current = spreads[page]

  function goToPage(next: number) {
    if (!open || next < 0 || next >= spreads.length || next === page) return
    setTurn({ sequence: ++sequence.current, direction: next > page ? 'forward' : 'backward' })
    setPage(next)
  }

  function pageKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!open || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      goToPage(page + (event.key === 'ArrowRight' ? 1 : -1))
    }
  }

  return <figure className="living-book" data-open={open} data-living-reveal>
    <div className="living-book__table">
      <div className="living-book__scene">
        <PaperBook open={open} pagesId={pagesId} turn={turn} cover={
          <div className="living-book__cover-print">
            <HeartMascot/>
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
            {open && <ul className="living-book__slots" role="list" aria-label="ช่องแสตมป์ในหน้าตัวอย่าง">
              {Array.from({ length: 3 }, (_, index) => <li key={index}>
                {current.stamps[index]
                  ? <Image src={current.stamps[index]} width={72} height={72} sizes="(max-width: 500px) 52px, 72px" alt={'แสตมป์ดวงที่ ' + (index + 1)}/>
                  : <span className="sr-only">ช่องว่าง</span>}
              </li>)}
            </ul>}
          </PaperLeaf>
        </PaperBook>
      </div>
      <div className="living-book__controls" onKeyDown={pageKeys}>
        <button className="living-book__arrow" aria-label="หน้าก่อน" type="button"
          aria-disabled={page === 0} aria-controls={pagesId} onClick={() => goToPage(page - 1)}>←</button>
        <Button className="living-book__toggle" variant="secondary" aria-expanded={open} aria-controls={pagesId}
          onClick={() => { setTurn(undefined); setOpen(value => !value) }}>{open ? 'ปิดสมุด' : 'เปิดสมุดดู'}</Button>
        <button className="living-book__arrow" aria-label="หน้าถัดไป" type="button"
          aria-disabled={page === spreads.length - 1} aria-controls={pagesId} onClick={() => goToPage(page + 1)}>→</button>
      </div>
    </div>
    <figcaption>
      <span>สมุดตัวอย่าง</span>
      {open && <span role="status">หน้า {page + 1} / {spreads.length}</span>}
    </figcaption>
  </figure>
}
