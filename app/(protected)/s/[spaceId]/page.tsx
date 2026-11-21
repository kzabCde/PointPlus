import Image from 'next/image'
import Link from 'next/link'
import {SectionHeader} from '@/components/ui/section-header'
import {roomArt} from '@/features/rooms/presentation'
import {canManage} from '@/features/spaces/data'
import {loadLivingBookShelf} from '@/features/living-books/data'
import {LivingBookShelf} from '@/features/living-books/shelf'

export default async function RoomHomePage({params}:{
  params:Promise<{spaceId:string}>
}){
  const {spaceId}=await params
  const {context,books,people}=await loadLivingBookShelf(spaceId)
  const manager=context.space.kind==='couple'||canManage(context.member.role)
  const active=books.filter(book=>book.status==='active')
  const base='/s/'+spaceId+'/stamp-books'
  const roomPath='/s/'+spaceId
  const create=manager&&<Link className="button button--secondary" href={base+'/new'}>
    + สร้างสมุดใหม่
  </Link>
  return <section className="room-home">
    <SectionHeader title="สมุดความทรงจำของเรา" actions={create}/>
    {active.length>0
      ?<section className="stationery-stack" aria-label="สมุดความทรงจำ">
        <h3 className="shelf-heading">สมุดที่กำลังสะสม</h3>
        <LivingBookShelf books={active.slice(0,6)} people={people} base={base}/>
      </section>
      :<div className="room-book-feature">
        <Image src={roomArt[context.space.kind]} alt="" width={86} height={86}/>
        <div className="room-book-feature__content">
          <h3>เริ่มบันทึกความทรงจำ</h3>
          <p>สมุดหนึ่งเล่มเพิ่มหน้าเองได้ เขียน วาด แปะแสตมป์ และแลกแสตมป์บางส่วนได้</p>
          <Link className="button button--primary" href={manager?base+'/new':base}>
            {manager?'สร้างสมุดเล่มแรก':'ดูสมุดความทรงจำ'}
          </Link>
        </div>
      </div>}
    <div className="hero__actions room-home__links">
      <Link className="button button--secondary" href={base}>ดูสมุดทั้งหมด</Link>
      {context.space.kind!=='personal'&&<Link className="button button--secondary"
        href={roomPath+'/members'}>สมาชิกและคำเชิญ</Link>}
      {context.space.kind==='family'&&<Link className="button button--secondary"
        href={roomPath+'/children'}>จัดการเด็กในครอบครัว</Link>}
    </div>
  </section>
}
