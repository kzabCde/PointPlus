'use client'

import Image from 'next/image'
import { startTransition, useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { pointPlusStamps } from '@/lib/point-plus/assets'
import { giveStampAction } from './actions'
import { cardMarkSlots } from './card-model'
import { useBookAction } from './motion'
import { useBookSound } from './sound'
import type { BookRequest } from './data'
import type { JournalCycle } from './journal-model'

const artwork = new Map(pointPlusStamps.map(stamp => [stamp.id, stamp]))

/**
 * A card has fixed numbered slots. The giver clicks the actual empty slot to
 * choose its stamp. Database approval, progress, claims and history remain the
 * original Point+ stamp ledger, not a separate client-side counter.
 */
export function StampCollectionCard({
  cycle, pendingRequests, impactRequestId, spaceId, bookId, participantId, styleIds, canGive,
}: {
  cycle: JournalCycle
  pendingRequests: BookRequest[]
  impactRequestId?: string
  spaceId: string
  bookId: string
  participantId: string
  styleIds: string[]
  canGive: boolean
}) {
  const router = useRouter()
  const sound = useBookSound()
  const [state, action, pending] = useBookAction(giveStampAction)
  const dialog = useRef<HTMLDialogElement>(null)
  const key = useRef<string | null>(null)
  const inFlight = useRef(false)
  const lastSound = useRef<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [selectedArt, setSelectedArt] = useState('')
  const [note, setNote] = useState('')

  const styles = pointPlusStamps.filter(stamp => styleIds.includes(stamp.id))
  const artId = styles.some(stamp => stamp.id === selectedArt) ? selectedArt : styles[0]?.id
  const count = cycle.target_snapshot
  const slots = cardMarkSlots(cycle.marks, count)
  const pendingBySlot = new Map(pendingRequests
    .filter(request => request.status === 'pending' &&
      request.slot_index !== null && request.slot_index >= 0 && request.slot_index < count)
    .map(request => [request.slot_index, request]))
  const pendingCount = pendingRequests.filter(request => request.status === 'pending').length
  const editable = canGive && !cycle.completed_at && cycle.progress_count < count && styles.length > 0

  useEffect(() => {
    if (state.status === 'idle') return
    inFlight.current = false
    if (state.status === 'success') {
      if (state.outcome === 'granted' && state.receipt?.id &&
        lastSound.current !== state.receipt.id) {
        lastSound.current = state.receipt.id
        sound?.play('stamp')
      }
      dialog.current?.close()
      key.current = null
      setSelectedSlot(null)
      setNote('')
      router.refresh()
    }
  }, [state, router, sound])

  function openSlot(slot: number) {
    if (!editable || pending || inFlight.current || !Number.isInteger(slot) ||
      slot < 0 || slot >= count || slots[slot] || pendingBySlot.has(slot)) return
    sound?.unlock()
    setSelectedSlot(slot)
    key.current = crypto.randomUUID()
    setNote('')
    setSelectedArt(styles[0]?.id ?? '')
    dialog.current?.showModal()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editable || pending || inFlight.current || !artId || selectedSlot === null ||
      slots[selectedSlot] || pendingBySlot.has(selectedSlot) || !key.current) return
    inFlight.current = true
    const form = new FormData()
    form.set('space_id', spaceId)
    form.set('book_id', bookId)
    form.set('recipient_id', participantId)
    form.set('asset_id', artId)
    form.set('note', note.trim())
    form.set('idempotency_key', key.current)
    form.set('card_slot', String(selectedSlot))
    startTransition(() => action(form))
  }

  const canCancel = !pending && !inFlight.current
  return <div className="stamp-collection-card"
    aria-label={'การ์ดสะสมแสตมป์ รอบที่ ' + cycle.cycle_no}>
    <header className="stamp-collection-card__head">
      <div>
        <span className="stamp-collection-card__eyebrow">POINT+ · STAMP CARD</span>
        <h4>การ์ดสะสมของเรา</h4>
      </div>
      <span className="stamp-collection-card__count">{cycle.progress_count} / {count}</span>
    </header>
    <ol className="stamp-card-slots" aria-label="ช่องแสตมป์เรียงลำดับ">
      {Array.from({ length: count }, (_, index) => {
        const mark = slots[index]
        const waiting = pendingBySlot.get(index)
        const art = mark ? artwork.get(mark.asset_id) : undefined
        const waitingArt = waiting ? artwork.get(waiting.asset_id) : undefined
        return <li className="stamp-card-slot" data-earned={!!mark}
          data-waiting={!!waiting && !mark}
          data-impact={mark?.request_id === impactRequestId || undefined}
          key={index} title={mark ? 'รับเมื่อ ' + mark.date : 'ช่องที่ ' + (index + 1)}>
          {mark && art
            ? <>
              <Image src={art.png} alt={art.nameTh} width={76} height={76}
                className="stamp-card-slot__stamp" draggable={false}/>
              <small>{mark.date}</small>
            </>
            : mark
              ? <span aria-label="ได้รับแสตมป์แล้ว" className="stamp-card-slot__fallback">✓</span>
              : waiting
                ? <>
                  {waitingArt && <Image src={waitingArt.png} alt="" width={70} height={70}
                    className="stamp-card-slot__stamp stamp-card-slot__stamp--waiting"/>}
                  <small>รออนุมัติ</small>
                </>
                : editable
                  ? <button type="button" className="stamp-card-slot__pick"
                    disabled={pending || inFlight.current}
                    aria-label={'เลือกแสตมป์ลงช่องที่ ' + (index + 1)}
                    onClick={() => openSlot(index)}>
                    <span className="stamp-card-slot__number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="stamp-card-slot__action">แตะเพื่อแปะ</span>
                  </button>
                  : <span aria-label={'ช่องว่างที่ ' + (index + 1)} className="stamp-card-slot__number">
                    {String(index + 1).padStart(2, '0')}
                  </span>}
        </li>
      })}
    </ol>

    {editable && <p className="stamp-collection-card__hint">แตะช่องว่างที่ต้องการ แล้วเลือกลายแสตมป์</p>}
    {pendingCount > 0 && <p className="stamp-collection-card__waiting" role="status">
      มีแสตมป์รออนุมัติ {pendingCount} ดวง (ยังไม่เพิ่มความคืบหน้า)
    </p>}
    <footer className="stamp-collection-card__foot">
      <span>สะสมทีละดวง · ทุกดวงมีความหมาย</span>
      {cycle.completed_at && <strong>สะสมครบแล้ว ✓</strong>}
    </footer>

    <dialog className="dialog stamp-card-dialog" ref={dialog}
      aria-labelledby={'card-slot-stamp-' + cycle.id}
      onCancel={event => { if (!canCancel) event.preventDefault() }}
      onClose={() => { if (canCancel) setSelectedSlot(null) }}>
      {selectedSlot !== null && <form onSubmit={submit}>
        <header className="stamp-card-dialog__head">
          <span className="stamp-collection-card__eyebrow">POINT+ · STAMP CARD</span>
          <h3 id={'card-slot-stamp-' + cycle.id}>เลือกแสตมป์สำหรับช่องที่ {selectedSlot + 1}</h3>
          <p className="muted">แสตมป์จะถูกบันทึกลงช่องนี้เท่านั้น</p>
        </header>
        <fieldset className="stamp-picker-set">
          <legend>เลือกลายแสตมป์</legend>
          <div className="stamp-card-dialog__art">
            {styles.map(stamp => <label key={stamp.id} className="stamp-card-dialog__choice"
              data-selected={artId === stamp.id}>
              <input type="radio" name="selected_art" value={stamp.id}
                checked={artId === stamp.id}
                disabled={pending}
                onChange={() => setSelectedArt(stamp.id)}/>
              <Image src={stamp.png} alt="" width={58} height={58}/>
              <span>{stamp.nameTh}</span>
            </label>)}
          </div>
        </fieldset>
        <label className="stamp-card-dialog__note" htmlFor={'card-stamp-note-' + cycle.id}>
          ข้อความแนบ (ไม่บังคับ)
          <textarea className="input" id={'card-stamp-note-' + cycle.id}
            maxLength={1000} rows={2} disabled={pending} value={note}
            onChange={event => setNote(event.target.value)}/>
        </label>
        {state.status === 'error' && <p role="alert" className="status status--error">{state.message}</p>}
        <div className="stamp-card-dialog__actions">
          <button type="button" className="button button--secondary" disabled={!canCancel}
            onClick={() => dialog.current?.close()}>ยกเลิก</button>
          <button type="submit" className="button button--primary"
            disabled={pending || !artId || inFlight.current}>
            {pending ? 'กำลังบันทึก…' : 'ยืนยันแสตมป์ช่องที่ ' + (selectedSlot + 1)}
          </button>
        </div>
      </form>}
    </dialog>
  </div>
}
