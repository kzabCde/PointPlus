import Image from 'next/image'
import { pointPlusStamps } from '@/lib/point-plus/assets'
import type { BookRequest } from './data'
import type { JournalCycle } from './journal-model'

const artwork = new Map(pointPlusStamps.map(stamp => [stamp.id, stamp]))

/**
 * The original sequential collection card, restored without a second ledger.
 * Each filled position is backed by an approved mark in the current cycle.
 * Pending requests and past cycles are shown but do not fill slots.
 */
export function StampCollectionCard({ cycle, pendingRequests, impactRequestId }: {
  cycle: JournalCycle
  pendingRequests: BookRequest[]
  impactRequestId?: string
}) {
  const pendingCount = pendingRequests.filter(request => request.participant_id &&
    request.status === 'pending').length
  const count = cycle.target_snapshot
  return <div className="stamp-collection-card" aria-label={'การ์ดสะสมแสตมป์ รอบที่ ' + cycle.cycle_no}>
    <header className="stamp-collection-card__head">
      <div>
        <span className="stamp-collection-card__eyebrow">POINT+ · STAMP CARD</span>
        <h4>การ์ดสะสมของเรา</h4>
      </div>
      <span className="stamp-collection-card__count">{cycle.progress_count} / {count}</span>
    </header>
    <ol className="stamp-card-slots" aria-label="ช่องแสตมป์เรียงลำดับ">
      {Array.from({ length: count }, (_, index) => {
        const mark = cycle.marks[index]
        const art = mark ? artwork.get(mark.asset_id) : undefined
        return <li className="stamp-card-slot" data-earned={!!mark}
          data-impact={mark?.request_id === impactRequestId || undefined}
          key={mark?.id ?? index} title={mark ? 'รับเมื่อ ' + mark.date : 'ช่องที่ ' + (index + 1)}>
          {mark && art
            ? <>
              <Image src={art.png} alt={art.nameTh} width={76} height={76}
                className="stamp-card-slot__stamp" draggable={false}/>
              <small>{mark.date}</small>
            </>
            : mark
              ? <span aria-label="ได้รับแสตมป์แล้ว" className="stamp-card-slot__fallback">✓</span>
              : <span aria-label={'ช่องว่างที่ ' + (index + 1)} className="stamp-card-slot__number">
                  {String(index + 1).padStart(2, '0')}
                </span>}
        </li>
      })}
    </ol>
    {pendingCount > 0 && <p className="stamp-collection-card__waiting" role="status">
      มีแสตมป์รออนุมัติ {pendingCount} ดวง (ยังไม่เพิ่มความคืบหน้า)
    </p>}
    <footer className="stamp-collection-card__foot">
      <span>สะสมทีละดวง · ทุกดวงมีความหมาย</span>
      {cycle.completed_at && <strong>สะสมครบแล้ว ✓</strong>}
    </footer>
  </div>
}
