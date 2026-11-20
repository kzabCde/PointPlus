'use client'

import Image from 'next/image'
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { pointPlusStamps } from '@/lib/point-plus/assets'
import { locateActivity, pageCount, stampPage, type BookActivity, type JournalCycle, type JournalMark } from './journal-model'
import { useBookMotion } from './motion'
import { BookProgress } from './presentation'

const claimLabels = { requested: 'รอส่งมอบ', fulfilled: 'ส่งมอบแล้ว', canceled: 'ยกเลิก' }
const stampArt = new Map(pointPlusStamps.map(stamp => [stamp.id, stamp]))

type Direction = 'forward' | 'backward' | 'opening'
type View = {
  cycleId: string
  page: number
  turn?: { step: number; direction: Direction }
  activity?: BookActivity
  completedByStamp?: boolean
}

function StampNotes({ marks }: { marks: JournalMark[] }) {
  if (marks.length === 0) return <p className="muted">หน้านี้ยังไม่มีบันทึก</p>

  return <ul className="journal-notes" role="list" aria-label="รายละเอียดแสตมป์" tabIndex={0}>
    {marks.map(mark => {
      const art = stampArt.get(mark.asset_id)
      return <li key={mark.id}>
        {art && <Image src={art.png} width={32} height={32} alt=""/>}
        <div>
          <strong>{art?.nameTh ?? 'แสตมป์'}</strong>
          <small>จาก {mark.giver} · <time dateTime={mark.stamped_at}>{mark.date}</time></small>
          {mark.note && <p>{mark.note}</p>}
        </div>
      </li>
    })}
  </ul>
}

