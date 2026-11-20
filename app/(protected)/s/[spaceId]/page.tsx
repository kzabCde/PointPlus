import Link from 'next/link'
import { canManage } from '@/features/spaces/data'
import { loadStampBookBoard } from '@/features/stamp-books/data'
import { pointPlusStamps } from '@/lib/point-plus/assets'
import Image from 'next/image'

export default async function RoomHomePage({params}:{params:Promise<{spaceId:string}>}){
 const {spaceId}=await params
 const {context,books,cycles}=await loadStampBookBoard(spaceId)
 const manager=canManage(context.member.role)
 const base='/s/'+spaceId+'/stamp-books'
 const current=books.filter(b=>b.status==='active')
 const complete=cycles.filter(c=>c.completed_at!==null).length
 return <section className="room-home">
  <header className="room-hero">
   <span className="eyebrow">STAMP BOOK FIRST</span>
   <h2>เก็บความสุขทีละดวง</h2>
   <p>สร้างสมุดของคนสำคัญ แล้วเลือกแสตมป์สวย ๆ ให้กัน เมื่อครบเล่มก็เลือกของขวัญที่ตกลงกันไว้ได้เลย</p>
   <div className="hero__actions">
    {manager&&<Link className="button button--primary" href={base+'/new'}>+ สร้างสมุดสะสม</Link>}
    <Link className="button button--secondary" href={base}>เปิดสมุดของเรา</Link>
   </div>
  </header>
  <div className="stamp-book-facts">
   <span><strong>{current.length}</strong> สมุดที่กำลังสะสม</span>
   <span><strong>{complete}</strong> รอบที่สะสมครบ</span>
  </div>
  <div className="space-header"><h2>สมุดสะสมในห้องนี้</h2><Link className="text-link" href={base}>ดูทั้งหมด</Link></div>
  {current.length?<div className="stamp-book-library">
   {current.slice(0,6).map(book=>{
    const image=pointPlusStamps.find(s=>s.id===book.cover_asset_id)?.png
    return <Link className="stamp-book-cover" href={base+'/'+book.id} key={book.id}>
      <div className="stamp-book-cover__header">{image&&<Image src={image} alt="" height={72} width={72}/>}<span>สะสม {book.target_count} ดวง</span></div>
      <h3>{book.title}</h3><p>{book.description||'ความทรงจำดี ๆ ของเรา'}</p>
      <span className="text-link" style={{marginTop:'auto'}}>เปิดสมุด</span>
    </Link>
   })}
  </div>:<div className="card empty-state"><h3>ยังไม่มีสมุดสะสมในห้องนี้</h3>
   <p>เริ่มจากสร้างสมุด เลือกจำนวนช่องและของขวัญ แล้วชวนกันเติมแสตมป์</p>
   {manager&&<Link className="button button--primary" href={base+'/new'}>สร้างสมุดเล่มแรก</Link>}
  </div>}
  {context.space.kind==='family'&&<Link className="text-link" href={'/s/'+spaceId+'/children'}>จัดการเด็กในครอบครัว</Link>}
 </section>
}
