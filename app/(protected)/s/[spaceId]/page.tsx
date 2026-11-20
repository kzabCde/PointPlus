import Image from 'next/image'
import Link from 'next/link'
import { SectionHeader } from '@/components/ui/section-header'
import { roomArt } from '@/features/rooms/presentation'
import { canManage } from '@/features/spaces/data'
import { loadStampBookBoard } from '@/features/stamp-books/data'
import { BookCover, BookProgress, BookShelf } from '@/features/stamp-books/presentation'

export default async function RoomHomePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params
  const { context, books, cycles, eligible } = await loadStampBookBoard(spaceId)
  const manager = context.space.kind === 'couple' || canManage(context.member.role)
  const roomPath = '/s/' + spaceId
  const base = roomPath + '/stamp-books'
  const current = books.filter(book => book.status === 'active')
  const openBooks = new Map(current.map(book => [book.id, book]))
  const participants = new Map(eligible.filter(person => !person.archived_at).map(person => [person.id, person]))
  const openCycles = cycles.filter(cycle => !cycle.completed_at && openBooks.has(cycle.book_id) && participants.has(cycle.participant_id))
  const next = openCycles.find(cycle => participants.get(cycle.participant_id)?.user_id === context.user.id) ?? openCycles[0]
  const featuredBook = next && openBooks.get(next.book_id)
  const featuredPerson = next && participants.get(next.participant_id)
  const otherBooks = current.filter(book => book.id !== featuredBook?.id)

  return <section className="room-home">
    <SectionHeader title="สมุดของเรา" actions={manager && current.length > 0 && <Link className="button button--secondary" href={base + '/new'}>
      สร้างสมุดใหม่
    </Link>}/>
    {featuredBook && featuredPerson && next
      ? <div className="room-book-feature">
        <BookCover assetId={featuredBook.cover_asset_id} eager/>
        <div className="room-book-feature__content">
          <h3>{featuredBook.title}</h3>
          <BookProgress label={featuredPerson.display_name} cycle={next}/>
          <Link className="button button--primary" aria-label={'เปิดสมุด ' + featuredBook.title}
            href={base + '/' + featuredBook.id}>เปิดสมุด <span aria-hidden="true">→</span></Link>
        </div>
      </div>
      : <div className="room-book-feature">
        <Image src={roomArt[context.space.kind]} alt="" width={86} height={86}/>
        <div className="room-book-feature__content">
          <h3>{current.length ? 'สมุดในห้องนี้' : 'เริ่มเก็บความทรงจำ'}</h3>
          <Link className="button button--primary" href={current.length || !manager ? base : base + '/new'}>
            {current.length || !manager ? 'ดูสมุดทั้งหมด' : 'สร้างสมุดเล่มแรก'}
          </Link>
        </div>
      </div>}
    {otherBooks.length > 0 && <section className="stationery-stack">
      <h3 className="shelf-heading">สมุดที่กำลังสะสม</h3>
      <BookShelf books={otherBooks.slice(0, 6)} cycles={cycles} people={eligible} base={base}/>
    </section>}
    <div className="hero__actions room-home__links">
      {(featuredBook || (!current.length && manager)) &&
        <Link className="button button--secondary" href={base}>ดูสมุดทั้งหมด</Link>}
      {context.space.kind !== 'personal' && <Link className="button button--secondary" href={roomPath + '/members'}>สมาชิกและคำเชิญ</Link>}
      {context.space.kind === 'family' && <Link className="button button--secondary" href={roomPath + '/children'}>จัดการเด็กในครอบครัว</Link>}
    </div>
  </section>
}