export function StampBookJournal({ label, status, cycles, initialCycleId, openOnMount, rewardContent }: {
  label: string
  status: string
  cycles: JournalCycle[]
  initialCycleId: string
  openOnMount: boolean
  rewardContent: Record<string, ReactNode>
}) {
  const motion = useBookMotion()
  const [view, setView] = useState<View>({
    cycleId: initialCycleId, page: 0, turn: openOnMount ? { step: 0, direction: 'opening' } : undefined,
  })
  const journalId = useId()
  const turn = useRef(0)
  const slotRef = useRef<HTMLLIElement>(null)
  const rewardRef = useRef<HTMLParagraphElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const touch = useRef<{ id: number; x: number; y: number } | null>(null)

  const cycle = cycles.find(item => item.id === view.cycleId) ?? cycles[0]
  const total = pageCount(cycle.target_snapshot)
  const page = Math.min(view.page, total - 1)
  const slots = stampPage(cycle.target_snapshot, page)
  const marks = slots.flatMap(index => cycle.marks[index] ? [cycle.marks[index]] : [])
  const placed = view.activity?.kind === 'stamp' ? view.activity.id : undefined
  const activityKind = view.activity?.kind
  const reveal = activityKind === cycle.claim?.status ? activityKind : undefined

  useLayoutEffect(() => {
    if (!motion) return
    for (const receipt of motion.receipts) {
      const destination = locateActivity(cycles, receipt)
      if (!destination || !motion.take(receipt)) continue
      setView(previous => ({
        cycleId: destination.cycleId,
        page: destination.page ?? (previous.cycleId === destination.cycleId ? previous.page : 0),
        activity: receipt,
        completedByStamp: destination.completedByStamp,
      }))
    }
  }, [cycles, motion])

  useLayoutEffect(() => {
    if (!view.activity) return
    const frame = requestAnimationFrame(() => {
      if (placed) {
        if (document.activeElement === document.body) heading.current?.focus({ preventScroll: true })
        slotRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
      } else if (reveal && document.activeElement === document.body) {
        rewardRef.current?.focus()
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [view.activity, placed, reveal])

  function goToPage(next: number) {
    if (next < 0 || next >= total || next === page) return
    setView({
      cycleId: cycle.id, page: next,
      turn: { step: ++turn.current, direction: next > page ? 'forward' : 'backward' },
    })
  }

  function changeCycle(next: string) {
    const currentIndex = cycles.findIndex(item => item.id === cycle.id)
    const nextIndex = cycles.findIndex(item => item.id === next)
    if (currentIndex === nextIndex || nextIndex < 0) return
    setView({
      cycleId: next, page: 0,
      turn: { step: ++turn.current, direction: nextIndex > currentIndex ? 'forward' : 'backward' },
    })
  }

  function handlePageKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const targets: Record<string, number> = { ArrowLeft: page - 1, ArrowRight: page + 1, Home: 0, End: total - 1 }
    if (!Object.hasOwn(targets, event.key)) return
    event.preventDefault()
    goToPage(targets[event.key])
  }

  function startSwipe(event: PointerEvent<HTMLOListElement>) {
    if (!event.isPrimary || event.pointerType === 'mouse') return
    touch.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }

  function finishSwipe(event: PointerEvent<HTMLOListElement>) {
    const start = touch.current
    if (!start || start.id !== event.pointerId) return
    touch.current = null
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      goToPage(page + (dx < 0 ? 1 : -1))
    }
  }

  return <article className="stamp-journal" aria-labelledby={journalId + '-heading'}>
    <header className="journal-heading">
      <div>
        <h3 id={journalId + '-heading'} ref={heading} tabIndex={-1}>{label}</h3>
        <div className="journal-cycle-state">
          <span>รอบที่ {cycle.cycle_no}</span>
          <span className="journal-cycle-state__label">{cycle.completed_at ? 'สะสมครบ' : status}</span>
        </div>
      </div>
      {cycles.length > 1 && <div className="form-field journal-cycle-picker">
        <label className="form-field__label" htmlFor={journalId + '-cycle'}>รอบสะสม</label>
        <select className="input" id={journalId + '-cycle'} value={cycle.id} onChange={event => changeCycle(event.target.value)}>
          {cycles.map(item => <option key={item.id} value={item.id}>
            รอบที่ {item.cycle_no}{item.completed_at ? ' · สะสมครบ' : ''}
          </option>)}
        </select>
      </div>}
      <BookProgress key={cycle.id} label={label} cycle={cycle} showLabel={false}/>
    </header>

    <nav className="journal-pagination" aria-label={'หน้าสมุดของ ' + label} onKeyDown={handlePageKeys}>
      {total > 1 && <button className="button button--secondary journal-page-button" type="button"
        aria-label="หน้าก่อน" aria-disabled={page === 0} aria-controls={journalId + '-spread'}
        onClick={() => goToPage(page - 1)}><span aria-hidden="true">←</span></button>}
      <span className="journal-pagination__position" role="status">หน้า {page + 1} / {total}</span>
      {total > 1 && <button className="button button--secondary journal-page-button" type="button"
        aria-label="หน้าถัดไป" aria-disabled={page === total - 1} aria-controls={journalId + '-spread'}
        onClick={() => goToPage(page + 1)}><span aria-hidden="true">→</span></button>}
    </nav>

    <div className="journal-spread" id={journalId + '-spread'}>
      <section className="journal-leaf journal-leaf--slots" aria-label={'แสตมป์ หน้า ' + (page + 1)}>
        <ol className="journal-slots" role="list" start={slots[0] + 1} onPointerDown={startSwipe} onPointerUp={finishSwipe}
          onPointerCancel={() => { touch.current = null }}>
          {slots.map(index => {
            const mark = cycle.marks[index]
            const art = mark ? stampArt.get(mark.asset_id) : undefined
            const earned = !!mark || index < cycle.progress_count
            const impact = !!placed && mark?.request_id === placed

            return <li className="journal-slot" data-earned={earned} data-impact={impact || undefined}
              key={cycle.id + ':' + index} ref={impact ? slotRef : undefined}>
              <span className="journal-slot__well">
                {art
                  ? <Image className="journal-slot__art" src={art.png} alt="" width={88} height={88}
                    loading={impact ? 'eager' : 'lazy'}/>
                  : <span className="journal-slot__symbol" aria-hidden="true">{earned ? '✓' : '+'}</span>}
              </span>
              <span className="journal-slot__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="sr-only">ช่อง {index + 1} · {art?.nameTh ?? (earned ? 'ได้รับแล้ว' : 'ยังว่าง')}</span>
            </li>
          })}
        </ol>
      </section>
      <section className="journal-leaf journal-leaf--notes" aria-labelledby={journalId + '-notes'}>
        <h4 id={journalId + '-notes'}>บันทึกหน้านี้</h4>
        <StampNotes marks={marks}/>
      </section>
      {view.turn && <span key={view.turn.step} className="journal-turn-leaf" data-turn={view.turn.direction} aria-hidden="true"/>}
    </div>

    {cycle.completed_at && <section className="journal-reward" aria-labelledby={journalId + '-reward'}>
      <header className="journal-reward__heading">
        <div>
          <h4 id={journalId + '-reward'}>สะสมครบแล้ว</h4>
          {cycle.completedDate && <time dateTime={cycle.completed_at}>{cycle.completedDate}</time>}
        </div>
        <span className="journal-reward__seal" data-celebrate={view.completedByStamp || undefined} aria-hidden="true">✓</span>
      </header>
      {cycle.claim && <div className="journal-reward__receipt" data-status={cycle.claim.status}>
        <span key={reveal ?? 'stored'} className="journal-reward__gift" data-reveal={reveal} aria-hidden="true"><span/></span>
        <p role="status" tabIndex={-1} ref={rewardRef}><strong>รางวัล: {cycle.claim.reward_title_snapshot}</strong> · {claimLabels[cycle.claim.status]}</p>
      </div>}
      {rewardContent[cycle.id]}
    </section>}
  </article>
}
