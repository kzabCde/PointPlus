'use client'

import Image from 'next/image'
import { startTransition, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { pointPlusStamps } from '@/lib/point-plus/assets'
import { giveStampAction } from './actions'
import { useBookAction } from './motion'
import type { JournalMark } from './journal-model'
import type { BookRequest } from './data'
import { legacyPaperPosition, normalizedPaperPosition, deterministicRotation } from './paper-model'

type PaperProps = {
  spaceId: string
  bookId: string
  participantId: string
  styleIds: string[]
  marks: JournalMark[]
  pendingRequests: BookRequest[]
  page: number
  layoutMode: 'single_sheet' | 'notebook'
  canGive: boolean
  impactRequestId?: string
}

type PointerStart = { id: number; x: number; y: number }

export function StampPaper({
  spaceId, bookId, participantId, styleIds, marks, pendingRequests, page, layoutMode, canGive, impactRequestId,
}: PaperProps) {
  const router = useRouter()
  const [state, action, pending] = useBookAction(giveStampAction)
  const styles = pointPlusStamps.filter(stamp => styleIds.includes(stamp.id))
  const [selected, setSelected] = useState<string | null>(null)
  const artId = selected && styles.some(stamp => stamp.id === selected) ? selected : styles[0]?.id
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null)
  const [placed, setPlaced] = useState<{ x: number; y: number; art: string } | null>(null)
  const start = useRef<PointerStart | null>(null)
  const inFlight = useRef(false)
  const visibleMarks = marks.map((mark, index) => {
    const fallback = legacyPaperPosition(index)
    return {
      mark,
      pageIndex: layoutMode === 'single_sheet' ? 0 : mark.page_index ?? fallback.pageIndex,
      x: mark.position_x ?? fallback.x,
      y: mark.position_y ?? fallback.y,
      rotation: mark.rotation_deg ?? fallback.rotation,
    }
  }).filter(item => item.pageIndex === page)

  const visiblePending = pendingRequests.filter(request => request.page_index === page &&
    request.position_x !== null && request.position_y !== null)

  useEffect(() => {
    inFlight.current = false
    if (state.status === 'success') {
      setPlaced(null)
      router.refresh()
    }
    if (state.status === 'error') setPlaced(null)
  }, [state, router])

  function place(x: number, y: number) {
    if (!canGive || !artId || pending || inFlight.current) return
    inFlight.current = true
    const safeX = Math.max(0.10, Math.min(0.90, x))
    const safeY = Math.max(0.10, Math.min(0.90, y))
    const rotation = deterministicRotation(safeX, safeY)
    const form = new FormData()
    form.set('space_id', spaceId)
    form.set('book_id', bookId)
    form.set('recipient_id', participantId)
    form.set('asset_id', artId)
    form.set('note', '')
    form.set('idempotency_key', crypto.randomUUID())
    form.set('page_index', String(page))
    form.set('position_x', String(safeX))
    form.set('position_y', String(safeY))
    form.set('rotation_deg', String(rotation))
    setPlaced({ x: safeX, y: safeY, art: artId })
    setPreview(null)
    startTransition(() => action(form))
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!canGive || !artId || pending || !event.isPrimary) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    start.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const press = start.current
    start.current = null
    if (!press || press.id !== event.pointerId) return
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) return
    const rect = event.currentTarget.getBoundingClientRect()
    const position = normalizedPaperPosition(event.clientX, event.clientY, rect)
    if (position) place(position.x, position.y)
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!canGive || !artId || event.pointerType !== 'mouse' || pending) return
    const rect = event.currentTarget.getBoundingClientRect()
    const position = normalizedPaperPosition(event.clientX, event.clientY, rect)
    if (position) setPreview(position)
  }

  function onKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!canGive || pending || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      place(preview?.x ?? .5, preview?.y ?? .5)
    }
  }

  return <div className="paper-stamp-root">
    <div className="paper-stamp-surface" role={canGive ? 'button' : undefined}
      tabIndex={canGive ? 0 : undefined}
      aria-label={canGive ? 'หน้ากระดาษสำหรับแปะแสตมป์ คลิก แตะ หรือกด Enter เพื่อแปะ' : 'หน้ากระดาษสะสมแสตมป์'}
      aria-disabled={canGive ? pending : undefined}
      data-placeable={canGive && !pending && !!artId}
      onPointerDown={pointerDown} onPointerUp={pointerUp}
      onPointerCancel={() => { start.current = null }}
      onPointerMove={pointerMove} onPointerLeave={() => setPreview(null)}
      onKeyDown={onKeys}>
      <span className="paper-stamp-ruled" aria-hidden="true"/>
      {visibleMarks.map(({ mark, x, y, rotation }) => {
        const art = pointPlusStamps.find(stamp => stamp.id === mark.asset_id)
        return <span key={mark.id} className="paper-stamp-mark"
          data-impact={impactRequestId === mark.request_id || undefined}
          style={{ left: (x * 100) + '%', top: (y * 100) + '%', transform: 'translate(-50%, -50%) rotate(' + rotation + 'deg)' }}
          aria-label={(art?.nameTh ?? 'แสตมป์') + ' จาก ' + mark.giver}>
          {art && <Image src={art.png} width={92} height={92} alt="" draggable={false}/>}
        </span>
      })}
      {visiblePending.map(request => {
        const art = pointPlusStamps.find(stamp => stamp.id === request.asset_id)
        return <span key={'request-' + request.id}
          className="paper-stamp-mark paper-stamp-mark--waiting" aria-label="แสตมป์รออนุมัติ"
          style={{ left: (Number(request.position_x) * 100) + '%',
            top: (Number(request.position_y) * 100) + '%',
            transform: 'translate(-50%, -50%) rotate(' + (request.rotation_deg ?? 0) + 'deg)' }}>
          {art && <Image src={art.png} width={92} height={92} alt=""/>}
        </span>
      })}
      {placed && !visibleMarks.some(item => item.mark.request_id === impactRequestId) &&
        <span className="paper-stamp-mark paper-stamp-mark--pending" aria-hidden="true"
          style={{ left: (placed.x * 100) + '%', top: (placed.y * 100) + '%' }}>
          <Image src={pointPlusStamps.find(stamp => stamp.id === placed.art)?.png ?? '/point-plus/stamps/couple/heart.png'}
            width={92} height={92} alt=""/>
        </span>}
      {preview && canGive && artId && !pending && !placed && <span className="paper-stamp-mark paper-stamp-mark--preview" aria-hidden="true"
        style={{ left: (preview.x * 100) + '%', top: (preview.y * 100) + '%' }}>
        <Image src={pointPlusStamps.find(stamp => stamp.id === artId)?.png ?? '/point-plus/stamps/couple/heart.png'}
          width={92} height={92} alt=""/>
      </span>}
    </div>
    {canGive && styles.length > 0 && <div className="paper-stamp-tools">
      <div className="paper-stamp-art-picker" role="group" aria-label="เลือกลายแสตมป์">
        {styles.map(stamp => <button type="button" key={stamp.id}
          className="paper-stamp-art-button" data-selected={artId === stamp.id}
          aria-label={stamp.nameTh} aria-pressed={artId === stamp.id}
          disabled={pending} onClick={() => setSelected(stamp.id)}>
          <Image src={stamp.png} width={44} height={44} alt="" />
        </button>)}
      </div>
      <p className="paper-stamp-hint">เลือกดวงแสตมป์ แล้วแตะตำแหน่งบนกระดาษ</p>
    </div>}
    {state.status === 'error' && <p role="alert" className="status status--error">{state.message}</p>}
    {state.status === 'success' && state.outcome === 'pending' &&
      <p role="status" className="status status--warning">รอการอนุมัติแสตมป์</p>}
  </div>
}
