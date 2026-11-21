import Image from 'next/image'
import Link from 'next/link'
import { SectionHeader } from '@/components/ui/section-header'
import { roomArt } from '@/features/rooms/presentation'
import { canManage } from '@/features/spaces/data'
import { loadLivingBookShelf } from '@/features/living-books/data'
import { LivingBookShelf } from '@/features/living-books/shelf'

export default async function RoomHomePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params
  const {context, books, people, giverBookIds}=await loadLivingBookShelf(spaceId)
  const canCreate=context.space.kind==='couple'||canManage(context.member.role)
  const base='/s/'+spaceId+'/stamp-books'
  const current=books.filter(book=>book.status==='active')
  return <section className="room-home">
    <SectionHeader title="สมุดของเรา" actions={canCreate&&
      <Link className="button button--primary" href={base+'/new'}>สร้างสมุดหรือการ์ด</Link>}/>
    {current.length>0
      ? <section className="stationery-stack" aria-label="สมุดและการ์ดที่กำลังสะสม">
          <h3 className="shelf-heading">การสะสมของเรา</h3>
          <LivingBookShelf books={current} people={people} base={base}
            spaceId={spaceId} giverBookIds={giverBookIds}/>
        </section>
      : <div className="room-book-feature">
          <Image src={roomArt[context.space.kind]} alt="" width={86} height={86}/>
          <div className="room-book-feature__content">
            <h3>เริ่มเก็บความทรงจำ</h3>
            <Link className="button button--primary" href={canCreate?base+'/new':base}>
              {canCreate?'สร้างสมุดหรือการ์ดเล่มแรก':'ดูสมุดสะสม'}
            </Link>
          </div>
        </div>}
    <div className="hero__actions room-home__links">
      <Link className="button button--secondary" href={base}>ดูการสะสมทั้งหมด</Link>
      {context.space.kind!=='personal'&&<Link className="button button--secondary"
        href={'/s/'+spaceId+'/members'}>สมาชิกและคำเชิญ</Link>}
      {context.space.kind==='family'&&<Link className="button button--secondary"
        href={'/s/'+spaceId+'/children'}>จัดการเด็กในครอบครัว</Link>}
    </div>
  </section>
}
