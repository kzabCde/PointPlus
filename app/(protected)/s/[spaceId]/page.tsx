import Image from 'next/image'
import Link from 'next/link'
import { roomArt } from '@/features/rooms/presentation'
import { canManage } from '@/features/spaces/data'
import { loadStampBookBoard } from '@/features/stamp-books/data'
import { BookShelf } from '@/features/stamp-books/presentation'

export default async function RoomHomePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params
  const { context, books, cycles, eligible } = await loadStampBookBoard(spaceId)
  const manager = context.space.kind === 'couple' || canManage(context.member.role)
  const roomPath = '/s/' + spaceId
  const base = roomPath + '/stamp-books'
  const current = books.filter(book => book.status === 'active')

  return <section className="room-home">
    <header className="room-hero">
      <div>
        <h2>สมุดของเรา</h2>
        <p>เก็บช่วงเวลาดี ๆ ในห้อง {context.space.name}</p>
        <div className="hero__actions">
          {manager && <Link className="button button--primary" href={base + '/new'}>สร้างสมุดสะสม</Link>}
          <Link className={'button button--' + (manager ? 'secondary' : 'primary')} href={base}>ดูสมุดทั้งหมด</Link>
        </div>
      </div>
      <Image src={roomArt[context.space.kind]} alt="" width={116} height={116} loading="eager"/>
    </header>
    <h2 className="shelf-heading">กำลังสะสม</h2>
    {current.length
      ? <BookShelf books={current.slice(0, 6)} cycles={cycles} people={eligible} base={base}/>
      : <div className="card empty-state"><h3>ยังไม่มีสมุดที่กำลังสะสม</h3></div>}
    <div className="hero__actions">
      {context.space.kind !== 'personal' && <Link className="button button--secondary" href={roomPath + '/members'}>สมาชิกและคำเชิญ</Link>}
      {context.space.kind === 'family' && <Link className="button button--secondary" href={roomPath + '/children'}>จัดการเด็กในครอบครัว</Link>}
    </div>
  </section>
}
