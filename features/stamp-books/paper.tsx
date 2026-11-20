'use client'

import Image from 'next/image'
import { startTransition, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { pointPlusStamps } from '@/lib/point-plus/assets'
import { giveStampAction } from './actions'
import { useBookAction } from './motion'
import { useBookSound } from './sound'
import type { JournalMark } from './journal-model'
import type { BookRequest } from './data'
import {
  clampStampScale, legacyPaperPosition, normalizeStampRotation, normalizedPaperPosition, stampGestureTransform,
} from './paper-model'

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
type TouchPoint = { x: number; y: number; originX: number; originY: number }
type DraftStamp = { x: number; y: number; art: string; rotation: number; scale: number }

const positioned = (x: number, y: number, angle: number, scale: number) => ({
  left: x * 100 + '%',
  top: y * 100 + '%',
  transform: 'translate(-50%, -50%) rotate(' + angle + 'deg) scale(' + scale + ')',
})

function geometry(points: TouchPoint[]) {
  const [first, second] = points
  return {
    distance: Math.hypot(second.x - first.x, second.y - first.y),
    angle: Math.atan2(second.y - first.y, second.x - first.x),
    midX: (first.x + second.x) / 2,
    midY: (first.y + second.y) / 2,
  }
}

export function StampPaper({
  spaceId, bookId, participantId, styleIds, marks, pendingRequests, page, layoutMode, canGive, impactRequestId,
}: PaperProps) {
  const router = useRouter()
  const sound = useBookSound()
  const [state, action, pending] = useBookAction(giveStampAction)
  const styles = pointPlusStamps.filter(stamp => styleIds.includes(stamp.id))
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [rotation, setRotation] = useState(0)
  const [scale, setScale] = useState(1)
  const angleRef = useRef(0)
  const scaleRef = useRef(1)
  const artId = selected && styles.some(stamp => stamp.id === selected) ? selected : styles[0]?.id
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null)
  const [placed, setPlaced] = useState<DraftStamp | null>(null)
  const fingers = useRef(new Map<number, TouchPoint>())
  const multiTouch = useRef(false)
  const gesture = useRef<{ distance: number; angle: number; scale: number; rotation: number } | null>(null)
  const inFlight = useRef(false)
  const playedReceipt = useRef<string | null>(null)
  const playSound = sound?.play
  const unlockSound = sound?.unlock

  const visibleMarks = marks.map((mark, index) => {
    const fallback = legacyPaperPosition(index)
    return {
      mark,
      pageIndex: layoutMode === 'single_sheet' ? 0 : mark.page_index ?? fallback.pageIndex,
      x: Number(mark.position_x ?? fallback.x),
      y: Number(mark.position_y ?? fallback.y),
      rotation: Number(mark.rotation_deg ?? fallback.rotation),
      scale: Number(mark.scale_factor ?? 1),
    }
  }).filter(item => item.pageIndex === page)

  const visiblePending = pendingRequests.filter(request =>
    (layoutMode === 'single_sheet' ? 0 : request.page_index) === page &&
    request.position_x !== null && request.position_y !== null)

  useEffect(() => {
    inFlight.current = false
    if (state.status === 'success') {
      if (state.outcome === 'granted' && state.receipt && playedReceipt.current !== state.receipt.id) {
        playedReceipt.current = state.receipt.id
        playSound?.('stamp')
      }
      setPlaced(null)
      setNote('')
      router.refresh()
    }
    if (state.status === 'error') setPlaced(null)
  }, [state, router, playSound])

  function changeRotation(degrees: number) {
    angleRef.current = normalizeStampRotation(degrees)
    setRotation(angleRef.current)
  }
  function changeScale(value: number) {
    scaleRef.current = clampStampScale(value)
    setScale(scaleRef.current)
  }

  function place(x: number, y: number) {
    if (!canGive || !artId || pending || inFlight.current) return
    inFlight.current = true
    // Normalized centers are not offset from edges: users can deliberately overlap the sheet border.
    const safeX = Math.max(0, Math.min(1, x))
    const safeY = Math.max(0, Math.min(1, y))
    const snapshot: DraftStamp = {
      x: safeX, y: safeY, art: artId, rotation: angleRef.current, scale: scaleRef.current,
    }
    const form = new FormData()
    form.set('space_id', spaceId)
    form.set('book_id', bookId)
    form.set('recipient_id', participantId)
    form.set('asset_id', artId)
    form.set('note', note.trim())
    form.set('idempotency_key', crypto.randomUUID())
    form.set('page_index', String(page))
    form.set('position_x', String(snapshot.x))
    form.set('position_y', String(snapshot.y))
    form.set('rotation_deg', String(snapshot.rotation))
    form.set('scale_factor', String(snapshot.scale))
    setPlaced(snapshot)
    setPreview(null)
    startTransition(() => action(form))
  }

  function updatePreview(event: PointerEvent<HTMLDivElement>, x = event.clientX, y = event.clientY) {
    const position = normalizedPaperPosition(x, y, event.currentTarget.getBoundingClientRect())
    if (position) setPreview(position)
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!canGive || !artId || pending || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.stopPropagation() // A two-finger transform must never turn the book page.
    unlockSound?.()
    fingers.current.set(event.pointerId, {
      x: event.clientX, y: event.clientY, originX: event.clientX, originY: event.clientY,
    })
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* harmless */ }
    if (fingers.current.size >= 2) {
      multiTouch.current = true
      const g = geometry([...fingers.current.values()].slice(0, 2))
      gesture.current = { distance: g.distance, angle: g.angle, scale: scaleRef.current, rotation: angleRef.current }
      updatePreview(event, g.midX, g.midY)
    } else updatePreview(event)
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!canGive || !artId || pending) return
    const point = fingers.current.get(event.pointerId)
    if (point) {
      point.x = event.clientX
      point.y = event.clientY
      if (fingers.current.size >= 2 && gesture.current) {
        event.stopPropagation()
        const g = geometry([...fingers.current.values()].slice(0, 2))
        const transform = stampGestureTransform(gesture.current, g)
        changeScale(transform.scale)
        changeRotation(transform.rotation)
        updatePreview(event, g.midX, g.midY)
        return
      }
      updatePreview(event)
    } else if (event.pointerType === 'mouse') updatePreview(event)
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!canGive || !artId) return
    event.stopPropagation()
    const point = fingers.current.get(event.pointerId)
    const wasMultiTouch = multiTouch.current
    fingers.current.delete(event.pointerId)
    if (fingers.current.size === 0) {
      gesture.current = null
      multiTouch.current = false
    }
    if (!point || wasMultiTouch) return
    const moved = Math.hypot(event.clientX - point.originX, event.clientY - point.originY)
    if (moved > 12) return
    const position = normalizedPaperPosition(event.clientX, event.clientY,
      event.currentTarget.getBoundingClientRect())
    if (position) place(position.x, position.y)
  }

  function cancelPointer(event: PointerEvent<HTMLDivElement>) {
    if (canGive) event.stopPropagation()
    fingers.current.delete(event.pointerId)
    if (!fingers.current.size) {
      multiTouch.current = false
      gesture.current = null
    }
  }

  function onKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!canGive || pending || event.altKey || event.ctrlKey || event.metaKey) return
    const offset: Record<string, [number, number]> = {
      ArrowLeft: [-.025, 0], ArrowRight: [.025, 0], ArrowUp: [0, -.025], ArrowDown: [0, .025],
    }
    if (Object.hasOwn(offset, event.key)) {
      event.preventDefault()
      const [dx, dy] = offset[event.key]
      setPreview(previous => ({
        x: Math.max(0, Math.min(1, (previous?.x ?? .5) + dx)),
        y: Math.max(0, Math.min(1, (previous?.y ?? .5) + dy)),
      }))
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      unlockSound?.()
      place(preview?.x ?? .5, preview?.y ?? .5)
    }
  }

  return <div className="paper-stamp-root">
    <div className="paper-stamp-surface" role={canGive ? 'button' : undefined}
      tabIndex={canGive ? 0 : undefined}
      aria-label={canGive ? 'กระดาษแสตมป์: แตะหรือคลิกเพื่อแปะ กดปุ่มลูกศรเพื่อขยับตำแหน่ง แล้ว Enter เพื่อแปะ' : 'หน้ากระดาษสะสมแสตมป์'}
      aria-disabled={canGive ? pending : undefined}
      data-placeable={canGive && !pending && !!artId}
      onPointerDown={pointerDown} onPointerUp={pointerUp}
      onPointerMove={pointerMove} onPointerCancel={cancelPointer}
      onPointerLeave={event => { if (event.pointerType === 'mouse' && !fingers.current.size) setPreview(null) }}
      onKeyDown={onKeys}>
      <span className="paper-stamp-ruled" aria-hidden="true"/>
      {visibleMarks.map(({ mark, x, y, rotation: angle, scale: size }) => {
        const art = pointPlusStamps.find(stamp => stamp.id === mark.asset_id)
        return <span key={mark.id} className="paper-stamp-mark"
          data-impact={impactRequestId === mark.request_id || undefined}
          style={positioned(x, y, angle, size)}
          aria-label={(art?.nameTh ?? 'แสตมป์') + ' จาก ' + mark.giver}>
          {art && <Image src={art.png} width={92} height={92} alt="" draggable={false}/>}
        </span>
      })}
      {visiblePending.map(request => {
        const art = pointPlusStamps.find(stamp => stamp.id === request.asset_id)
        return <span key={'request-' + request.id} className="paper-stamp-mark paper-stamp-mark--waiting"
          aria-label="แสตมป์รออนุมัติ"
          style={positioned(Number(request.position_x), Number(request.position_y),
            Number(request.rotation_deg ?? 0), Number(request.scale_factor ?? 1))}>
          {art && <Image src={art.png} width={92} height={92} alt=""/>}
        </span>
      })}
      {placed && <span className="paper-stamp-mark paper-stamp-mark--pending" aria-hidden="true"
        style={positioned(placed.x, placed.y, placed.rotation, placed.scale)}>
        <Image src={pointPlusStamps.find(stamp => stamp.id === placed.art)?.png ??
          '/point-plus/stamps/couple/heart.png'} width={92} height={92} alt=""/>
      </span>}
      {preview && canGive && artId && !pending && !placed &&
        <span className="paper-stamp-mark paper-stamp-mark--preview" aria-hidden="true"
          style={positioned(preview.x, preview.y, rotation, scale)}>
          <Image src={pointPlusStamps.find(stamp => stamp.id === artId)?.png ??
            '/point-plus/stamps/couple/heart.png'} width={92} height={92} alt=""/>
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

      <div className="paper-stamp-transforms" role="group" aria-label="ปรับขนาดและหมุนแสตมป์ก่อนประทับ">
        <label className="paper-stamp-transform-label">ขนาด <strong>{Math.round(scale * 100)}%</strong>
          <input type="range" min="40" max="250" step="5" value={Math.round(scale * 100)}
            aria-label="ขนาดแสตมป์ 40 ถึง 250 เปอร์เซ็นต์" disabled={pending}
            onChange={event => changeScale(Number(event.target.value) / 100)}/>
        </label>
        <label className="paper-stamp-transform-label">หมุน <strong>{rotation}°</strong>
          <input type="range" min="-180" max="180" step="1" value={rotation}
            aria-label="หมุนแสตมป์อย่างอิสระ 360 องศา" disabled={pending}
            onChange={event => changeRotation(Number(event.target.value))}/>
        </label>
        <div className="paper-stamp-rotation-shortcuts">
          <button type="button" className="button button--secondary" disabled={pending}
            aria-label="หมุนทวนเข็มนาฬิกา 15 องศา" onClick={() => changeRotation(angleRef.current - 15)}>↶ 15°</button>
          <button type="button" className="button button--secondary" disabled={pending}
            aria-label="หมุนตามเข็มนาฬิกา 15 องศา" onClick={() => changeRotation(angleRef.current + 15)}>15° ↷</button>
          <button type="button" className="button button--secondary" disabled={pending}
            onClick={() => { changeRotation(0); changeScale(1) }}>รีเซ็ต</button>
        </div>
      </div>

      <p className="paper-stamp-hint">เลือกแสตมป์ ปรับขนาดและหมุน แล้วแตะตำแหน่งใดก็ได้บนกระดาษ บนมือถือใช้นิ้วสองนิ้วบีบหรือบิดเพื่อปรับได้</p>
      <details className="paper-stamp-note">
        <summary>เพิ่มข้อความสั้น ๆ (ไม่บังคับ)</summary>
        <textarea className="input" aria-label="ข้อความแนบแสตมป์"
          maxLength={1000} rows={2} disabled={pending} value={note}
          onChange={event => setNote(event.target.value)}/>
      </details>
    </div>}
    {state.status === 'error' && <p role="alert" className="status status--error">{state.message}</p>}
    {state.status === 'success' && state.outcome === 'pending' &&
      <p role="status" className="status status--warning">รอการอนุมัติแสตมป์</p>}
  </div>
}
