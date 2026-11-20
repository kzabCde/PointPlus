import Image from 'next/image'
import Link from 'next/link'
import { pointPlusStamps } from '@/lib/point-plus/assets'
import type { Participant } from '@/features/spaces/data'
import type { StampBook, StampCycle } from './data'

export const bookStatus = {
  active: 'กำลังสะสม',
  paused: 'พักสะสม',
  archived: 'เก็บถาวร',
}

export function BookCover({ assetId, eager = false }: { assetId: string | null; eager?: boolean }) {
  const art = pointPlusStamps.find(stamp => stamp.id === assetId)
  return <span className="book-cover-art" data-theme={art?.mode}>
    <Image src={art?.png ?? '/point-plus/stamps/couple/heart.png'} alt="" width={88} height={88} loading={eager ? 'eager' : 'lazy'}/>
  </span>
}

export function BookProgress({ label, cycle, showLabel = true }: {
  label: string
  cycle: Pick<StampCycle, 'progress_count' | 'target_snapshot'>
  showLabel?: boolean
}) {
  const fraction = cycle.progress_count / cycle.target_snapshot
  return <div className={'book-progress' + (showLabel ? '' : ' book-progress--single')}>
    {showLabel && <span>{label}</span>}
    <strong>{cycle.progress_count} / {cycle.target_snapshot} ดวง</strong>
    <span className="book-progress__track" aria-hidden="true">
      <span className="book-progress__fill" style={{ transform: 'scaleX(' + fraction + ')' }}/>
    </span>
    <progress className="sr-only" aria-label={'แสตมป์ของ ' + label} max={cycle.target_snapshot} value={cycle.progress_count}/>
  </div>
}

export function BookShelf({ books, cycles, people, base }: {
  books: StampBook[]
  cycles: StampCycle[]
  people: Participant[]
  base: string
}) {
  const latestByBook = new Map<string, Map<string, StampCycle>>()
  for (const cycle of cycles) {
    let latest = latestByBook.get(cycle.book_id)
    if (!latest) {
      latest = new Map()
      latestByBook.set(cycle.book_id, latest)
    }
    if (cycle.cycle_no > (latest.get(cycle.participant_id)?.cycle_no ?? 0)) {
      latest.set(cycle.participant_id, cycle)
    }
  }

  return <div className="stamp-book-library">
    {books.map((book, index) => {
      const latest = latestByBook.get(book.id)
      const creator = latest?.size ? undefined : people.find(person => person.user_id === book.created_by)
      return <article className="stamp-book-cover" key={book.id}>
        <div className="book-card__visual"><BookCover assetId={book.cover_asset_id} eager={index === 0}/></div>
        <div className="book-card__content">
          <span className="book-status" data-status={book.status}>{bookStatus[book.status]}</span>
          <h3>{book.title}</h3>
          {book.description && <p>{book.description}</p>}
          {creator && <p>สร้างโดย {creator.display_name}</p>}
          {!!latest?.size && <div className="book-card__progress">{people.flatMap(person => {
            const cycle = latest.get(person.id)
            return cycle ? [<BookProgress label={person.display_name} cycle={cycle} key={person.id}/>] : []
          })}</div>}
          <Link className="button button--secondary" aria-label={'เปิดสมุด ' + book.title} href={base + '/' + book.id}>
            เปิดสมุด <span aria-hidden="true">→</span>
          </Link>
        </div>
      </article>
    })}
  </div>
}
